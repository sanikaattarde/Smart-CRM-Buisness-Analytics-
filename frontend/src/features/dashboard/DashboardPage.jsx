import React, { useState, useEffect, useMemo } from 'react';
import { 
  AreaChart, Area, 
  BarChart, Bar, 
  RadialBarChart, RadialBar, PolarAngleAxis,
  ResponsiveContainer, ComposedChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend
} from 'recharts';
import { Rocket, Plus, Target, FileText, Activity } from 'lucide-react';
import KPICard from './components/KPICard';

const MOCK_ACTIVITY = [
  { id: 1, type: 'stage_change', user: 'JD', action: 'moved Lead X to Proposal', time: '2m ago' },
  { id: 2, type: 'task', user: 'AK', action: 'completed Onboarding Call', time: '1h ago' },
  { id: 3, type: 'new_lead', user: 'AI', action: 'scored New Inbound Lead as Hot', time: '3h ago' },
  { id: 4, type: 'deal_won', user: 'JD', action: 'closed Acme Corp Deal', time: '5h ago' }
];

const REVENUE_DATA = [
  { name: 'Mon', value: 12000 },
  { name: 'Tue', value: 19000 },
  { name: 'Wed', value: 15000 },
  { name: 'Thu', value: 22000 },
  { name: 'Fri', value: 28000, forecast: 28000 },
  { name: 'Sat', forecast: 32000 },
  { name: 'Sun', forecast: 36000 }
];

const LEADS_DATA = [
  { name: 'New', count: 42 },
  { name: 'Contacted', count: 28 },
  { name: 'Qualified', count: 15 },
  { name: 'Proposal', count: 7 }
];

const TARGET_DATA = [
  { month: 'Jan', target: 50000, actual: 48000 },
  { month: 'Feb', target: 55000, actual: 59000 },
  { month: 'Mar', target: 60000, actual: 58000 },
  { month: 'Apr', target: 65000, actual: 72000 },
  { month: 'May', target: 70000, actual: 85000 },
  { month: 'Jun', target: 75000, actual: 91000 }
];

