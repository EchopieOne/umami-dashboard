import { NextResponse } from 'next/server';
import { kv } from '@vercel/kv';

const UMAMI_URL = (process.env.UMAMI_URL || 'https://ubm.echopie.com').trim();
const USERNAME = (process.env.UMAMI_USERNAME || 'admin').trim();
const PASSWORD = (process.env.UMAMI_PASSWORD || 'umami').trim();
const REVENUECAT_BASE_URL = 'https://api.revenuecat.com/v2';
const REVENUECAT_API_KEY = (process.env.REVENUECAT_API_KEY || '').trim();
const REVENUECAT_PROJECT_ID = (process.env.REVENUECAT_PROJECT_ID || '').trim();

const CACHE_TTL = 600; // 10分钟正常缓存
const STALE_TTL = 86400; // 24小时stale缓存
const memoryCache = new Map<string, { data: string; expiry: number }>();

let cachedToken: string | null = null;
let tokenExpiry = 0;

interface EventItem { eventName?: string; createdAt?: number; [key: string]: any; }

// 获取缓存（包括stale数据）
async function getCache(key: string): Promise<{ data: string; isStale: boolean } | null> {
  try {
    if (process.env.KV_REST_API_URL) {
      const data = await kv.get<string>(key);
      if (data) return { data, isStale: false };
      
      const staleData = await kv.get<string>(`${key}:stale`);
      if (staleData) return { data: staleData, isStale: true };
    }
  } catch {}
  
  const item = memoryCache.get(key);
  if (item && item.expiry > Date.now()) {
    return { data: item.data, isStale: false };
  }
  return null;
}

// 写入缓存（正常 + stale两份）
async function setCache(key: string, data: string) {
  try {
    if (process.env.KV_REST_API_URL) {
      // 正常缓存（10分钟）
      await kv.set(key, data, { ex: CACHE_TTL });
      // Stale缓存（24小时）
      await kv.set(`${key}:stale`, data, { ex: STALE_TTL });
      return;
    }
  } catch {}
  memoryCache.set(key, { data, expiry: Date.now() + CACHE_TTL * 1000 });
}

