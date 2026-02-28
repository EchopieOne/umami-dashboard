'use client';

import { useEffect, useState, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, FunnelChart, Funnel, LabelList } from 'recharts';
import { Users, TrendingUp, RefreshCw, Bell, Globe, DollarSign, Smartphone, Crown, Activity, Target, ShoppingCart, GraduationCap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DateRangePicker } from '@/components/date-range-picker';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

interface DataResponse {
  summary: {
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
    purchases: number;
    pageviews: number;
    mrr: number;
    totalRevenue: number;
    activeSubscriptions: number;
    trials: number;
    churnRate: number;
    revenueHealth: { arpu: number; arppu: number; penetrationRate: number; ltv: number };
    alarmHealth: { avgAlarmsPerUser: number; editRate: number; deleteRate: number };
    purchaseSource: { source: string; clicks: number; conversions: number; conversionRate: number }[];
    purchaseFunnel: { clicks: number; success: number; failed: number; cancel: number; conversionRate: string };
    onboarding: { appear: number; skip: number; complete: number; completionRate: string };
  };
  charts: {
    newUsers: { date: string; count: number }[];
    activeUsers: { date: string; count: number }[];
    appLaunches: { date: string; count: number }[];
    alarmsAdded: { date: string; count: number }[];
    purchases: { date: string; count: number }[];
  };
  breakdown: {
    alarmTypes: { name: string; value: number; percentage: number }[];
    purchaseClicks: { annual: number; lifetime: number; main: number; setting: number; onboarding: number };
    countries: { name: string; value: number }[];
  };
  range: { label: string };
}

