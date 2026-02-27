import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

const UMAMI_URL = (process.env.UMAMI_URL || 'https://ubm.echopie.com').trim();
const USERNAME = (process.env.UMAMI_USERNAME || 'admin').trim();
const PASSWORD = (process.env.UMAMI_PASSWORD || 'umami').trim();
const REVENUECAT_BASE_URL = 'https://api.revenuecat.com/v2';
const REVENUECAT_API_KEY = (process.env.REVENUECAT_API_KEY || '').trim();
const REVENUECAT_PROJECT_ID = (process.env.REVENUECAT_PROJECT_ID || '').trim();

// Upstash Redis 缓存
const redis = Redis.fromEnv();
const CACHE_TTL = 300; // 5分钟缓存

// Umami 登录缓存
let cachedToken: string | null = null;
let tokenExpiry = 0;

// 简化接口
interface EventItem { eventName?: string; createdAt?: number; }

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

async function getWebsiteId(token: string): Promise<string> {
  const res = await fetch(`${UMAMI_URL}/api/websites`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  return data.data[0].id;
}

async function getEvents(startAt: number, endAt: number, eventName?: string) {
  const token = await getToken();
  const websiteId = await getWebsiteId(token);
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
  const websiteId = await getWebsiteId(token);
  const params = new URLSearchParams({ startAt: startAt.toString(), endAt: endAt.toString() });
  
  const res = await fetch(
    `${UMAMI_URL}/api/websites/${websiteId}/stats?${params}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return res.json();
}

async function getCountries(startAt: number, endAt: number) {
  const token = await getToken();
  const websiteId = await getWebsiteId(token);
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

async function getRevenueCatOverview() {
  if (!REVENUECAT_API_KEY || !REVENUECAT_PROJECT_ID) return null;
  
  const res = await fetch(
    `${REVENUECAT_BASE_URL}/projects/${REVENUECAT_PROJECT_ID}/metrics/overview`,
    { 
      headers: { Authorization: `Bearer ${REVENUECAT_API_KEY}` },
      cache: 'no-store' 
    }
  );
  
  if (!res.ok) return null;
  return res.json();
}

function getMetricValue(metrics: any[], id: string): number {
  if (!Array.isArray(metrics)) return 0;
  const metric = metrics.find((m) => m?.id === id);
  return typeof metric?.value === 'number' ? metric.value : 0;
}

function formatDate(ts: number): string {
  return new Date(ts).toISOString().split('T')[0];
}

function getDailyData(events: EventItem[] | undefined, startAt: number, endAt: number) {
  if (!Array.isArray(events)) return [];
  
  const daily: Record<string, number> = {};
  const start = new Date(startAt);
  const end = new Date(endAt);
  
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    daily[formatDate(d.getTime())] = 0;
  }
  
  events.forEach((e) => {
    if (e?.createdAt) {
      const date = formatDate(e.createdAt);
      if (daily[date] !== undefined) daily[date]++;
    }
  });
  
  return Object.entries(daily).map(([date, count]) => ({ date, count }));
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const range = searchParams.get('range') || '7';
    const cacheKey = `dashboard:${range}`;
    
    // 尝试从缓存读取
    const cached = await redis.get<string>(cacheKey);
    if (cached) {
      console.log('Cache hit for', cacheKey);
      return NextResponse.json(JSON.parse(cached));
    }
    
    // 计算时间范围
    const now = Date.now();
    const days = parseInt(range) || 7;
    const endAt = now;
    const startAt = now - days * 24 * 60 * 60 * 1000;
    const prevStartAt = startAt - (endAt - startAt);
    const prevEndAt = startAt;
    
    // 并行获取数据
    const [
      appLaunch,
      newUsers,
      dailyActive,
      addAlarm,
      purchaseSuccess,
      stats,
      prevStats,
      countries,
      revenueCatOverview,
    ] = await Promise.all([
      getEvents(startAt, endAt, 'app.launch'),
      getEvents(startAt, endAt, 'new.user'),
      getEvents(startAt, endAt, 'user.daily.active'),
      getEvents(startAt, endAt, 'alarm.add.click'),
      getEvents(startAt, endAt, 'setting.purchase.success'),
      getStats(startAt, endAt),
      getStats(prevStartAt, prevEndAt),
      getCountries(startAt, endAt),
      getRevenueCatOverview().catch(() => null),
    ]);
    
    // 计算指标
    const visitors = stats.visitors?.value || stats.visitors || 0;
    const prevVisitors = prevStats.visitors?.value || prevStats.visitors || 0;
    const activeUsers = dailyActive.data?.length || 0;
    const newUserCount = newUsers.data?.length || 0;
    const prevNewUsers = await getEvents(prevStartAt, prevEndAt, 'new.user');
    
    const rcMetrics = revenueCatOverview?.metrics || [];
    const mrr = getMetricValue(rcMetrics, 'mrr');
    const totalRevenue = getMetricValue(rcMetrics, 'revenue');
    
    const data = {
      summary: {
        appLaunches: appLaunch.data?.length || 0,
        newUsers: newUserCount,
        newUsersChange: prevNewUsers.data?.length ? Math.round(((newUserCount - prevNewUsers.data.length) / prevNewUsers.data.length) * 100) : 0,
        activeUsers,
        visitors,
        visitorChange: prevVisitors ? Math.round(((visitors - prevVisitors) / prevVisitors) * 100) : 0,
        alarmsAdded: addAlarm.data?.length || 0,
        purchases: purchaseSuccess.data?.length || 0,
        pageviews: stats.pageviews?.value || stats.pageviews || 0,
        mrr,
        totalRevenue,
        activeSubscriptions: getMetricValue(rcMetrics, 'active_subscriptions'),
        trials: getMetricValue(rcMetrics, 'active_trials'),
        churnRate: getMetricValue(rcMetrics, 'churn_rate'),
      },
      charts: {
        newUsers: getDailyData(newUsers.data || [], startAt, endAt),
        activeUsers: getDailyData(dailyActive.data || [], startAt, endAt),
        appLaunches: getDailyData(appLaunch.data || [], startAt, endAt),
        alarmsAdded: getDailyData(addAlarm.data || [], startAt, endAt),
        purchases: getDailyData(purchaseSuccess.data || [], startAt, endAt),
      },
      breakdown: {
        countries: (countries || [])
          .filter((c: any) => c?.x && c?.y)
          .sort((a: any, b: any) => (b.y || 0) - (a.y || 0))
          .slice(0, 5)
          .map((c: any) => ({ name: c.x, value: c.y })),
      },
      range: {
        startAt,
        endAt,
        days,
        label: `过去 ${days} 天`,
      },
    };
    
    // 写入缓存
    await redis.set(cacheKey, JSON.stringify(data), { ex: CACHE_TTL });
    console.log('Cache set for', cacheKey);
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch data' },
      { status: 500 }
    );
  }
}
