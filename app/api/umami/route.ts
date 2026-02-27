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
}

interface CountryMetric {
  x?: string;
  y?: number;
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
    console.log('RevenueCat credentials missing - API_KEY:', !!REVENUECAT_API_KEY, 'PROJECT_ID:', !!REVENUECAT_PROJECT_ID);
    return null;
  }

  // Convert timestamps to ISO date strings (YYYY-MM-DD)
  const startDate = new Date(startAt).toISOString().split('T')[0];
  const endDate = new Date(endAt).toISOString().split('T')[0];

  console.log(`Fetching RevenueCat data from ${startDate} to ${endDate}`);
  console.log(`Project ID: ${REVENUECAT_PROJECT_ID.slice(0, 8)}...`);

  const overviewUrl = `${REVENUECAT_BASE_URL}/projects/${REVENUECAT_PROJECT_ID}/metrics/overview`;
  const chartsUrl = `${REVENUECAT_BASE_URL}/projects/${REVENUECAT_PROJECT_ID}/charts/revenue?start_date=${startDate}&end_date=${endDate}&resolution=day`;

  console.log('Overview URL:', overviewUrl);
  console.log('Charts URL:', chartsUrl);

  const [overviewRes, chartsRevenueRes] = await Promise.all([
    fetch(overviewUrl, {
      headers: getRevenueCatHeaders(),
      cache: 'no-store',
    }),
    fetch(chartsUrl, {
      headers: getRevenueCatHeaders(),
      cache: 'no-store',
    }),
  ]);

  console.log(`RevenueCat API status: overview=${overviewRes.status}, charts=${chartsRevenueRes.status}`);

  if (!overviewRes.ok) {
    const overviewError = await overviewRes.text();
    console.error('RevenueCat overview error:', overviewError);
  }
  if (!chartsRevenueRes.ok) {
    const chartsError = await chartsRevenueRes.text();
    console.error('RevenueCat charts error:', chartsError);
  }

  if (!overviewRes.ok || !chartsRevenueRes.ok) {
    throw new Error(
      `RevenueCat revenue fetch failed: overview=${overviewRes.status}, charts=${chartsRevenueRes.status}`
    );
  }

  const [overviewData, chartsRevenueData] = await Promise.all([
    overviewRes.json(),
    chartsRevenueRes.json(),
  ]);

  console.log('RevenueCat overview:', JSON.stringify(overviewData, null, 2).slice(0, 800));
  console.log('RevenueCat charts:', JSON.stringify(chartsRevenueData, null, 2).slice(0, 800));

  return {
    overview: overviewData,
    chartsRevenue: chartsRevenueData,
  };
}

async function getRevenueCatTransactions() {
  if (!hasRevenueCatCredentials()) return null;

  const res = await fetch(
    `${REVENUECAT_BASE_URL}/projects/${REVENUECAT_PROJECT_ID}/transactions`,
    {
      headers: getRevenueCatHeaders(),
      cache: 'no-store',
    }
  );

  if (!res.ok) {
    throw new Error(`RevenueCat transactions fetch failed: ${res.status}`);
  }

  return res.json();
}

function readNumberAtPaths(source: unknown, paths: string[]) {
  if (!isRecord(source)) return undefined;

  for (const path of paths) {
    const segments = path.split('.');
    let current: unknown = source;

    for (const segment of segments) {
      if (isRecord(current) && segment in current) {
        current = current[segment];
      } else {
        current = undefined;
        break;
      }
    }

    if (typeof current === 'number') return current;
    if (typeof current === 'string' && current.trim() !== '' && !Number.isNaN(Number(current))) {
      return Number(current);
    }
  }

  return undefined;
}

function countTrialConversions(transactionsData: unknown): number {
  const container = isRecord(transactionsData) ? transactionsData : {};
  const list = container.items || container.data || container.transactions || [];
  if (!Array.isArray(list)) return 0;

  return list.filter((tx) => {
    if (!isRecord(tx)) return false;
    return Boolean(
      tx.is_trial_conversion ||
      tx.trial_conversion ||
      tx.converted_from_trial
    );
  }).length;
}