export default function Dashboard() {
  const [data, setData] = useState<DataResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<{ range: string; startAt?: number; endAt?: number }>({ range: '7' });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      let url = `/api/umami?range=${timeRange.range}`;
      if (timeRange.startAt && timeRange.endAt) {
        url += `&startAt=${timeRange.startAt}&endAt=${timeRange.endAt}`;
      }
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed');
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [timeRange]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading || !data) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-24" />)}
          </div>
        </div>
      </div>
    );
  }

  const { summary, charts, breakdown } = data;

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <Bell className="w-8 h-8 text-blue-600" />
            <div>
              <h1 className="text-2xl font-bold">AlarmOne Dashboard</h1>
              <p className="text-sm text-gray-500">{data.range.label}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <DateRangePicker value={timeRange} onChange={setTimeRange} />
            <Button variant="outline" size="icon" onClick={fetchData}><RefreshCw className="w-4 h-4" /></Button>
          </div>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">总览</TabsTrigger>
            <TabsTrigger value="revenue">收入</TabsTrigger>
            <TabsTrigger value="engagement">功能</TabsTrigger>
            <TabsTrigger value="funnel">漏斗</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <MetricCard title="App启动" value={summary.appLaunches} icon={Smartphone} color="blue" />
              <MetricCard title="活跃用户" value={summary.activeUsers} icon={Users} color="green" />
              <MetricCard title="新用户" value={summary.newUsers} icon={TrendingUp} color="amber" trend={summary.newUsersChange} />
              <MetricCard title="VIP用户" value={summary.vipUsers} icon={Crown} color="purple" />
              <MetricCard title="MRR" value={`$${summary.mrr}`} icon={DollarSign} color="green" />
              <MetricCard title="总收入" value={`$${summary.totalRevenue}`} icon={DollarSign} color="blue" />
              <MetricCard title="新增闹钟" value={summary.alarmsAdded} icon={Bell} color="amber" />
              <MetricCard title="购买次数" value={summary.purchases} icon={ShoppingCart} color="purple" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ChartCard title="活跃用户趋势" data={charts.activeUsers} color="#10b981" />
              <ChartCard title="新用户趋势" data={charts.newUsers} color="#3b82f6" />
            </div>
          </TabsContent>

          {/* Revenue Tab */}
          <TabsContent value="revenue" className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <MetricCard title="MRR" value={`$${summary.mrr}`} icon={DollarSign} color="green" />
              <MetricCard title="ARPU" value={`$${summary.revenueHealth.arpu.toFixed(2)}`} icon={Users} color="blue" subtitle="每用户平均" />
              <MetricCard title="ARPPU" value={`$${summary.revenueHealth.arppu.toFixed(2)}`} icon={Crown} color="purple" subtitle="每付费用户" />
              <MetricCard title="LTV" value={`$${summary.revenueHealth.ltv.toFixed(0)}`} icon={Target} color="amber" />
              <MetricCard title="总收入" value={`$${summary.totalRevenue}`} icon={DollarSign} color="blue" />
              <MetricCard title="活跃订阅" value={summary.activeSubscriptions} icon={Users} color="green" />
              <MetricCard title="试用中" value={summary.trials} icon={Activity} color="amber" />
              <MetricCard title="流失率" value={`${summary.churnRate.toFixed(2)}%`} icon={TrendingUp} color={summary.churnRate > 5 ? "red" : "green"} />
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><ShoppingCart className="w-5 h-5" /> 购买来源分析</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={summary.purchaseSource} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="clicks" nameKey="source">
                          {summary.purchaseSource.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-3">
                    {summary.purchaseSource.map((s, i) => (
                      <div key={s.source} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                          <span className="font-medium">{s.source}</span>
                        </div>
                        <div className="text-right">
                          <div className="font-bold">{s.clicks} 点击</div>
                          <div className="text-sm text-gray-500">转化率 {s.conversionRate}%</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Engagement Tab */}
          <TabsContent value="engagement" className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <MetricCard title="人均闹钟" value={summary.alarmHealth.avgAlarmsPerUser.toFixed(2)} icon={Bell} color="blue" />
              <MetricCard title="编辑率" value={`${summary.alarmHealth.editRate.toFixed(1)}%`} icon={Activity} color="amber" />
              <MetricCard title="删除率" value={`${summary.alarmHealth.deleteRate.toFixed(1)}%`} icon={TrendingUp} color="red" />
              <MetricCard title="新增闹钟" value={summary.alarmsAdded} icon={Bell} color="green" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader><CardTitle>闹钟类型分布</CardTitle></CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={breakdown.alarmTypes} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" />
                        <YAxis dataKey="name" type="category" width={100} style={{ fontSize: 12 }} />
                        <Tooltip formatter={(value, name, props: any) => [`${value} (${props?.payload?.percentage || 0}%)`, '数量']} />
                        <Bar dataKey="value" fill="#3b82f6" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Globe className="w-5 h-5" /> 国家分布</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={breakdown.countries} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value" nameKey="name">
                          {breakdown.countries.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Funnel Tab */}
          <TabsContent value="funnel" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><ShoppingCart className="w-5 h-5" /> 购买转化漏斗</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {[
                      { label: '点击购买', value: summary.purchaseFunnel.clicks, color: 'bg-blue-500' },
                      { label: '支付成功', value: summary.purchaseFunnel.success, color: 'bg-green-500' },
                      { label: '支付失败', value: summary.purchaseFunnel.failed, color: 'bg-red-500' },
                      { label: '取消支付', value: summary.purchaseFunnel.cancel, color: 'bg-gray-500' },
                    ].map((item) => (
                      <div key={item.label} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <span className="font-medium">{item.label}</span>
                        <div className="flex items-center gap-3">
                          <div className={`w-3 h-3 rounded-full ${item.color}`} />
                          <span className="text-xl font-bold">{item.value}</span>
                        </div>
                      </div>
                    ))}
                    <div className="p-4 bg-blue-50 rounded-lg text-center">
                      <p className="text-sm text-gray-600">转化率</p>
                      <p className="text-3xl font-bold text-blue-600">{summary.purchaseFunnel.conversionRate}%</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><GraduationCap className="w-5 h-5" /> Onboarding 漏斗</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {[
                      { label: '展示引导', value: summary.onboarding.appear, color: 'bg-blue-500' },
                      { label: '跳过引导', value: summary.onboarding.skip, color: 'bg-red-500' },
                      { label: '完成引导', value: summary.onboarding.complete, color: 'bg-green-500' },
                    ].map((item) => (
                      <div key={item.label} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <span className="font-medium">{item.label}</span>
                        <div className="flex items-center gap-3">
                          <div className={`w-3 h-3 rounded-full ${item.color}`} />
                          <span className="text-xl font-bold">{item.value}</span>
                        </div>
                      </div>
                    ))}
                    
                    <div className="p-4 bg-green-50 rounded-lg text-center">
                      <p className="text-sm text-gray-600">完成率</p>
                      <p className="text-3xl font-bold text-green-600">{summary.onboarding.completionRate}%</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function MetricCard({ title, value, icon: Icon, color, trend, subtitle }: any) {
  const colors: any = { blue: 'bg-blue-100 text-blue-600', green: 'bg-green-100 text-green-600', amber: 'bg-amber-100 text-amber-600', purple: 'bg-purple-100 text-purple-600', red: 'bg-red-100 text-red-600' };
  
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
            {trend !== undefined && (
              <span className={`text-sm ${trend >= 0 ? 'text-green-500' : 'text-red-500'}`}>{trend >= 0 ? '+' : ''}{trend}%</span>
            )}
            {subtitle && <p className="text-xs text-gray-400">{subtitle}</p>}
          </div>
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colors[color]}`}>
            <Icon className="w-5 h-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ChartCard({ title, data, color }: any) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-lg">{title}</CardTitle></CardHeader>
      <CardContent>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tickFormatter={(v) => new Date(v).toLocaleDateString('zh-CN', {month: 'short', day: 'numeric'})} style={{ fontSize: 11 }} />
              <YAxis style={{ fontSize: 12 }} />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke={color} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
