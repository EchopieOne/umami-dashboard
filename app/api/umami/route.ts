import { NextResponse } from 'next/server';

const UMAMI_URL = (process.env.UMAMI_URL || 'https://ubm.echopie.com').trim();
const USERNAME = (process.env.UMAMI_USERNAME || 'admin').trim();
const PASSWORD = (process.env.UMAMI_PASSWORD || 'umami').trim();
const REVENUECAT_BASE_URL = 'https://api.revenuecat.com/v2';
const REVENUECAT_API_KEY = (process.env.REVENUECAT_API_KEY || '').trim();
const REVENUECAT_PROJECT_ID = (process.env.REVENUECAT_PROJECT_ID || '').trim();

let cachedToken: string | null = null;
let cachedWebsiteId: string | null = null;

interface EventItem {
  eventName?: string;
  createdAt?: number;
  [key: string]: any;
}

interface CountryMetric {
  x?: string;
  y?: number;
}

interface RetentionData {
  day1: number;
  day7: number;
  day30: number;
}

interface RevenueHealth {
  arpu: number;
  arppu: number;
  penetrationRate: number;
  ltv: number;
}

interface AlarmHealth {
  avgAlarmsPerUser: number;
  editRate: number;
  deleteRate: number;
  typeDistribution: { name: string; value: number; percentage: number }[];
}

interface PurchaseSource {
  source: string;
  clicks: number;
  conversions: number;
  conversionRate: number;
}

interface PurchaseFlow {
  viewPricing: number;
  clickPurchase: number;
  startPayment: number;
  success: number;
  failed: number;
  cancel: number;
  steps: { name: string; value: number; dropOff: number }[];
}

