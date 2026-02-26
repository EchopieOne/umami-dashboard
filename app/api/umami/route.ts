import { NextResponse } from 'next/server';

const UMAMI_URL = (process.env.UMAMI_URL || 'https://ubm.echopie.com').trim();
const USERNAME = (process.env.UMAMI_USERNAME || 'admin').trim();
const PASSWORD = (process.env.UMAMI_PASSWORD || 'umami').trim();

let cachedToken: string | null = null;
let cachedWebsiteId: string | null = null;

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

function getDailyData(events: any[] | undefined, startAt: number, endAt: number) {
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
function analyzeAlarmTypes(events: any[] | undefined) {
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
    .filter(([_, count]) => count > 0)
    .map(([name, value]) => ({ name, value }));
}

// 获取国家分布前5名
function getTopCountries(countries: any[] | undefined) {
  if (!Array.isArray(countries)) {
    console.error('getTopCountries: countries is not an array', countries);
    return [];
  }
  
  // 按访问量排序并取前5
  const sorted = countries
    .filter((c: any) => c && c.x && c.y)
    .sort((a: any, b: any) => (b.y || 0) - (a.y || 0))
    .slice(0, 5)
    .map((c: any) => ({
      name: c.x || 'Unknown',
      value: c.y || 0,
    }));
  
  return sorted;
}

// 分析购买漏斗
function analyzePurchaseFunnel(purchaseEvents: any[], clickEvents: any[]) {
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
    ]);
    
    // 计算闹钟类型（从前面的所有事件中筛选）
    const alarmTypeEvents = alarmTypes.data?.filter((e: any) => 
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
        countries: getTopCountries(countries.data || []),
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