function getMetricValueById(metrics: unknown, id: string): number | undefined {
  if (!Array.isArray(metrics)) return undefined;
  const metric = metrics.find((m) => isRecord(m) && m.id === id);
  if (isRecord(metric) && typeof metric.value === 'number') {
    return metric.value;
  }
  return undefined;
}

function parseRevenueCatMetrics(revenueData: unknown, transactionsData: unknown) {
  // Check if revenueData contains an error
  if (isRecord(revenueData) && revenueData.error) {
    console.error('RevenueCat data has error:', revenueData.error);
    return { mrr: 0, totalRevenue: 0, activeSubscriptions: 0, trials: 0, churnRate: 0, _error: revenueData.error };
  }
  
  const revenueRecord = isRecord(revenueData) ? revenueData : {};
  const overview = revenueRecord.overview;
  const chartsRevenue = revenueRecord.chartsRevenue;

  // Debug: Log raw data structure
  console.log('RevenueCat parse - overview type:', typeof overview);
  console.log('RevenueCat parse - overview keys:', isRecord(overview) ? Object.keys(overview) : 'N/A');
  console.log('RevenueCat parse - chartsRevenue type:', typeof chartsRevenue);

  // Overview metrics is an array with {id, value} objects
  const overviewMetrics = isRecord(overview) ? overview.metrics : undefined;
  console.log('RevenueCat parse - overviewMetrics:', Array.isArray(overviewMetrics) ? `array[${overviewMetrics.length}]` : overviewMetrics);

  // Log all available metric IDs for debugging
  if (Array.isArray(overviewMetrics)) {
    console.log('Available metric IDs:', overviewMetrics.map((m: any) => m.id).join(', '));
  }

  const mrr =
    getMetricValueById(overviewMetrics, 'mrr') ??
    readNumberAtPaths(chartsRevenue, [
      'mrr',
      'data.mrr',
      'summary.mrr',
      'totals.mrr',
      'totals.monthly_recurring_revenue',
    ]) ??
    0;

  const totalRevenue =
    getMetricValueById(overviewMetrics, 'revenue') ??
    getMetricValueById(overviewMetrics, 'total_revenue') ??
    readNumberAtPaths(chartsRevenue, [
      'revenue',
      'data.revenue',
      'summary.revenue',
      'totals.revenue',
      'totals.total_revenue',
      'total_revenue',
    ]) ??
    0;

  const activeSubscriptions =
    getMetricValueById(overviewMetrics, 'active_subscriptions') ??
    getMetricValueById(overviewMetrics, 'active_subscriptions_count') ??
    readNumberAtPaths(transactionsData, [
      'active_subscriptions',
      'summary.active_subscriptions',
      'totals.active_subscriptions',
    ]) ??
    0;

  const trials =
    getMetricValueById(overviewMetrics, 'active_trials') ??
    getMetricValueById(overviewMetrics, 'trial_conversions') ??
    getMetricValueById(overviewMetrics, 'trials') ??
    countTrialConversions(transactionsData);

  const churnRate =
    getMetricValueById(overviewMetrics, 'churn_rate') ??
    getMetricValueById(overviewMetrics, 'subscription_churn_rate') ??
    readNumberAtPaths(chartsRevenue, [
      'churn_rate',
      'data.churn_rate',
      'summary.churn_rate',
    ]) ??
    0;

  console.log('Parsed RevenueCat metrics:', { mrr, totalRevenue, activeSubscriptions, trials, churnRate });

  return {
    mrr,
    totalRevenue,
    activeSubscriptions,
    trials,
    churnRate,
  };
}