function hasRevenueCatCredentials() {
  return Boolean(REVENUECAT_API_KEY && REVENUECAT_PROJECT_ID);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getRevenueCatHeaders() {
  return {
    Authorization: `Bearer ${REVENUECAT_API_KEY}`,
    'Content-Type': 'application/json',
  };
}

async function getRevenueCatRevenue(startAt: number, endAt: number) {
  if (!hasRevenueCatCredentials()) {
    console.log('RevenueCat credentials missing');
    return null;
  }

  const startDate = new Date(startAt).toISOString().split('T')[0];
  const endDate = new Date(endAt).toISOString().split('T')[0];

  const overviewUrl = `${REVENUECAT_BASE_URL}/projects/${REVENUECAT_PROJECT_ID}/metrics/overview`;
  const chartsUrl = `${REVENUECAT_BASE_URL}/projects/${REVENUECAT_PROJECT_ID}/charts/revenue?start_date=${startDate}&end_date=${endDate}&resolution=day`;

  const [overviewRes, chartsRevenueRes] = await Promise.all([
    fetch(overviewUrl, { headers: getRevenueCatHeaders(), cache: 'no-store' }),
    fetch(chartsUrl, { headers: getRevenueCatHeaders(), cache: 'no-store' }),
  ]);

  if (!overviewRes.ok) {
    const error = await overviewRes.text();
    throw new Error(`RevenueCat overview failed: ${overviewRes.status} - ${error}`);
  }

  const overviewData = await overviewRes.json();
  let chartsData = null;
  if (chartsRevenueRes.ok) {
    chartsData = await chartsRevenueRes.json();
  }

  return { overview: overviewData, chartsRevenue: chartsData };
}

async function getRevenueCatTransactions(startAt?: number, endAt?: number) {
  if (!hasRevenueCatCredentials()) return null;
  
  // Try events endpoint instead of transactions
  let url = `${REVENUECAT_BASE_URL}/projects/${REVENUECAT_PROJECT_ID}/events?limit=100`;
  
  if (startAt && endAt) {
    const startDate = new Date(startAt).toISOString();
    const endDate = new Date(endAt).toISOString();
    url += `&after=${encodeURIComponent(startDate)}&before=${encodeURIComponent(endDate)}`;
  }
  
  console.log('Fetching RevenueCat events:', url);
  
  const res = await fetch(url, { 
    headers: getRevenueCatHeaders(), 
    cache: 'no-store' 
  });
  
  if (!res.ok) {
    const errorText = await res.text();
    console.error('RevenueCat events error:', res.status, errorText);
    return null;
  }
  
  const data = await res.json();
  console.log(`Retrieved ${data.items?.length || 0} events`);
  
  return data;
}

// Parse transaction details from events
function parseRevenueCatTransactions(eventsData: any) {
  if (!eventsData?.items || !Array.isArray(eventsData.items)) {
    return [];
  }

  // Filter for purchase-related events
  const purchaseEvents = eventsData.items.filter((event: any) => {
    const type = event.type || '';
    return ['INITIAL_PURCHASE', 'RENEWAL', 'CANCELLATION', 'REFUND'].includes(type);
  });

  return purchaseEvents.map((event: any) => ({
    id: event.id,
    type: event.type,
    store: event.store,
    price: event.price?.amount || 0,
    currency: event.price?.currency || 'USD',
    productId: event.product_id,
    subscriberId: event.subscriber?.id,
    country: event.subscriber?.country,
    appUserId: event.subscriber?.app_user_id,
    isTrial: event.is_trial_conversion || false,
    cancellationReason: event.cancellation_reason,
    createdAt: event.created_at,
    customAttributes: event.subscriber?.custom_attributes || {},
  }));
}

function getMetricValueById(metrics: unknown, id: string): number | undefined {
  if (!Array.isArray(metrics)) return undefined;
  const metric = metrics.find((m) => isRecord(m) && m.id === id);
  if (isRecord(metric) && typeof metric.value === 'number') {
    return metric.value;
  }
  return undefined;
}

function parseRevenueCatMetrics(revenueData: any, transactionsData: any) {
  if (!revenueData?.overview?.metrics) {
    return { mrr: 0, totalRevenue: 0, activeSubscriptions: 0, trials: 0, churnRate: 0 };
  }

  const metrics = revenueData.overview.metrics;
  
  return {
    mrr: getMetricValueById(metrics, 'mrr') ?? 0,
    totalRevenue: getMetricValueById(metrics, 'revenue') ?? 0,
    activeSubscriptions: getMetricValueById(metrics, 'active_subscriptions') ?? 0,
    trials: getMetricValueById(metrics, 'active_trials') ?? 0,
    churnRate: getMetricValueById(metrics, 'churn_rate') ?? 0,
  };
}

async function login() {
  const res = await fetch(`${UMAMI_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: USERNAME, password: PASSWORD }),
  });
  const data = await res.json();
  if (!data.token) throw new Error('Login failed');
  cachedToken = data.token;
  return cachedToken;
}

async function getToken() {
  if (cachedToken) return cachedToken;
  return login();
}

async function getWebsiteId() {
  if (cachedWebsiteId) return cachedWebsiteId;
  const token = await getToken();
  const res = await fetch(`${UMAMI_URL}/api/websites`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  cachedWebsiteId = data.data[0].id;
  return cachedWebsiteId;
}

async function getEvents(startAt: number, endAt: number, eventName?: string) {
  const token = await getToken();
  const websiteId = await getWebsiteId();
  const params = new URLSearchParams({
    startAt: startAt.toString(),
    endAt: endAt.toString(),
    pageSize: '1000',
  });
  if (eventName) params.append('event', eventName);
  
  const res = await fetch(
    `${UMAMI_URL}/api/websites/${websiteId}/events?${params}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return res.json();
}

async function getStats(startAt: number, endAt: number) {
  const token = await getToken();
  const websiteId = await getWebsiteId();
  const params = new URLSearchParams({ startAt: startAt.toString(), endAt: endAt.toString() });
  
  const res = await fetch(
    `${UMAMI_URL}/api/websites/${websiteId}/stats?${params}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return res.json();
}

async function getCountries(startAt: number, endAt: number) {
  const token = await getToken();
  const websiteId = await getWebsiteId();
  const params = new URLSearchParams({
    startAt: startAt.toString(),
    endAt: endAt.toString(),
    type: 'country',
  });
  
  const res = await fetch(
    `${UMAMI_URL}/api/websites/${websiteId}/metrics?${params}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return res.json();
}

async function getCities(startAt: number, endAt: number) {
  const token = await getToken();
  const websiteId = await getWebsiteId();
  const params = new URLSearchParams({
    startAt: startAt.toString(),
    endAt: endAt.toString(),
    type: 'city',
  });
  
  const res = await fetch(
    `${UMAMI_URL}/api/websites/${websiteId}/metrics?${params}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return res.json();
}

function formatDate(timestamp: number) {
  return new Date(timestamp).toISOString().split('T')[0];
}

function getDailyData(events: EventItem[] | undefined, startAt: number, endAt: number) {
  if (!Array.isArray(events)) return [];
  
  const daily: Record<string, number> = {};
  const start = new Date(startAt);
  const end = new Date(endAt);
  
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    daily[formatDate(d.getTime())] = 0;
  }
  
  events.forEach((event) => {
    if (event?.createdAt) {
      const date = formatDate(event.createdAt);
      if (daily[date] !== undefined) {
        daily[date]++;
      }
    }
  });
  
  return Object.entries(daily).map(([date, count]) => ({ date, count }));
}

// 计算留存率
async function calculateRetention(now: number): Promise<RetentionData> {
  // 获取1天前、7天前、30天前的新用户
  const oneDayAgo = now - 1 * 24 * 60 * 60 * 1000;
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
  
  const [newUsers1d, newUsers7d, newUsers30d, activeToday] = await Promise.all([
    getEvents(oneDayAgo - 24 * 60 * 60 * 1000, oneDayAgo, 'new.user'),
    getEvents(sevenDaysAgo - 24 * 60 * 60 * 1000, sevenDaysAgo, 'new.user'),
    getEvents(thirtyDaysAgo - 24 * 60 * 60 * 1000, thirtyDaysAgo, 'new.user'),
    getEvents(now - 24 * 60 * 60 * 1000, now, 'user.daily.active'),
  ]);
  
  const activeUserIds = new Set(activeToday.data?.map((e: EventItem) => e.createdAt));
  
  const calculateRate = (newUsers: any) => {
    if (!newUsers.data?.length) return 0;
    const retained = newUsers.data.filter((e: EventItem) => 
      activeToday.data?.some((a: EventItem) => 
        Math.abs((e.createdAt || 0) - (a.createdAt || 0)) < 1000
      )
    ).length;
    return Math.round((retained / newUsers.data.length) * 100);
  };
  
  return {
    day1: calculateRate(newUsers1d),
    day7: calculateRate(newUsers7d),
    day30: calculateRate(newUsers30d),
  };
}

// 分析闹钟类型
function analyzeAlarmTypes(events: EventItem[]) {
  const types: Record<string, number> = {
    '一次性': 0, '每天': 0, '工作日': 0, '节假日': 0,
    '规律工作日': 0, '大小周': 0, '规律休息日': 0, '响一次': 0, '自定义': 0,
  };
  
  events.forEach((e) => {
    if (!e?.eventName) return;
    const name = e.eventName;
    if (name.includes('once')) types['一次性']++;
    else if (name.includes('everyday')) types['每天']++;
    else if (name.includes('workday') && !name.includes('regular')) types['工作日']++;
    else if (name.includes('holiday')) types['节假日']++;
    else if (name.includes('regular.workday')) types['规律工作日']++;
    else if (name.includes('big.small') || name.includes('last.saturday')) types['大小周']++;
    else if (name.includes('regular.weekend') || name.includes('regular.off')) types['规律休息日']++;
    else if (name.includes('one.time')) types['响一次']++;
    else if (name.includes('custom')) types['自定义']++;
  });
  
  const total = Object.values(types).reduce((a, b) => a + b, 0);
  return Object.entries(types)
    .filter(([, count]) => count > 0)
    .map(([name, value]) => ({ 
      name, 
      value, 
      percentage: total > 0 ? Math.round((value / total) * 100) : 0 
    }));
}

// 分析购买漏斗
function analyzePurchaseFunnel(
  purchaseEvents: EventItem[], 
  clickEvents: EventItem[],
  pricingViewEvents: EventItem[]
): PurchaseFlow {
  const clicks = clickEvents.length;
  const success = purchaseEvents.filter(e => e.eventName === 'setting.purchase.success').length;
  const failed = purchaseEvents.filter(e => e.eventName === 'setting.purchase.failed').length;
  const cancel = purchaseEvents.filter(e => e.eventName === 'setting.purchase.cancel').length;
  const viewPricing = pricingViewEvents.length;
  
  const steps = [
    { name: '查看定价', value: viewPricing, dropOff: 0 },
    { name: '点击购买', value: clicks, dropOff: viewPricing > 0 ? Math.round(((viewPricing - clicks) / viewPricing) * 100) : 0 },
    { name: '支付成功', value: success, dropOff: clicks > 0 ? Math.round(((clicks - success) / clicks) * 100) : 0 },
  ];
  
  return {
    viewPricing,
    clickPurchase: clicks,
    startPayment: clicks,
    success,
    failed,
    cancel,
    steps,
  };
}

// 分析购买来源
function analyzePurchaseSource(
  mainClicks: EventItem[],
  settingClicks: EventItem[],
  onboardingClicks: EventItem[],
  successEvents: EventItem[]
): PurchaseSource[] {
  const sources = [
    { name: '主页', clicks: mainClicks.length },
    { name: '设置页', clicks: settingClicks.length },
    { name: 'Onboarding', clicks: onboardingClicks.length },
  ];
  
  return sources.map(source => ({
    source: source.name,
    clicks: source.clicks,
    conversions: successEvents.length, // 简化处理
    conversionRate: source.clicks > 0 ? Math.round((successEvents.length / source.clicks) * 100) : 0,
  }));
}

function calculateChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

function getRangeLabel(range: string, startAt: number, endAt: number): string {
  switch (range) {
    case '24h': return '过去 24 小时';
    case 'today': return '今天';
    case 'week': return '本周';
    case 'month': return '本月';
    default: 
      const days = Math.ceil((endAt - startAt) / (24 * 60 * 60 * 1000));
      return `过去 ${days} 天`;
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const range = searchParams.get('range') || '7';
    const customStart = searchParams.get('startAt');
    const customEnd = searchParams.get('endAt');
    
    let startAt: number, endAt: number;
    const now = Date.now();
    
    if (customStart && customEnd) {
      startAt = parseInt(customStart);
      endAt = parseInt(customEnd);
    } else {
      switch (range) {
        case '24h':
          startAt = now - 24 * 60 * 60 * 1000;
          endAt = now;
          break;
        case 'today':
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          startAt = today.getTime();
          endAt = now;
          break;
        case 'week':
          const weekStart = new Date();
          weekStart.setDate(weekStart.getDate() - weekStart.getDay());
          weekStart.setHours(0, 0, 0, 0);
          startAt = weekStart.getTime();
          endAt = now;
          break;
        case 'month':
          const monthStart = new Date();
          monthStart.setDate(1);
          monthStart.setHours(0, 0, 0, 0);
          startAt = monthStart.getTime();
          endAt = now;
          break;
        default:
          const days = parseInt(range) || 7;
          startAt = now - days * 24 * 60 * 60 * 1000;
          endAt = now;
      }
    }
    
    const duration = endAt - startAt;
    const prevStartAt = startAt - duration;
    const prevEndAt = startAt;
    
    // 批量获取所有事件
    const [
      appLaunch, newUsers, dailyActive, vipUsers, annualVip, lifetimeVip,
      addAlarm, editAlarm, deleteAlarm, alarmTypes,
      purchaseMain, purchaseSetting, purchaseOnboarding, purchaseSuccess, purchaseFailed, purchaseCancel,
      clickAnnual, clickLifetime, viewPricing,
      onboardingAppear, onboardingSkip, onboardingComplete,
      showRating, iclickCloud,
      stats, prevStats, countries, cities,
      newUsers30d, activeUsers30d, purchases30d,
      revenueCatRevenue, revenueCatTransactions,
    ] = await Promise.all([
      getEvents(startAt, endAt, 'app.launch'),
      getEvents(startAt, endAt, 'new.user'),
      getEvents(startAt, endAt, 'user.daily.active'),
      getEvents(startAt, endAt, 'user.vip'),
      getEvents(startAt, endAt, 'user.annual.vip'),
      getEvents(startAt, endAt, 'user.lifetime.vip'),
      
      getEvents(startAt, endAt, 'alarm.add.click'),
      getEvents(startAt, endAt, 'alarm.edit'),
      getEvents(startAt, endAt, 'alarm.swipe.to.delete'),
      getEvents(startAt, endAt),
      
      getEvents(startAt, endAt, 'main.purchase.click'),
      getEvents(startAt, endAt, 'setting.purchase'),
      getEvents(startAt, endAt, 'onboarding.purchase.click'),
      getEvents(startAt, endAt, 'setting.purchase.success'),
      getEvents(startAt, endAt, 'setting.purchase.failed'),
      getEvents(startAt, endAt, 'setting.purchase.cancel'),
      getEvents(startAt, endAt, 'setting.purchase.annual.click'),
      getEvents(startAt, endAt, 'setting.purchase.lifetime.click'),
      getEvents(startAt, endAt, 'pricing.view'),
      
      getEvents(startAt, endAt, 'onboarding.appear'),
      getEvents(startAt, endAt, 'onboarding.skip.click'),
      getEvents(startAt, endAt, 'onboarding.start.click'),
      
      getEvents(startAt, endAt, 'user.show.rating.popup'),
      getEvents(startAt, endAt, 'setting.icloud.click'),
      
      getStats(startAt, endAt),
      getStats(prevStartAt, prevEndAt),
      getCountries(startAt, endAt),
      getCities(startAt, endAt),
      
      getEvents(now - 30 * 24 * 60 * 60 * 1000, now, 'new.user'),
      getEvents(now - 24 * 60 * 60 * 1000, now, 'user.daily.active'),
      getEvents(now - 30 * 24 * 60 * 60 * 1000, now, 'setting.purchase.success'),
      getRevenueCatRevenue(startAt, endAt).catch(() => null),
      getRevenueCatTransactions(startAt, endAt).catch(() => null),
    ]);
    
    const alarmTypeEvents = alarmTypes.data?.filter((e: EventItem) => 
      e.eventName?.includes('alarm.add.')
    ) || [];
    
    const purchaseClickEvents = [
      ...(purchaseMain.data || []),
      ...(purchaseSetting.data || []),
      ...(purchaseOnboarding.data || []),
    ];
    const allPurchaseEvents = [
      ...(purchaseSuccess.data || []),
      ...(purchaseFailed.data || []),
      ...(purchaseCancel.data || []),
    ];
    
    const prevNewUsers = await getEvents(prevStartAt, prevEndAt, 'new.user');
    
    const visitors = stats.visitors?.value || stats.visitors || 0;
    const prevVisitors = prevStats.visitors?.value || prevStats.visitors || 0;
    const revenueCatMetrics = parseRevenueCatMetrics(revenueCatRevenue, revenueCatTransactions);
    
    const activeUsers = dailyActive.data?.length || 0;
    const totalRevenue = revenueCatMetrics.totalRevenue;
    const vipUserCount = vipUsers.data?.length || 0;
    
    // 计算收入健康指标
    const revenueHealth: RevenueHealth = {
      arpu: activeUsers > 0 ? totalRevenue / activeUsers : 0,
      arppu: vipUserCount > 0 ? totalRevenue / vipUserCount : 0,
      penetrationRate: activeUsers > 0 ? (vipUserCount / activeUsers) * 100 : 0,
      ltv: revenueCatMetrics.churnRate > 0 
        ? (revenueCatMetrics.mrr * 12) / (revenueCatMetrics.churnRate / 100)
        : revenueCatMetrics.mrr * 12,
    };
    
    // 计算闹钟健康指标
    const alarmsAdded = addAlarm.data?.length || 0;
    const alarmsEdited = editAlarm.data?.length || 0;
    const alarmsDeleted = deleteAlarm.data?.length || 0;
    
    const alarmHealth: AlarmHealth = {
      avgAlarmsPerUser: activeUsers > 0 ? alarmsAdded / activeUsers : 0,
      editRate: alarmsAdded > 0 ? (alarmsEdited / alarmsAdded) * 100 : 0,
      deleteRate: alarmsAdded > 0 ? (alarmsDeleted / alarmsAdded) * 100 : 0,
      typeDistribution: analyzeAlarmTypes(alarmTypeEvents),
    };
    
    // 计算留存（简化版，基于当前时段）
    const retention: RetentionData = {
      day1: 0, day7: 0, day30: 0,
    };
    
    const days = Math.ceil((endAt - startAt) / (24 * 60 * 60 * 1000));
    
    return NextResponse.json({
      summary: {
        appLaunches: appLaunch.data?.length || 0,
        newUsers: newUsers.data?.length || 0,
        newUsersChange: calculateChange(newUsers.data?.length || 0, prevNewUsers.data?.length || 0),
        activeUsers,
        visitors,
        visitorChange: calculateChange(visitors, prevVisitors),
        
        vipUsers: vipUserCount,
        annualVip: annualVip.data?.length || 0,
        lifetimeVip: lifetimeVip.data?.length || 0,
        
        alarmsAdded,
        alarmsEdited,
        alarmsDeleted,
        
        purchaseFunnel: analyzePurchaseFunnel(allPurchaseEvents, purchaseClickEvents, viewPricing.data || []),
        purchaseSource: analyzePurchaseSource(
          purchaseMain.data || [],
          purchaseSetting.data || [],
          purchaseOnboarding.data || [],
          purchaseSuccess.data || []
        ),
        
        onboarding: {
          appear: onboardingAppear.data?.length || 0,
          skip: onboardingSkip.data?.length || 0,
          complete: onboardingComplete.data?.length || 0,
          completionRate: onboardingAppear.data?.length > 0 
            ? ((onboardingComplete.data?.length || 0) / onboardingAppear.data?.length * 100).toFixed(1)
            : '0.0',
        },
        
        ratingShown: showRating.data?.length || 0,
        iclickCloud: iclickCloud.data?.length || 0,
        
        pageviews: stats.pageviews?.value || stats.pageviews || 0,
        bounceRate: stats.bounces?.value || stats.bounces || 0,
        avgTime: stats.time?.value || stats.time || 0,
        
        mrr: revenueCatMetrics.mrr,
        totalRevenue: revenueCatMetrics.totalRevenue,
        activeSubscriptions: revenueCatMetrics.activeSubscriptions,
        trials: revenueCatMetrics.trials,
        churnRate: revenueCatMetrics.churnRate,
        
        revenueHealth,
        alarmHealth,
        retention,
      },
      
      charts: {
        newUsers: getDailyData(newUsers.data || [], startAt, endAt),
        activeUsers: getDailyData(dailyActive.data || [], startAt, endAt),
        appLaunches: getDailyData(appLaunch.data || [], startAt, endAt),
        alarmsAdded: getDailyData(addAlarm.data || [], startAt, endAt),
        purchases: getDailyData(purchaseSuccess.data || [], startAt, endAt),
        trend30d: {
          newUsers: getDailyData(newUsers30d.data || [], now - 30 * 24 * 60 * 60 * 1000, now),
          activeUsers: getDailyData(activeUsers30d.data || [], now - 24 * 60 * 60 * 1000, now),
          purchases: getDailyData(purchases30d.data || [], now - 30 * 24 * 60 * 60 * 1000, now),
        }
      },
      
      breakdown: {
        alarmTypes: alarmHealth.typeDistribution,
        purchaseClicks: {
          annual: clickAnnual.data?.length || 0,
          lifetime: clickLifetime.data?.length || 0,
          main: purchaseMain.data?.length || 0,
          setting: purchaseSetting.data?.length || 0,
          onboarding: purchaseOnboarding.data?.length || 0,
        },
        countries: (countries || [])
          .filter((c: CountryMetric) => c?.x && c?.y)
          .sort((a: CountryMetric, b: CountryMetric) => (b.y || 0) - (a.y || 0))
          .slice(0, 5)
          .map((c: CountryMetric) => ({ name: c.x || 'Unknown', value: c.y || 0 })),
        cities: (cities || [])
          .filter((c: CountryMetric) => c?.x && c?.y)
          .sort((a: CountryMetric, b: CountryMetric) => (b.y || 0) - (a.y || 0))
          .slice(0, 5)
          .map((c: CountryMetric) => ({ name: c.x || 'Unknown', value: c.y || 0 })),
        transactions: parseRevenueCatTransactions(revenueCatTransactions),
      },
      
      revenueCat: {
        rawTransactions: revenueCatTransactions,
      },
      
      range: {
        startAt,
        endAt,
        days,
        label: getRangeLabel(range, startAt, endAt),
      },
    });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch data' },
      { status: 500 }
    );
  }
}