async function getToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && tokenExpiry > now) return cachedToken;
  const res = await fetch(`${UMAMI_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: USERNAME, password: PASSWORD }),
  });
  const data = await res.json();
  if (!data.token) throw new Error('Login failed');
  cachedToken = data.token;
  tokenExpiry = now + 55 * 60 * 1000;
  return cachedToken as string;
}

async function getWebsiteId(token: string) {
  const res = await fetch(`${UMAMI_URL}/api/websites`, { headers: { Authorization: `Bearer ${token}` } });
  const data = await res.json();
  return data.data[0].id;
}

async function getEvents(startAt: number, endAt: number, eventName?: string) {
  const token = await getToken();
  const websiteId = await getWebsiteId(token);
  const params = new URLSearchParams({ startAt: startAt.toString(), endAt: endAt.toString(), pageSize: '1000' });
  if (eventName) params.append('event', eventName);
  const res = await fetch(`${UMAMI_URL}/api/websites/${websiteId}/events?${params}`, { headers: { Authorization: `Bearer ${token}` } });
  return res.json();
}

async function getStats(startAt: number, endAt: number) {
  const token = await getToken();
  const websiteId = await getWebsiteId(token);
  const res = await fetch(`${UMAMI_URL}/api/websites/${websiteId}/stats?startAt=${startAt}&endAt=${endAt}`, { headers: { Authorization: `Bearer ${token}` } });
  return res.json();
}

async function getCountries(startAt: number, endAt: number) {
  const token = await getToken();
  const websiteId = await getWebsiteId(token);
  const res = await fetch(`${UMAMI_URL}/api/websites/${websiteId}/metrics?startAt=${startAt}&endAt=${endAt}&type=country`, { headers: { Authorization: `Bearer ${token}` } });
  return res.json();
}

async function getRevenueCatOverview() {
  if (!REVENUECAT_API_KEY) return null;
  const res = await fetch(`${REVENUECAT_BASE_URL}/projects/${REVENUECAT_PROJECT_ID}/metrics/overview`, { headers: { Authorization: `Bearer ${REVENUECAT_API_KEY}` } });
  if (!res.ok) return null;
  return res.json();
}

function getMetricValue(metrics: any[], id: string) {
  return metrics?.find((m) => m?.id === id)?.value || 0;
}

function formatDate(ts: number) {
  return new Date(ts).toISOString().split('T')[0];
}

function getDailyData(events: any[], startAt: number, endAt: number) {
  const daily: Record<string, number> = {};
  for (let d = new Date(startAt); d <= new Date(endAt); d.setDate(d.getDate() + 1)) {
    daily[formatDate(d.getTime())] = 0;
  }
  events?.forEach((e) => {
    if (e?.createdAt) {
      const date = formatDate(e.createdAt);
      if (daily[date] !== undefined) daily[date]++;
    }
  });
  return Object.entries(daily).map(([date, count]) => ({ date, count }));
}

function analyzeAlarmTypes(events: EventItem[]) {
  const types: Record<string, number> = { '一次性': 0, '每天': 0, '工作日': 0, '节假日': 0, '规律工作日': 0, '大小周': 0, '规律休息日': 0, '响一次': 0, '自定义': 0 };
  events?.forEach((e) => {
    const name = e?.eventName || '';
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
  return Object.entries(types).filter(([, v]) => v > 0).map(([name, value]) => ({ name, value, percentage: total > 0 ? Math.round((value / total) * 100) : 0 }));
}

// 后台更新数据的函数（不等待）
async function refreshDataInBackground(cacheKey: string, startAt: number, endAt: number, range: string) {
  try {
    console.log('[Background] Refreshing', cacheKey);
    const data = await fetchDataInternal(startAt, endAt, range);
    await setCache(cacheKey, JSON.stringify(data));
    console.log('[Background] Refreshed', cacheKey);
  } catch (e) {
    console.error('[Background] Failed', e);
  }
}

// 内部数据获取函数
async function fetchDataInternal(startAt: number, endAt: number, range: string) {
  const prevStartAt = startAt - (endAt - startAt);
  const prevEndAt = startAt;
  
  const [
    appLaunch, newUsers, dailyActive, vipUsers, annualVip, lifetimeVip,
    addAlarm, editAlarm, deleteAlarm, alarmTypes,
    purchaseMain, purchaseSetting, purchaseOnboarding, purchaseSuccess, purchaseFailed, purchaseCancel,
    clickAnnual, clickLifetime,
    onboardingAppear, onboardingSkip, onboardingComplete,
    stats, prevStats, countries, revenueCatOverview,
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
    getEvents(startAt, endAt, 'onboarding.appear'),
    getEvents(startAt, endAt, 'onboarding.skip.click'),
    getEvents(startAt, endAt, 'onboarding.start.click'),
    getStats(startAt, endAt),
    getStats(prevStartAt, prevEndAt),
    getCountries(startAt, endAt),
    getRevenueCatOverview().catch(() => null),
  ]);
  
  const alarmTypeEvents = alarmTypes.data?.filter((e: EventItem) => e?.eventName?.includes('alarm.add.')) || [];
  const purchaseClicks = [...(purchaseMain.data || []), ...(purchaseSetting.data || []), ...(purchaseOnboarding.data || [])];
  const prevNewUsers = await getEvents(prevStartAt, prevEndAt, 'new.user');
  
  const visitors = stats.visitors?.value || 0;
  const prevVisitors = prevStats.visitors?.value || 0;
  const activeUsers = dailyActive.data?.length || 0;
  const vipCount = vipUsers.data?.length || 0;
  const mrr = getMetricValue(revenueCatOverview?.metrics, 'mrr');
  const totalRevenue = getMetricValue(revenueCatOverview?.metrics, 'revenue');
  const subs = getMetricValue(revenueCatOverview?.metrics, 'active_subscriptions');
  const days = Math.ceil((endAt - startAt) / (24 * 60 * 60 * 1000));
  
  return {
    summary: {
      appLaunches: appLaunch.data?.length || 0,
      newUsers: newUsers.data?.length || 0,
      newUsersChange: prevNewUsers.data?.length ? Math.round(((newUsers.data?.length || 0) - prevNewUsers.data.length) / prevNewUsers.data.length * 100) : 0,
      activeUsers,
      visitors,
      visitorChange: prevVisitors ? Math.round(((visitors - prevVisitors) / prevVisitors) * 100) : 0,
      vipUsers: vipCount,
      annualVip: annualVip.data?.length || 0,
      lifetimeVip: lifetimeVip.data?.length || 0,
      alarmsAdded: addAlarm.data?.length || 0,
      alarmsEdited: editAlarm.data?.length || 0,
      alarmsDeleted: deleteAlarm.data?.length || 0,
      purchases: purchaseSuccess.data?.length || 0,
      pageviews: stats.pageviews?.value || 0,
      mrr,
      totalRevenue,
      activeSubscriptions: subs,
      trials: getMetricValue(revenueCatOverview?.metrics, 'active_trials'),
      churnRate: getMetricValue(revenueCatOverview?.metrics, 'churn_rate'),
      revenueHealth: {
        arpu: activeUsers > 0 ? totalRevenue / activeUsers : 0,
        arppu: vipCount > 0 ? totalRevenue / vipCount : 0,
        penetrationRate: activeUsers > 0 ? (vipCount / activeUsers) * 100 : 0,
        ltv: getMetricValue(revenueCatOverview?.metrics, 'churn_rate') > 0 ? (mrr * 12) / (getMetricValue(revenueCatOverview?.metrics, 'churn_rate') / 100) : mrr * 12,
      },
      alarmHealth: {
        avgAlarmsPerUser: activeUsers > 0 ? (addAlarm.data?.length || 0) / activeUsers : 0,
        editRate: (addAlarm.data?.length || 0) > 0 ? ((editAlarm.data?.length || 0) / addAlarm.data.length) * 100 : 0,
        deleteRate: (addAlarm.data?.length || 0) > 0 ? ((deleteAlarm.data?.length || 0) / addAlarm.data.length) * 100 : 0,
      },
      purchaseSource: [
        { source: '主页', clicks: purchaseMain.data?.length || 0, conversions: purchaseSuccess.data?.length || 0, conversionRate: (purchaseMain.data?.length || 0) > 0 ? Math.round(((purchaseSuccess.data?.length || 0) / purchaseMain.data.length) * 100) : 0 },
        { source: '设置页', clicks: purchaseSetting.data?.length || 0, conversions: purchaseSuccess.data?.length || 0, conversionRate: (purchaseSetting.data?.length || 0) > 0 ? Math.round(((purchaseSuccess.data?.length || 0) / purchaseSetting.data.length) * 100) : 0 },
        { source: 'Onboarding', clicks: purchaseOnboarding.data?.length || 0, conversions: purchaseSuccess.data?.length || 0, conversionRate: 0 },
      ],
      purchaseFunnel: {
        clicks: purchaseClicks.length,
        success: purchaseSuccess.data?.length || 0,
        failed: purchaseFailed.data?.length || 0,
        cancel: purchaseCancel.data?.length || 0,
        conversionRate: purchaseClicks.length > 0 ? ((purchaseSuccess.data?.length || 0) / purchaseClicks.length * 100).toFixed(1) : '0.0',
      },
      onboarding: {
        appear: onboardingAppear.data?.length || 0,
        skip: onboardingSkip.data?.length || 0,
        complete: onboardingComplete.data?.length || 0,
        completionRate: (onboardingAppear.data?.length || 0) > 0 ? (((onboardingComplete.data?.length || 0) / onboardingAppear.data.length) * 100).toFixed(1) : '0.0',
      },
    },
    charts: {
      newUsers: getDailyData(newUsers.data || [], startAt, endAt),
      activeUsers: getDailyData(dailyActive.data || [], startAt, endAt),
      appLaunches: getDailyData(appLaunch.data || [], startAt, endAt),
      alarmsAdded: getDailyData(addAlarm.data || [], startAt, endAt),
      purchases: getDailyData(purchaseSuccess.data || [], startAt, endAt),
    },
    breakdown: {
      alarmTypes: analyzeAlarmTypes(alarmTypeEvents),
      purchaseClicks: { annual: clickAnnual.data?.length || 0, lifetime: clickLifetime.data?.length || 0, main: purchaseMain.data?.length || 0, setting: purchaseSetting.data?.length || 0, onboarding: purchaseOnboarding.data?.length || 0 },
      countries: (countries || []).filter((c: any) => c?.x && c?.y).sort((a: any, b: any) => (b.y || 0) - (a.y || 0)).slice(0, 5).map((c: any) => ({ name: c.x, value: c.y })),
      transactions: [],
    },
    range: { startAt, endAt, days, label: `过去 ${days} 天` },
  };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const range = searchParams.get('range') || '7';
    const customStart = searchParams.get('startAt');
    const customEnd = searchParams.get('endAt');
    const cacheKey = `dashboard:${range}${customStart ? `:${customStart}` : ''}`;
    
    // 尝试读取缓存（包括 stale 数据）
    const cached = await getCache(cacheKey);
    
    // 计算时间范围
    const now = Date.now();
    let startAt: number, endAt: number, label: string;
    
    switch (range) {
      case '24h':
        startAt = now - 24 * 60 * 60 * 1000;
        endAt = now;
        label = '过去 24 小时';
        break;
      case 'today':
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        startAt = today.getTime();
        endAt = now;
        label = '今天';
        break;
      case 'week':
        const weekStart = new Date();
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        weekStart.setHours(0, 0, 0, 0);
        startAt = weekStart.getTime();
        endAt = now;
        label = '本周';
        break;
      case 'month':
        const monthStart = new Date();
        monthStart.setDate(1);
        monthStart.setHours(0, 0, 0, 0);
        startAt = monthStart.getTime();
        endAt = now;
        label = '本月';
        break;
      default:
        if (customStart && customEnd) {
          startAt = parseInt(customStart);
          endAt = parseInt(customEnd);
          label = '自定义范围';
        } else {
          const days = parseInt(range) || 7;
          startAt = now - days * 24 * 60 * 60 * 1000;
          endAt = now;
          label = `过去 ${days} 天`;
        }
    }
    
    // 策略：
    // 1. 如果有新鲜缓存，直接返回
    // 2. 如果有 stale 缓存，返回它并后台刷新
    // 3. 如果没有缓存，等待获取新数据
    
    if (cached && !cached.isStale) {
      // 新鲜缓存，直接返回
      console.log('Cache hit (fresh)', cacheKey);
      return NextResponse.json(JSON.parse(cached.data));
    }
    
    if (cached?.isStale) {
      // Stale 缓存，先返回，后台刷新
      console.log('Cache hit (stale), refreshing in background', cacheKey);
      refreshDataInBackground(cacheKey, startAt, endAt, range);
      return NextResponse.json(JSON.parse(cached.data));
    }
    
    // 没有缓存，必须等待
    console.log('Cache miss, fetching data', cacheKey);
    const data = await fetchDataInternal(startAt, endAt, range);
    await setCache(cacheKey, JSON.stringify(data));
    return NextResponse.json(data);
    
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed' }, { status: 500 });
  }
}