async function login() {
  if (!USERNAME || !PASSWORD) {
    throw new Error('UMAMI_USERNAME and UMAMI_PASSWORD environment variables are required');
  }
  const res = await fetch(`${UMAMI_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: USERNAME, password: PASSWORD }),
  });
  const data = await res.json();
  if (!data.token) {
    console.error('Login failed:', JSON.stringify(data, null, 2));
    throw new Error('Login failed: ' + (data.error?.message || JSON.stringify(data)));
  }
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
  if (!data.data || !data.data[0]) {
    console.error('No websites found:', data);
    throw new Error('No websites found in Umami account');
  }
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
  const params = new URLSearchParams({
    startAt: startAt.toString(),
    endAt: endAt.toString(),
  });
  
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

function formatDate(timestamp: number) {
  return new Date(timestamp).toISOString().split('T')[0];
}

function getDailyData(events: EventItem[] | undefined, startAt: number, endAt: number) {
  if (!Array.isArray(events)) {
    console.error('getDailyData: events is not an array', events);
    return [];
  }
  
  const daily: Record<string, number> = {};
  const start = new Date(startAt);
  const end = new Date(endAt);
  
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    daily[formatDate(d.getTime())] = 0;
  }
  
  events.forEach((event) => {
    if (event && event.createdAt) {
      const date = formatDate(event.createdAt);
      if (daily[date] !== undefined) {
        daily[date]++;
      }
    }
  });
  
  return Object.entries(daily).map(([date, count]) => ({
    date,
    count,
  }));
}

// 分析闹钟类型分布
function analyzeAlarmTypes(events: EventItem[] | undefined) {
  if (!Array.isArray(events)) {
    console.error('analyzeAlarmTypes: events is not an array', events);
    return [];
  }
  
  const types: Record<string, number> = {
    '一次性': 0,
    '每天': 0,
    '工作日': 0,
    '节假日': 0,
    '规律工作日': 0,
    '大小周': 0,
    '规律休息日': 0,
    '响一次': 0,
    '自定义': 0,
  };
  
  events.forEach((e) => {
    if (!e || !e.eventName) return;
    const eventName = e.eventName || '';
    if (eventName.includes('once')) types['一次性']++;
    else if (eventName.includes('everyday')) types['每天']++;
    else if (eventName.includes('workday') && !eventName.includes('regular')) types['工作日']++;
    else if (eventName.includes('holiday')) types['节假日']++;
    else if (eventName.includes('regular.workday')) types['规律工作日']++;
    else if (eventName.includes('big.small') || eventName.includes('last.saturday')) types['大小周']++;
    else if (eventName.includes('regular.weekend') || eventName.includes('regular.off')) types['规律休息日']++;
    else if (eventName.includes('one.time')) types['响一次']++;
    else if (eventName.includes('custom')) types['自定义']++;
  });
  
  return Object.entries(types)
    .filter(([, count]) => count > 0)
    .map(([name, value]) => ({ name, value }));
}

// 获取国家分布前5名
function getTopCountries(countries: unknown) {
  console.log('getTopCountries input:', JSON.stringify(countries));
  
  if (!countries) {
    console.error('getTopCountries: countries is null/undefined');
    return [];
  }
  
  if (!Array.isArray(countries)) {
    console.error('getTopCountries: countries is not an array', typeof countries, countries);
    return [];
  }
  
  // 按访问量排序并取前5
  const typedCountries = countries as CountryMetric[];
  const sorted = typedCountries
    .filter((c) => c && c.x && c.y)
    .sort((a, b) => (b.y || 0) - (a.y || 0))
    .slice(0, 5)
    .map((c) => ({
      name: c.x || 'Unknown',
      value: c.y || 0,
    }));
  
  console.log('getTopCountries output:', JSON.stringify(sorted));
  return sorted;
}

// 分析购买漏斗
function analyzePurchaseFunnel(purchaseEvents: EventItem[], clickEvents: EventItem[]) {
  const clicks = clickEvents.length;
  const success = purchaseEvents.filter(e => e.eventName === 'setting.purchase.success').length;
  const failed = purchaseEvents.filter(e => e.eventName === 'setting.purchase.failed').length;
  const cancel = purchaseEvents.filter(e => e.eventName === 'setting.purchase.cancel').length;
  
  return {
    clicks,
    success,
    failed,
    cancel,
    conversionRate: clicks > 0 ? ((success / clicks) * 100).toFixed(2) : '0.00',
  };
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
      appLaunch,
      newUsers,
      dailyActive,
      vipUsers,
      annualVip,
      lifetimeVip,
      
      // 闹钟相关
      addAlarm,
      editAlarm,
      deleteAlarm,
      alarmTypes,
      
      // 购买相关
      purchaseMain,
      purchaseSetting,
      purchaseSuccess,
      purchaseFailed,
      purchaseCancel,
      clickAnnual,
      clickLifetime,
      
      // Onboarding
      onboardingAppear,
      onboardingSkip,
      onboardingComplete,
      
      // 其他
      showRating,
      iclickCloud,
      
      stats,
      prevStats,
      countries,
      
      // 30天趋势
      newUsers30d,
      activeUsers30d,
      purchases30d,
      revenueCatRevenue,
      revenueCatTransactions,
    ] = await Promise.all([
      getEvents(startAt, endAt, 'app.launch'),
      getEvents(startAt, endAt, 'new.user'),
      getEvents(startAt, endAt, 'user.daily.active'),
      getEvents(startAt, endAt, 'user.vip'),
      getEvents(startAt, endAt, 'user.annual.vip'),
      getEvents(startAt, endAt, 'user.lifetime.vip'),
      
      // 闹钟
      getEvents(startAt, endAt, 'alarm.add.click'),
      getEvents(startAt, endAt, 'alarm.edit'),
      getEvents(startAt, endAt, 'alarm.swipe.to.delete'),
      getEvents(startAt, endAt),
      
      // 购买
      getEvents(startAt, endAt, 'main.purchase.click'),
      getEvents(startAt, endAt, 'setting.purchase'),
      getEvents(startAt, endAt, 'setting.purchase.success'),
      getEvents(startAt, endAt, 'setting.purchase.failed'),
      getEvents(startAt, endAt, 'setting.purchase.cancel'),
      getEvents(startAt, endAt, 'setting.purchase.annual.click'),
      getEvents(startAt, endAt, 'setting.purchase.lifetime.click'),
      
      // Onboarding
      getEvents(startAt, endAt, 'onboarding.appear'),
      getEvents(startAt, endAt, 'onboarding.skip.click'),
      getEvents(startAt, endAt, 'onboarding.start.click'),
      
      // 其他
      getEvents(startAt, endAt, 'user.show.rating.popup'),
      getEvents(startAt, endAt, 'setting.icloud.click'),
      
      getStats(startAt, endAt),
      getStats(prevStartAt, prevEndAt),
      getCountries(startAt, endAt),
      
      // 30天趋势数据
      getEvents(now - 30 * 24 * 60 * 60 * 1000, now, 'new.user'),
      getEvents(now - 30 * 24 * 60 * 60 * 1000, now, 'user.daily.active'),
      getEvents(now - 30 * 24 * 60 * 60 * 1000, now, 'setting.purchase.success'),
      getRevenueCatRevenue(startAt, endAt).catch((error) => {
        console.error('RevenueCat revenue error:', error);
        console.error('RevenueCat error stack:', error instanceof Error ? error.stack : 'no stack');
        return { error: String(error), overview: null, chartsRevenue: null };
      }),
      getRevenueCatTransactions().catch((error) => {
        console.error('RevenueCat transactions error:', error);
        return { error: String(error), items: [] };
      }),
    ]);
    
    // 计算闹钟类型（从前面的所有事件中筛选）
    const alarmTypeEvents = alarmTypes.data?.filter((e: EventItem) => 
      e.eventName?.includes('alarm.add.')
    ) || [];
    
    const purchaseClickEvents = [
      ...(purchaseMain.data || []),
      ...(purchaseSetting.data || []),
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
    
    // Debug: log raw RevenueCat data
    console.log('Raw RevenueCat data:', {
      hasRevenueCatRevenue: !!revenueCatRevenue,
      hasRevenueCatTransactions: !!revenueCatTransactions,
      overview: revenueCatRevenue ? (revenueCatRevenue as Record<string, unknown>).overview : null,
    });
    
    const days = Math.ceil((endAt - startAt) / (24 * 60 * 60 * 1000));
    
    return NextResponse.json({
      summary: {
        // 用户指标
        appLaunches: appLaunch.data?.length || 0,
        newUsers: newUsers.data?.length || 0,
        newUsersChange: calculateChange(newUsers.data?.length || 0, prevNewUsers.data?.length || 0),
        activeUsers: dailyActive.data?.length || 0,
        visitors,
        visitorChange: calculateChange(visitors, prevVisitors),
        
        // VIP 用户
        vipUsers: vipUsers.data?.length || 0,
        annualVip: annualVip.data?.length || 0,
        lifetimeVip: lifetimeVip.data?.length || 0,
        
        // 核心功能：闹钟
        alarmsAdded: addAlarm.data?.length || 0,
        alarmsEdited: editAlarm.data?.length || 0,
        alarmsDeleted: deleteAlarm.data?.length || 0,
        
        // 购买漏斗
        purchaseFunnel: analyzePurchaseFunnel(allPurchaseEvents, purchaseClickEvents),
        
        // Onboarding
        onboarding: {
          appear: onboardingAppear.data?.length || 0,
          skip: onboardingSkip.data?.length || 0,
          complete: onboardingComplete.data?.length || 0,
          completionRate: onboardingAppear.data?.length > 0 
            ? ((onboardingComplete.data?.length || 0) / onboardingAppear.data?.length * 100).toFixed(1)
            : '0.0',
        },
        
        // 其他
        ratingShown: showRating.data?.length || 0,
        iclickCloud: iclickCloud.data?.length || 0,
        
        // 页面浏览
        pageviews: stats.pageviews?.value || stats.pageviews || 0,
        bounceRate: stats.bounces?.value || stats.bounces || 0,
        avgTime: stats.time?.value || stats.time || 0,
        
        // RevenueCat 指标（可选）
        mrr: revenueCatMetrics.mrr,
        totalRevenue: revenueCatMetrics.totalRevenue,
        activeSubscriptions: revenueCatMetrics.activeSubscriptions,
        trials: revenueCatMetrics.trials,
        churnRate: revenueCatMetrics.churnRate,
      },
      
      charts: {
        newUsers: getDailyData(newUsers.data || [], startAt, endAt),
        activeUsers: getDailyData(dailyActive.data || [], startAt, endAt),
        appLaunches: getDailyData(appLaunch.data || [], startAt, endAt),
        alarmsAdded: getDailyData(addAlarm.data || [], startAt, endAt),
        purchases: getDailyData(purchaseSuccess.data || [], startAt, endAt),
        trend30d: {
          newUsers: getDailyData(newUsers30d.data || [], now - 30 * 24 * 60 * 60 * 1000, now),
          activeUsers: getDailyData(activeUsers30d.data || [], now - 30 * 24 * 60 * 60 * 1000, now),
          purchases: getDailyData(purchases30d.data || [], now - 24 * 60 * 60 * 1000, now),
        }
      },
      
      breakdown: {
        alarmTypes: analyzeAlarmTypes(alarmTypeEvents),
        purchaseClicks: {
          annual: clickAnnual.data?.length || 0,
          lifetime: clickLifetime.data?.length || 0,
        },
        countries: getTopCountries(countries),
        debug: {
          countriesType: typeof countries,
          countriesData: countries,
          revenueCatRaw: revenueCatRevenue,
          revenueCatMetrics,
        }
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
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch Umami data';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
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
