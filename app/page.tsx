'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Funnel,
  FunnelChart,
  LabelList,
} from 'recharts';
import { 
  Calendar, 
  Users, 
  ShoppingCart, 
  TrendingUp, 
  Loader2, 
  RefreshCw, 
  Bell,
  Crown,
  GraduationCap,
  Star,
  Cloud,
  Smartphone,
  AlertCircle
} from 'lucide-react';
import { DateRangePicker } from '@/components/date-range-picker';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface PurchaseFunnel {
  clicks: number;
  success: number;
  failed: number;
  cancel: number;
  conversionRate: string;
}

interface Onboarding {
  appear: number;
  skip: number;
  complete: number;
  completionRate: string;
}

interface SummaryData {
  appLaunches: number;
  newUsers: number;
  newUsersChange: number;
  activeUsers: number;
  visitors: number;
  visitorChange: number;
  vipUsers: number;
  annualVip: number;
  lifetimeVip: number;
  alarmsAdded: number;
  alarmsEdited: number;
  alarmsDeleted: number;
  purchaseFunnel: PurchaseFunnel;
  onboarding: Onboarding;
  ratingShown: number;
  iclickCloud: number;
  pageviews: number;
  bounceRate: number;
  avgTime: number;
}

interface ChartData {
  date: string;
  count: number;
}

interface BreakdownData {
  alarmTypes: { name: string; value: number }[];
  purchaseClicks: { annual: number; lifetime: number };
}

interface RangeData {
  startAt: number;
  endAt: number;
  days: number;
  label: string;
}

interface DataResponse {
  summary: SummaryData;
  charts: {
    newUsers: ChartData[];
    activeUsers: ChartData[];
    appLaunches: ChartData[];
    alarmsAdded: ChartData[];
    purchases: ChartData[];
  };
  breakdown: BreakdownData;
  range: RangeData;
}

