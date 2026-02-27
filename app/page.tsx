'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Funnel, FunnelChart, LabelList, PieChart, Pie, Cell, AreaChart, Area,
} from 'recharts';
import { 
  Users, ShoppingCart, TrendingUp, RefreshCw, Bell, Crown, GraduationCap, Star,
  Cloud, Smartphone, AlertCircle, Globe, DollarSign, Target, Activity, Clock,
  MapPin, MousePointer, Percent, Wallet, Zap, TrendingDown,
} from 'lucide-react';
import { DateRangePicker } from '@/components/date-range-picker';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// ... 所有接口定义与之前相同 ...

interface PurchaseFunnel {
  viewPricing: number;
  clickPurchase: number;
  startPayment: number;
  success: number;
  failed: number;
  cancel: number;
  steps: { name: string; value: number; dropOff: number }[];
}

interface PurchaseSource {
  source: string;
  clicks: number;
  conversions: number;
  conversionRate: number;
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

interface RetentionData {
  day1: number;
  day7: number;
  day30: number;
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
  purchaseSource: PurchaseSource[];
  onboarding: { appear: number; skip: number; complete: number; completionRate: string };
  ratingShown: number;
  iclickCloud: number;
  pageviews: number;
  bounceRate: number;
  avgTime: number;
  mrr: number;
  totalRevenue: number;
  activeSubscriptions: number;
  trials: number;
  churnRate: number;
  revenueHealth: RevenueHealth;
  alarmHealth: AlarmHealth;
  retention: RetentionData;
}

interface ChartData {
  date: string;
  count: number;
}

interface Transaction {
  id: string;
  type: string;
  store: string;
  price: number;
  currency: string;
  productId: string;
  subscriberId: string;
  country?: string;
  appUserId?: string;
  isTrial: boolean;
  cancellationReason?: string;
  createdAt: string;
  customAttributes?: Record<string, any>;
}

interface BreakdownData {
  alarmTypes: { name: string; value: number; percentage: number }[];
  purchaseClicks: { annual: number; lifetime: number; main: number; setting: number; onboarding: number };
  countries: { name: string; value: number }[];
  cities: { name: string; value: number }[];
  transactions: Transaction[];
}

interface DataResponse {
  summary: SummaryData;
  charts: {
    newUsers: ChartData[];
    activeUsers: ChartData[];
    appLaunches: ChartData[];
    alarmsAdded: ChartData[];
    purchases: ChartData[];
    trend30d: { newUsers: ChartData[]; activeUsers: ChartData[]; purchases: ChartData[] };
  };
  breakdown: BreakdownData;
  range: { startAt: number; endAt: number; days: number; label: string };
}

interface TimeRange {
  range: string;
  startAt?: number;
  endAt?: number;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value || 0);
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

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
            <Button variant="outline" size="icon" onClick={fetchData} disabled={loading}>
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-flex">
            <TabsTrigger value="overview">总览</TabsTrigger>
            <TabsTrigger value="revenue">收入</TabsTrigger>
            <TabsTrigger value="engagement">功能</TabsTrigger>
            <TabsTrigger value="funnel">漏斗</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* 核心指标 */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
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
                    title="活跃用户"
                    value={data.summary.activeUsers.toLocaleString()}
                    icon={Users}
                    color="green"
                  />
                  <MetricCard
                    title="新用户"
                    value={data.summary.newUsers.toLocaleString()}
                    icon={TrendingUp}
                    color="amber"
                    trend={data.summary.newUsersChange}
                  />
                  <MetricCard
                    title="VIP 用户"
                    value={data.summary.vipUsers}
                    icon={Crown}
                    color="purple"
                    subtitle={`渗透率 ${data.summary.revenueHealth.penetrationRate.toFixed(1)}%`}
                  />
                </>
              ) : null}
            </div>

            {/* 留存指标 */}
            {data && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Target className="w-5 h-5" />
                    用户留存率
                  </CardTitle>
                  <CardDescription>新增用户在后续时间的活跃比例</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4">
                    <RetentionCard label="1日留存" value={data.summary.retention.day1} />
                    <RetentionCard label="7日留存" value={data.summary.retention.day7} />
                    <RetentionCard label="30日留存" value={data.summary.retention.day30} />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 趋势图 */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">30天趋势</CardTitle>
              </CardHeader>
              <CardContent>
                {loading || !data ? (
                  <Skeleton className="h-80" />
                ) : (
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={data.charts.trend30d.newUsers.map((item, idx) => ({
                        date: item.date,
                        新用户: item.count,
                        活跃用户: data.charts.trend30d.activeUsers[idx]?.count || 0,
                        购买: data.charts.trend30d.purchases[idx]?.count || 0,
                      }))}>
                        <defs>
                          <linearGradient id="colorNew" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="colorActive" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis 
                          dataKey="date" 
                          tickFormatter={(v) => new Date(v).toLocaleDateString('zh-CN', {month: 'short', day: 'numeric'})}
                          style={{ fontSize: 11 }}
                        />
                        <YAxis style={{ fontSize: 12 }} />
                        <Tooltip labelFormatter={(v) => new Date(v).toLocaleDateString('zh-CN')} />
                        <Area type="monotone" dataKey="新用户" stroke="#3b82f6" fillOpacity={1} fill="url(#colorNew)" />
                        <Area type="monotone" dataKey="活跃用户" stroke="#10b981" fillOpacity={1} fill="url(#colorActive)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Revenue Tab */}
          <TabsContent value="revenue" className="space-y-6">
            {/* 收入健康指标 */}
            {data && (
              <>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                  <MetricCard
                    title="MRR"
                    value={formatCurrency(data.summary.mrr)}
                    icon={DollarSign}
                    color="green"
                  />
                  <MetricCard
                    title="ARPU"
                    value={formatCurrency(data.summary.revenueHealth.arpu)}
                    icon={Users}
                    color="blue"
                    subtitle="每用户平均收入"
                  />
                  <MetricCard
                    title="ARPPU"
                    value={formatCurrency(data.summary.revenueHealth.arppu)}
                    icon={Crown}
                    color="purple"
                    subtitle="每付费用户收入"
                  />
                  <MetricCard
                    title="LTV"
                    value={formatCurrency(data.summary.revenueHealth.ltv)}
                    icon={Wallet}
                    color="amber"
                    subtitle="用户生命周期价值"
                  />
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                  <MetricCard
                    title="总收入"
                    value={formatCurrency(data.summary.totalRevenue)}
                    icon={TrendingUp}
                    color="blue"
                  />
                  <MetricCard
                    title="活跃订阅"
                    value={data.summary.activeSubscriptions.toString()}
                    icon={Zap}
                    color="green"
                  />
                  <MetricCard
                    title="试用中"
                    value={data.summary.trials.toString()}
                    icon={Clock}
                    color="amber"
                  />
                  <MetricCard
                    title="流失率"
                    value={`${data.summary.churnRate.toFixed(2)}%`}
                    icon={TrendingDown}
                    color={data.summary.churnRate > 5 ? "red" : "green"}
                  />
                  <MetricCard
                    title="付费渗透率"
                    value={`${data.summary.revenueHealth.penetrationRate.toFixed(2)}%`}
                    icon={Percent}
                    color="purple"
                  />
                  <MetricCard
                    title="年度/终身"
                    value={`${data.summary.annualVip}/${data.summary.lifetimeVip}`}
                    icon={Target}
                    color="blue"
                    subtitle="订阅分布"
                  />
                </div>

                {/* 购买来源分析 */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <MousePointer className="w-5 h-5" />
                      购买来源分析
                    </CardTitle>
                    <CardDescription>用户从哪个入口发起购买</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={data.summary.purchaseSource}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={100}
                              paddingAngle={5}
                              dataKey="clicks"
                              nameKey="source"
                            >
                              {data.summary.purchaseSource.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="space-y-3">
                        {data.summary.purchaseSource.map((source, index) => (
                          <div key={source.source} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div className="flex items-center gap-3">
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: COLORS[index % COLORS.length] }}
                              />
                              <span className="font-medium">{source.source}</span>
                            </div>
                            <div className="text-right">
                              <div className="font-bold">{source.clicks} 点击</div>
                              <div className="text-sm text-gray-500">转化率 {source.conversionRate}%</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* 交易明细列表 */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <ShoppingCart className="w-5 h-5" />
                      交易明细
                      <span className="text-sm font-normal text-gray-500 ml-2">
                        ({data.breakdown.transactions?.length || 0} 笔)
                      </span>
                    </CardTitle>
                    <CardDescription>RevenueCat 实时交易数据</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {data.breakdown.transactions?.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-3 py-2 text-left font-medium text-gray-600">时间</th>
                              <th className="px-3 py-2 text-left font-medium text-gray-600">类型</th>
                              <th className="px-3 py-2 text-left font-medium text-gray-600">商店</th>
                              <th className="px-3 py-2 text-right font-medium text-gray-600">金额</th>
                              <th className="px-3 py-2 text-left font-medium text-gray-600">国家</th>
                              <th className="px-3 py-2 text-center font-medium text-gray-600">试用</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {data.breakdown.transactions.slice(0, 20).map((tx) => (
                              <tr key={tx.id} className="hover:bg-gray-50">
                                <td className="px-3 py-2 text-gray-600">
                                  {new Date(tx.createdAt).toLocaleDateString('zh-CN')}
                                </td>
                                <td className="px-3 py-2">
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                    tx.type === 'INITIAL_PURCHASE' ? 'bg-green-100 text-green-800' :
                                    tx.type === 'RENEWAL' ? 'bg-blue-100 text-blue-800' :
                                    tx.type === 'CANCELLATION' ? 'bg-red-100 text-red-800' :
                                    'bg-gray-100 text-gray-800'
                                  }`}>
                                    {tx.type === 'INITIAL_PURCHASE' ? '首次购买' :
                                     tx.type === 'RENEWAL' ? '续订' :
                                     tx.type === 'CANCELLATION' ? '取消' :
                                     tx.type === 'REFUND' ? '退款' : tx.type}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-gray-600">
                                  {tx.store === 'app_store' ? 'App Store' :
                                   tx.store === 'play_store' ? 'Play Store' : tx.store}
                                </td>
                                <td className="px-3 py-2 text-right font-medium">
                                  {new Intl.NumberFormat('en-US', {
                                    style: 'currency',
                                    currency: tx.currency || 'USD'
                                  }).format(tx.price)}
                                </td>
                                <td className="px-3 py-2 text-gray-600">
                                  {tx.country || '-'}
                                </td>
                                <td className="px-3 py-2 text-center">
                                  {tx.isTrial ? (
                                    <span className="text-amber-600 font-medium">是</span>
                                  ) : (
                                    <span className="text-gray-400">-</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {data.breakdown.transactions.length > 20 && (
                          <p className="text-center text-sm text-gray-500 mt-4">
                            还有 {data.breakdown.transactions.length - 20} 笔交易...
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        <ShoppingCart className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                        <p>暂无交易数据</p>
                        <p className="text-sm text-gray-400 mt-1">可能由于权限不足或所选时间范围内无交易</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          {/* Engagement Tab */}
          <TabsContent value="engagement" className="space-y-6">
            {/* 闹钟健康指标 */}
            {data && (
              <>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                  <MetricCard
                    title="人均闹钟数"
                    value={data.summary.alarmHealth.avgAlarmsPerUser.toFixed(2)}
                    icon={Bell}
                    color="blue"
                    subtitle="活跃用户使用深度"
                  />
                  <MetricCard
                    title="闹钟编辑率"
                    value={`${data.summary.alarmHealth.editRate.toFixed(1)}%`}
                    icon={Activity}
                    color="amber"
                    subtitle="用户调整频率"
                  />
                  <MetricCard
                    title="闹钟删除率"
                    value={`${data.summary.alarmHealth.deleteRate.toFixed(1)}%`}
                    icon={TrendingDown}
                    color="red"
                    subtitle="功能不满意信号"
                  />
                  <MetricCard
                    title="新增闹钟"
                    value={data.summary.alarmsAdded.toString()}
                    icon={Zap}
                    color="green"
                  />
                </div>

                {/* 闹钟类型分布 */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Clock className="w-5 h-5" />
                      闹钟类型分布
                    </CardTitle>
                    <CardDescription>用户偏好的闹钟设置类型</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data.breakdown.alarmTypes} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis type="number" />
                          <YAxis dataKey="name" type="category" width={100} style={{ fontSize: 12 }} />
                          <Tooltip formatter={(value, name, props) => {
                            const payload = (props as any)?.payload;
                            return [`${value} (${payload?.percentage || 0}%)`, '数量'];
                          }} />
                          <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                {/* 地理分布 */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Globe className="w-5 h-5" />
                      国家分布
                    </CardTitle>
                    <CardDescription>用户地理位置分布</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={data.breakdown.countries}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={100}
                            paddingAngle={5}
                            dataKey="value"
                            nameKey="name"
                          >
                            {data.breakdown.countries.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="mt-4 space-y-2">
                      {data.breakdown.countries.map((country, index) => (
                        <div key={country.name} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: COLORS[index % COLORS.length] }}
                            />
                            <span className="font-medium">{country.name}</span>
                          </div>
                          <span className="text-gray-600">{country.value} 用户</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          {/* Funnel Tab */}
          <TabsContent value="funnel" className="space-y-6">
            {data && (
              <>
                {/* 购买漏斗 */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <ShoppingCart className="w-5 h-5" />
                      购买转化漏斗
                    </CardTitle>
                    <CardDescription>从查看到完成购买的完整流程</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <FunnelChart>
                          <Tooltip />
                          <Funnel
                            dataKey="value"
                            data={data.summary.purchaseFunnel.steps.map((step, index) => ({
                              name: step.name,
                              value: step.value,
                              fill: COLORS[index],
                            }))}
                            isAnimationActive
                          >
                            <LabelList position="inside" fill="#fff" stroke="none" />
                          </Funnel>
                        </FunnelChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                      <div className="p-3 bg-gray-50 rounded">
                        <p className="text-xs text-gray-500">查看定价</p>
                        <p className="text-lg font-bold text-blue-600">{data.summary.purchaseFunnel.viewPricing}</p>
                      </div>
                      <div className="p-3 bg-gray-50 rounded">
                        <p className="text-xs text-gray-500">点击购买</p>
                        <p className="text-lg font-bold text-amber-600">{data.summary.purchaseFunnel.clickPurchase}</p>
                      </div>
                      <div className="p-3 bg-gray-50 rounded">
                        <p className="text-xs text-gray-500">支付成功</p>
                        <p className="text-lg font-bold text-green-600">{data.summary.purchaseFunnel.success}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Onboarding 漏斗 */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <GraduationCap className="w-5 h-5" />
                      新用户引导漏斗
                    </CardTitle>
                    <CardDescription>用户完成新手引导的比例</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center p-4 bg-blue-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold">1</div>
                          <span className="font-medium">展示引导</span>
                        </div>
                        <span className="font-bold text-lg">{data.summary.onboarding.appear}</span>
                      </div>
                      <div className="flex justify-between items-center p-4 bg-red-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center font-bold">✕</div>
                          <span className="font-medium">跳过引导</span>
                        </div>
                        <span className="font-bold text-lg text-red-600">{data.summary.onboarding.skip}</span>
                      </div>
                      <div className="flex justify-between items-center p-4 bg-green-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center font-bold">✓</div>
                          <span className="font-medium">完成引导</span>
                        </div>
                        <span className="font-bold text-lg text-green-600">{data.summary.onboarding.complete}</span>
                      </div>
                      <div className="p-4 bg-gray-50 rounded-lg text-center">
                        <p className="text-sm text-gray-600 mb-1">引导完成率</p>
                        <p className="text-3xl font-bold text-blue-600">{data.summary.onboarding.completionRate}%</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>
        </Tabs>

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-gray-400">
          AlarmOne Analytics • https://echopie.com
        </div>
      </div>
    </div>
  );
}

// 子组件
interface MetricCardProps {
  title: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  color: 'blue' | 'green' | 'amber' | 'purple' | 'red';
  trend?: number;
  subtitle?: string;
}

function MetricCard({ title, value, icon: Icon, color, trend, subtitle }: MetricCardProps) {
  const colors = {
    blue: 'bg-blue-100 text-blue-600',
    green: 'bg-green-100 text-green-600',
    amber: 'bg-amber-100 text-amber-600',
    purple: 'bg-purple-100 text-purple-600',
    red: 'bg-red-100 text-red-600',
  };

  return (
    <Card>
      <CardContent className="p-4 sm:p-6">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-xs sm:text-sm font-medium text-gray-500 truncate">{title}</p>
            <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-1 truncate">{value}</p>
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

interface RetentionCardProps {
  label: string;
  value: number;
}

function RetentionCard({ label, value }: RetentionCardProps) {
  return (
    <div className="text-center p-4 bg-gray-50 rounded-lg">
      <p className="text-sm text-gray-500 mb-1">{label}</p>
      <div className="relative inline-flex items-center justify-center">
        <svg className="w-20 h-20 transform -rotate-90">
          <circle
            cx="40"
            cy="40"
            r="36"
            stroke="#e5e7eb"
            strokeWidth="8"
            fill="none"
          />
          <circle
            cx="40"
            cy="40"
            r="36"
            stroke={value > 30 ? '#10b981' : value > 10 ? '#f59e0b' : '#ef4444'}
            strokeWidth="8"
            fill="none"
            strokeDasharray={`${value * 2.26} 226`}
            strokeLinecap="round"
          />
        </svg>
        <span className="absolute text-xl font-bold">{value}%</span>
      </div>
    </div>
  );
}
