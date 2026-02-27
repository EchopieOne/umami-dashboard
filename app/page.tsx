'use client';

import { useEffect, useState, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Users, TrendingUp, RefreshCw, Bell, Globe, DollarSign, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface DataResponse {
  summary: {
    appLaunches: number;
    newUsers: number;
    newUsersChange: number;
    activeUsers: number;
    visitors: number;
    visitorChange: number;
    alarmsAdded: number;
    purchases: number;
    pageviews: number;
    mrr: number;
    totalRevenue: number;
    activeSubscriptions: number;
    trials: number;
    churnRate: number;
  };
  charts: {
    newUsers: { date: string; count: number }[];
    activeUsers: { date: string; count: number }[];
    appLaunches: { date: string; count: number }[];
    alarmsAdded: { date: string; count: number }[];
    purchases: { date: string; count: number }[];
  };
  breakdown: {
    countries: { name: string; value: number }[];
  };
  range: { startAt: number; endAt: number; days: number; label: string };
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function Dashboard() {
  const [data, setData] = useState<DataResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState('7');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/umami?range=${range}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { summary, charts, breakdown } = data;

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <Bell className="w-8 h-8 text-blue-600" />
            <h1 className="text-2xl font-bold">AlarmOne Dashboard</h1>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={range}
              onChange={(e) => setRange(e.target.value)}
              className="px-3 py-2 border rounded-md"
            >
              <option value="7">过去7天</option>
              <option value="30">过去30天</option>
              <option value="90">过去90天</option>
            </select>
            <Button variant="outline" size="icon" onClick={fetchData}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Core Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard title="App启动" value={summary.appLaunches} icon={Smartphone} color="blue" />
          <MetricCard title="活跃用户" value={summary.activeUsers} icon={Users} color="green" />
          <MetricCard title="新用户" value={summary.newUsers} icon={TrendingUp} color="amber" trend={summary.newUsersChange} />
          <MetricCard title="新增闹钟" value={summary.alarmsAdded} icon={Bell} color="purple" />
          <MetricCard title="MRR" value={`$${summary.mrr}`} icon={DollarSign} color="green" />
          <MetricCard title="总收入" value={`$${summary.totalRevenue}`} icon={DollarSign} color="blue" />
          <MetricCard title="活跃订阅" value={summary.activeSubscriptions} icon={Users} color="amber" />
          <MetricCard title="购买次数" value={summary.purchases} icon={TrendingUp} color="purple" />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartCard title="活跃用户趋势" data={charts.activeUsers} color="#10b981" />
          <ChartCard title="新用户趋势" data={charts.newUsers} color="#3b82f6" />
        </div>

        {/* Country Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="w-5 h-5" />
              {'国家分布'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={breakdown.countries}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                    nameKey="name"
                  >
                    {breakdown.countries.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {breakdown.countries.map((c, i) => (
                <div key={c.name} className="flex items-center gap-2 px-3 py-1 bg-gray-100 rounded-full text-sm">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                  {`${c.name}: ${c.value}`}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MetricCard({ title, value, icon: Icon, color, trend }: any) {
  const colors: any = {
    blue: 'bg-blue-100 text-blue-600',
    green: 'bg-green-100 text-green-600',
    amber: 'bg-amber-100 text-amber-600',
    purple: 'bg-purple-100 text-purple-600',
  };
  
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
            {trend !== undefined && (
              <span className={`text-sm ${trend >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {trend >= 0 ? '+' : ''}{trend}%
              </span>
            )}
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
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis 
                dataKey="date" 
                tickFormatter={(v) => new Date(v).toLocaleDateString('zh-CN', {month: 'short', day: 'numeric'})}
                style={{ fontSize: 11 }}
              />
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