interface TimeRange {
  range: string;
  startAt?: number;
  endAt?: number;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6'];

function MetricCardSkeleton() {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-8 w-16" />
          </div>
          <Skeleton className="h-12 w-12 rounded-lg" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const [data, setData] = useState<DataResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<TimeRange>({ range: '7' });
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      let url = `/api/umami?range=${timeRange.range}`;
      if (timeRange.startAt && timeRange.endAt) {
        url += `&startAt=${timeRange.startAt}&endAt=${timeRange.endAt}`;
      }
      
      const res = await fetch(url);
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${res.status}`);
      }
      
      const json: DataResponse = await res.json();
      setData(json);
    } catch (err) {
      console.error('Failed to fetch data:', err);
      setError(err instanceof Error ? err.message : '加载数据失败');
    } finally {
      setLoading(false);
    }
  }, [timeRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <Button onClick={fetchData} className="mt-4">重试</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <Bell className="w-7 h-7 sm:w-8 sm:h-8 text-blue-600" />
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">AlarmOne 数据仪表盘</h1>
            </div>
            {data && (
              <p className="text-gray-500 mt-1 text-sm">
                {data.range.label} • {data.summary.visitors.toLocaleString()} 访客
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <DateRangePicker value={timeRange} onChange={setTimeRange} />
            <Button 
              variant="outline" 
              size="icon" 
              onClick={fetchData}
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* 核心指标卡片 */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
          {loading ? (
            <>
              <MetricCardSkeleton />
              <MetricCardSkeleton />
              <MetricCardSkeleton />
              <MetricCardSkeleton />
            </>
          ) : data ? (
            <>
              <MetricCard
                title="App 启动"
                value={data.summary.appLaunches.toLocaleString()}
                icon={Smartphone}
                color="blue"
                trend={data.summary.visitorChange}
              />
              <MetricCard
                title="新用户"
                value={data.summary.newUsers.toLocaleString()}
                icon={Users}
                color="green"
                trend={data.summary.newUsersChange}
              />
              <MetricCard
                title="VIP 用户"
                value={data.summary.vipUsers}
                icon={Crown}
                color="amber"
                subtitle={`年度 ${data.summary.annualVip} / 终身 ${data.summary.lifetimeVip}`}
              />
              <MetricCard
                title="购买转化"
                value={`${data.summary.purchaseFunnel.conversionRate}%`}
                icon={ShoppingCart}
                color="purple"
                subtitle={`${data.summary.purchaseFunnel.success} 单成功`}
              />
            </>
          ) : null}
        </div>

        {/* 核心功能：闹钟 */}
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Bell className="w-5 h-5" /
              核心功能：闹钟管理
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading || !data ? (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  {[1,2,3].map(i => <Skeleton key={i} className="h-24" />)}
                </div>
                <Skeleton className="h-64" />
              </div>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-6">
                  <div className="text-center p-3 sm:p-4 bg-blue-50 rounded-lg">
                    <p className="text-xs sm:text-sm text-gray-500">新增闹钟</p>
                    <p className="text-2xl sm:text-3xl font-bold text-blue-600">{data.summary.alarmsAdded}</p>
                  </div>
                  <div className="text-center p-3 sm:p-4 bg-amber-50 rounded-lg">
                    <p className="text-xs sm:text-sm text-gray-500">编辑闹钟</p>
                    <p className="text-2xl sm:text-3xl font-bold text-amber-600">{data.summary.alarmsEdited}</p>
                  </div>
                  <div className="text-center p-3 sm:p-4 bg-red-50 rounded-lg">
                    <p className="text-xs sm:text-sm text-gray-500">删除闹钟</p>
                    <p className="text-2xl sm:text-3xl font-bold text-red-600">{data.summary.alarmsDeleted}</p>
                  </div>
                </div>
                
                {data.breakdown.alarmTypes.length > 0 && (
                  <div className="h-48 sm:h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.breakdown.alarmTypes} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" />
                        <YAxis dataKey="name" type="category" width={80} style={{ fontSize: 12 }} />
                        <Tooltip />
                        <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* 转化漏斗 + Onboarding */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <ShoppingCart className="w-5 h-5" /
                购买转化漏斗
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading || !data ? (
                <Skeleton className="h-64" />
              ) : (
                <>
                  <div className="h-48 sm:h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <FunnelChart>
                        <Tooltip />
                        <Funnel
                          dataKey="value"
                          data={[
                            { name: '点击购买', value: data.summary.purchaseFunnel.clicks, fill: '#3b82f6' },
                            { name: '购买成功', value: data.summary.purchaseFunnel.success, fill: '#10b981' },
                          ]}
                          isAnimationActive
                        >
                          <LabelList position="inside" fill="#fff" stroke="none" />
                        </Funnel>
                      </FunnelChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                    <div className="p-2 bg-gray-50 rounded">
                      <p className="text-xs text-gray-500">失败</p>
                      <p className="text-lg font-semibold text-red-600">{data.summary.purchaseFunnel.failed}</p>
                    </div>
                    <div className="p-2 bg-gray-50 rounded">
                      <p className="text-xs text-gray-500">取消</p>
                      <p className="text-lg font-semibold text-amber-600">{data.summary.purchaseFunnel.cancel}</p>
                    </div>
                    <div className="p-2 bg-gray-50 rounded">
                      <p className="text-xs text-gray-500">转化率</p>
                      <p className="text-lg font-semibold text-blue-600">{data.summary.purchaseFunnel.conversionRate}%</p>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <GraduationCap className="w-5 h-5" /
                新用户引导
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading || !data ? (
                <div className="space-y-4">
                  {[1,2,3,4].map(i => <Skeleton key={i} className="h-12" />)}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                    <span className="text-sm">展示引导</span>
                    <span className="font-bold">{data.summary.onboarding.appear}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-red-50 rounded">
                    <span className="text-sm">跳过引导</span>
                    <span className="font-bold text-red-600">{data.summary.onboarding.skip}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-green-50 rounded">
                    <span className="text-sm">完成引导</span>
                    <span className="font-bold text-green-600">{data.summary.onboarding.complete}</span>
                  </div>
                  <div className="p-4 bg-blue-50 rounded text-center">
                    <p className="text-sm text-gray-600">引导完成率</p>
                    <p className="text-3xl font-bold text-blue-600">{data.summary.onboarding.completionRate}%</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 趋势图表 */}
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">数据趋势</CardTitle>
          </CardHeader>
          <CardContent>
            {loading || !data ? (
              <Skeleton className="h-64 sm:h-80" />
            ) : (
              <div className="h-64 sm:h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.charts.appLaunches}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={(v) => new Date(v).toLocaleDateString('zh-CN', {month: 'short', day: 'numeric'})}
                      style={{ fontSize: 12 }}
                    />
                    <YAxis style={{ fontSize: 12 }} />
                    <Tooltip 
                      labelFormatter={(v) => new Date(v).toLocaleDateString('zh-CN')}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="count" 
                      name="App启动" 
                      stroke="#3b82f6" 
                      strokeWidth={2} 
                      dot={false}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 其他指标 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          {loading || !data ? (
            [1,2,3,4].map(i => <Skeleton key={i} className="h-16" />)
          ) : (
            <>
              <MiniStat title="评分弹窗" value={data.summary.ratingShown} icon={Star} />
              <MiniStat title="iCloud点击" value={data.summary.iclickCloud} icon={Cloud} />
              <MiniStat title="年度点击" value={data.summary.purchaseFunnel.clicks} icon={Crown} />
              <MiniStat title="终身点击" value={data.summary.purchaseFunnel.clicks} icon={Crown} />
            </>
          )}
        </div>

        <div className="mt-8 text-center text-sm text-gray-400">
          AlarmOne Analytics • https://echopie.com
        </div>
      </div>
    </div>
  );
}

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  color: 'blue' | 'green' | 'amber' | 'purple';
  trend?: number;
  subtitle?: string;
}

function MetricCard({ title, value, icon: Icon, color, trend, subtitle }: MetricCardProps) {
  const colors = {
    blue: 'bg-blue-100 text-blue-600',
    green: 'bg-green-100 text-green-600',
    amber: 'bg-amber-100 text-amber-600',
    purple: 'bg-purple-100 text-purple-600',
  };

  return (
    <Card>
      <CardContent className="p-4 sm:p-6">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-xs sm:text-sm font-medium text-gray-500 truncate">{title}</p>
            <p className="text-xl sm:text-3xl font-bold text-gray-900 mt-1 truncate">{value}</p>
            {trend !== undefined && (
              <div className="flex items-center gap-1 mt-1">
                <TrendingUp className={`w-3 h-3 sm:w-4 sm:h-4 ${trend >= 0 ? 'text-green-500' : 'text-red-500'}`} />
                <span className={`text-xs sm:text-sm font-medium ${trend >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {trend >= 0 ? '+' : ''}{trend}%
                </span>
              </div>
            )}
            {subtitle && <p className="text-xs text-gray-400 mt-1 truncate">{subtitle}</p>}
          </div>
          <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-lg flex items-center justify-center flex-shrink-0 ${colors[color]}`}>
            <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface MiniStatProps {
  title: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
}

function MiniStat({ title, value, icon: Icon }: MiniStatProps) {
  return (
    <div className="bg-white rounded-lg p-3 sm:p-4 shadow-sm flex items-center gap-2 sm:gap-3">
      <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
        <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 truncate">{title}</p>
        <p className="text-lg sm:text-xl font-bold truncate">{value}</p>
      </div>
    </div>
  );
}