const CustomTooltip = React.memo(function CustomTooltip({ active, payload, label }) {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-md border border-border bg-base-elevated p-3 shadow-lg">
        <p className="mb-2 text-sm font-medium text-text-primary">{label}</p>
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center gap-2 text-xs">
            <div className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-text-secondary">{entry.name}:</span>
            <span className="font-semibold text-text-primary">
              {typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
});

function DashboardEmptyState() {
  return (
    <div className="col-span-full flex flex-col items-center justify-center rounded-xl border border-border bg-base-elevated py-20 px-4 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-accent/10">
        <Rocket size={32} className="text-accent" />
      </div>
      <h2 className="mb-2 text-xl font-bold text-text-primary">Let's get your pipeline flowing</h2>
      <p className="mb-6 max-w-md text-sm text-text-secondary">
        Connect your data to unlock powerful AI insights, revenue forecasting, and customer health tracking.
      </p>
      <button className="rounded-lg bg-accent px-6 py-2.5 font-medium text-white transition-colors hover:bg-accent-hover">
        Add Your First Lead
      </button>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex h-40 flex-col justify-between rounded-xl border border-border bg-base-elevated p-5 shadow-sm animate-pulse">
          <div className="flex justify-between">
            <div className="space-y-2">
              <div className="h-4 w-24 rounded bg-base-surface" />
              <div className="h-8 w-32 rounded bg-base-surface" />
            </div>
            <div className="h-6 w-16 rounded-full bg-base-surface" />
          </div>
          <div className="h-16 w-full rounded bg-base-surface" />
        </div>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [hasData, setHasData] = useState(false);

  useEffect(() => {
    // Simulate data fetching
    const timer = setTimeout(() => {
      setIsLoading(false);
      setHasData(true); // Toggle this to test empty state
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  const totalRevenue = 124500;
  const activeLeads = 92;
  const customerHealth = 85;

  const revenueChart = useMemo(() => (
    <AreaChart data={REVENUE_DATA} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
      <defs>
        <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
        </linearGradient>
      </defs>
      <Tooltip content={<CustomTooltip />} cursor={false} />
      <Area 
        type="monotone" 
        dataKey="value" 
        stroke="#3b82f6" 
        strokeWidth={2}
        fill="url(#colorValue)" 
        isAnimationActive={false}
        activeDot={{ r: 4 }} 
      />
      <Area 
        type="monotone" 
        dataKey="forecast" 
        stroke="#8b5cf6" 
        strokeWidth={2}
        strokeDasharray="5 5" 
        fill="none" 
        isAnimationActive={false}
        activeDot={{ r: 4 }} 
      />
    </AreaChart>
  ), []);

  const activeLeadsChart = useMemo(() => (
    <BarChart data={LEADS_DATA} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
      <Tooltip content={<CustomTooltip />} cursor={{ fill: '#1e293b' }} />
      <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} isAnimationActive={false} />
    </BarChart>
  ), []);

  const customerHealthChart = useMemo(() => (
    <RadialBarChart 
      cx="50%" cy="50%" innerRadius="70%" outerRadius="100%" 
      barSize={8} data={[{ name: 'Health', value: customerHealth }]} 
      startAngle={180} endAngle={0}
    >
      <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
      <RadialBar
        minAngle={15}
        background={{ fill: '#1e293b' }}
        clockWise
        dataKey="value"
        cornerRadius={4}
        isAnimationActive={false}
        fill={customerHealth >= 80 ? '#22c55e' : customerHealth >= 50 ? '#eab308' : '#ef4444'}
      />
    </RadialBarChart>
  ), [customerHealth]);

  const winRateData = useMemo(() => [...REVENUE_DATA].reverse(), []);
  const winRateChart = useMemo(() => (
    <AreaChart data={winRateData} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
       <defs>
        <linearGradient id="colorWin" x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
          <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
        </linearGradient>
      </defs>
      <Tooltip content={<CustomTooltip />} cursor={false} />
      <Area 
        type="monotone" 
        dataKey="value" 
        stroke="#ef4444" 
        strokeWidth={2}
        fill="url(#colorWin)" 
        isAnimationActive={false}
      />
    </AreaChart>
  ), [winRateData]);

  const revenueVsTargetChart = useMemo(() => (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={TARGET_DATA} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
        <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} dy={10} />
        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} tickFormatter={(val) => `$${val / 1000}k`} />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: '#1e293b' }} />
        <Legend wrapperStyle={{ paddingTop: '20px' }} iconType="circle" />
        <Bar name="Target Revenue" dataKey="target" fill="#334155" radius={[4, 4, 0, 0]} maxBarSize={40} />
        <Line name="Actual Revenue" type="monotone" dataKey="actual" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, fill: '#3b82f6', strokeWidth: 0 }} activeDot={{ r: 6, strokeWidth: 0 }} isAnimationActive={false} />
      </ComposedChart>
    </ResponsiveContainer>
  ), []);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-8 p-6 animate-fade-in">
      {/* Header Module & Action Row */}
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text-primary">Dashboard</h1>
          <p className="mt-1 text-sm text-text-secondary">Welcome back. Here is your business at a glance.</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <select className="h-9 rounded-md border border-border bg-base-surface px-3 text-sm font-medium text-text-primary outline-none focus:ring-2 focus:ring-accent/50">
            <option>Last 7 Days</option>
            <option>Last 30 Days</option>
            <option>This Quarter</option>
          </select>
          <div className="flex items-center gap-2">
            <button className="flex h-9 items-center gap-2 rounded-md bg-transparent px-3 text-sm font-medium text-text-secondary transition-colors hover:bg-slate-800 hover:text-text-primary">
              <Plus size={16} /> Add Lead
            </button>
            <button className="flex h-9 items-center gap-2 rounded-md bg-transparent px-3 text-sm font-medium text-text-secondary transition-colors hover:bg-slate-800 hover:text-text-primary">
              <Target size={16} /> New Task
            </button>
            <button className="flex h-9 items-center gap-2 rounded-md bg-transparent px-3 text-sm font-medium text-text-secondary transition-colors hover:bg-slate-800 hover:text-text-primary">
              <FileText size={16} /> AI Report
            </button>
          </div>
        </div>
      </div>

      {isLoading ? (
        <LoadingSkeleton />
      ) : !hasData || (totalRevenue === 0 && activeLeads === 0) ? (
        <DashboardEmptyState />
      ) : (
        <>
          {/* KPI Grid */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            
            <KPICard title="Total Revenue" value="$124,500" trend="+12.5%" trendDirection="up">
              {revenueChart}
            </KPICard>

            <KPICard title="Active Leads" value="92" trend="+4" trendDirection="up">
              {activeLeadsChart}
            </KPICard>

            <KPICard title="Customer Health" value={`${customerHealth} / 100`} trend="+2.1" trendDirection="up">
              {customerHealthChart}
            </KPICard>

            <KPICard title="Win Rate" value="32.4%" trend="-1.2%" trendDirection="down">
              {winRateChart}
            </KPICard>
          </div>

          {/* Bottom Section */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            
            {/* Revenue vs Target */}
            <div className="col-span-1 flex flex-col rounded-xl border border-border bg-base-elevated p-6 shadow-sm lg:col-span-2">
              <div className="mb-6">
                <h3 className="text-lg font-bold text-text-primary">Revenue vs. Target</h3>
                <p className="text-sm text-text-secondary">Monthly performance against sales goals.</p>
              </div>
              <div className="h-[300px] w-full">
                {revenueVsTargetChart}
              </div>
            </div>

            {/* Recent Activity */}
            <div className="col-span-1 rounded-xl border border-border bg-base-elevated p-6 shadow-sm">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-text-primary">Recent Activity</h3>
                  <p className="text-sm text-text-secondary">Latest team actions.</p>
                </div>
                <Activity size={18} className="text-text-secondary" />
              </div>
              <div className="relative pl-3">
                <div className="absolute left-[15px] top-2 h-[calc(100%-24px)] w-px bg-border" />
                <ul className="space-y-6">
                  {MOCK_ACTIVITY.map((activity) => (
                    <li key={activity.id} className="relative pl-6">
                      <div className="absolute -left-[9px] top-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-base-elevated bg-accent text-[10px] font-bold text-white shadow-sm">
                        {activity.user}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-text-primary">
                          {activity.action}
                        </span>
                        <span className="text-xs text-text-secondary">
                          {activity.time}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

          </div>
        </>
      )}
    </div>
  );
}
