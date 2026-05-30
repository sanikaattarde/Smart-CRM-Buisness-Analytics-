import { useEffect, useState, useMemo } from 'react';
import {
  AreaChart, Area,
  BarChart, Bar,
  LineChart, Line,
  RadialBarChart, RadialBar, PolarAngleAxis,
  ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import { DollarSign, Target, TrendingUp, HeartPulse } from 'lucide-react';
import KPICard from './components/KPICard';
import SkeletonCard from './components/SkeletonCard';
import api from '../../services/api';

/* --------------------------------------------------------------------------
   Custom tooltip for mini charts
   -------------------------------------------------------------------------- */

function MiniTooltip({ active, payload, valuePrefix = '', valueSuffix = '' }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-border bg-base-elevated px-2.5 py-1.5 shadow-lg text-xs space-y-1">
      {payload.map((p, i) => {
        // Hide the confidence band from the tooltip
        if (p.name === 'Confidence Range') return null;
        return (
          <div key={i} className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color || p.fill }} />
            <span className="font-semibold text-text-primary">
              {p.name}: {valuePrefix}{p.value?.toLocaleString()}{valueSuffix}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* --------------------------------------------------------------------------
   Dashboard Page
   -------------------------------------------------------------------------- */

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState(null);
  const [revenueTrend, setRevenueTrend] = useState([]);
  const [leadsByStage, setLeadsByStage] = useState([]);
  const [conversionTrend, setConversionTrend] = useState([]);
  const [healthScore, setHealthScore] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function fetchDashboard() {
      try {
        const [kpisRes, revenueRes, funnelRes, forecastRes] = await Promise.all([
          api.get('/analytics/kpis'),
          api.get('/analytics/revenue-trend'),
          api.get('/analytics/lead-funnel'),
          api.get('/analytics/forecast').catch(() => ({ data: { data: null } }))
        ]);

        if (cancelled) return;

        const kpisData = kpisRes.data.data || {};
        setKpis({
          totalRevenue: kpisData.total_revenue ?? 0,
          revenueChange: kpisData.revenue_change ?? 0,
          activeLeads: kpisData.active_leads ?? 0,
          leadsChange: kpisData.leads_change ?? 0,
          conversionRate: kpisData.conversion_rate ?? 0,
          conversionChange: kpisData.conversion_change ?? 0,
          avgHealthScore: kpisData.avg_health_score ?? 0,
          healthChange: kpisData.health_change ?? 0,
        });

        // The historical revenue array
        let revData = revenueRes.data.data || [];
        
        // ML Forecast Overlay
        const forecastData = forecastRes.data.data;
        if (forecastData && forecastData.forecast && revData.length > 0) {
          const lastPoint = revData[revData.length - 1];
          // Anchor the forecast lines to the last historical point
          lastPoint.forecastValue = lastPoint.value;
          lastPoint.forecastBand = [lastPoint.value, lastPoint.value];

          // Append future projection
          revData.push({
            day: 'Forecast',
            forecastValue: forecastData.forecast,
            forecastBand: forecastData.range || [forecastData.forecast * 0.9, forecastData.forecast * 1.1]
          });
        }
        
        setRevenueTrend(revData);
        setLeadsByStage(funnelRes.data.data || []);
        
        // Static conversion trend since backend doesn't provide it yet
        setConversionTrend([
          { week: 'W1', rate: 21 }, { week: 'W2', rate: 22 }, { week: 'W3', rate: 23 },
          { week: 'W4', rate: Math.round(kpisData.conversion_rate || 24) }
        ]);
        
        setHealthScore(kpisData.avg_health_score ?? 0);
      } catch (err) {
        console.error('Failed to fetch dashboard data', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchDashboard();
    return () => { cancelled = true; };
  }, []);

  const healthData = useMemo(
    () => [{ name: 'Health', value: healthScore, fill: 'var(--color-accent)' }],
    [healthScore]
  );

  if (loading || !kpis) {
    return (
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-sm font-medium text-text-secondary mb-1">Overview</h2>
        <p className="text-xs text-text-muted">Real-time business metrics</p>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">

        {/* ---- Total Revenue & AI Forecast ---- */}
        <KPICard
          title="Total Revenue"
          value={`$${kpis.totalRevenue.toLocaleString()}`}
          trend={kpis.revenueChange}
          trendLabel="vs last month"
          icon={DollarSign}
          accentColor="var(--color-success)"
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={revenueTrend} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
              <defs>
                <linearGradient id="gRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-success)" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="var(--color-success)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gForecast" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-accent)" stopOpacity={0.15} />
                  <stop offset="100%" stopColor="var(--color-accent)" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <Tooltip content={<MiniTooltip valuePrefix="$" />} cursor={false} />
              
              {/* Historical Revenue */}
              <Area
                name="Historical"
                type="monotone"
                dataKey="value"
                stroke="var(--color-success)"
                strokeWidth={2}
                fill="url(#gRevenue)"
                dot={false}
                activeDot={{ r: 3, fill: 'var(--color-success)' }}
              />

              {/* AI Forecast Trendline */}
              <Area
                name="AI Forecast"
                type="monotone"
                dataKey="forecastValue"
                stroke="var(--color-accent)"
                strokeWidth={2}
                strokeDasharray="4 4"
                fill="none"
                dot={false}
                activeDot={{ r: 3, fill: 'var(--color-accent)' }}
              />

              {/* AI Forecast Confidence Band */}
              <Area
                name="Confidence Range"
                type="monotone"
                dataKey="forecastBand"
                stroke="none"
                fill="url(#gForecast)"
                activeDot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </KPICard>

        {/* ---- Active Leads ---- */}
        <KPICard
          title="Active Leads"
          value={kpis.activeLeads}
          trend={kpis.leadsChange}
          trendLabel="vs last month"
          icon={Target}
          accentColor="var(--color-accent)"
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={leadsByStage} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
              <Tooltip content={<MiniTooltip />} cursor={{ fill: 'var(--color-bg-hover)', radius: 4 }} />
              <Bar
                name="Leads"
                dataKey="count"
                radius={[4, 4, 0, 0]}
                fill="var(--color-accent)"
                fillOpacity={0.7}
                activeBar={{ fillOpacity: 1 }}
              />
            </BarChart>
          </ResponsiveContainer>
        </KPICard>

        {/* ---- Conversion Rate ---- */}
        <KPICard
          title="Conversion Rate"
          value={`${kpis.conversionRate}%`}
          trend={kpis.conversionChange}
          trendLabel="Recent trend"
          icon={TrendingUp}
          accentColor="var(--color-warning)"
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={conversionTrend} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
              <Tooltip content={<MiniTooltip valueSuffix="%" />} cursor={false} />
              <Line
                name="Rate"
                type="monotone"
                dataKey="rate"
                stroke="var(--color-warning)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 3, fill: 'var(--color-warning)' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </KPICard>

        {/* ---- Customer Health ---- */}
        <KPICard
          title="Customer Health"
          value={`${kpis.avgHealthScore}/100`}
          trend={kpis.healthChange}
          trendLabel="vs last month"
          icon={HeartPulse}
          accentColor="var(--color-accent)"
        >
          <ResponsiveContainer width="100%" height="100%">
            <RadialBarChart
              cx="50%"
              cy="50%"
              innerRadius="70%"
              outerRadius="100%"
              barSize={10}
              data={healthData}
              startAngle={210}
              endAngle={-30}
            >
              <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
              <RadialBar
                background={{ fill: 'var(--color-bg-elevated)' }}
                dataKey="value"
                cornerRadius={6}
                angleAxisId={0}
              />
              <text
                x="50%"
                y="50%"
                textAnchor="middle"
                dominantBaseline="middle"
                className="text-xl font-bold"
                fill="var(--color-text-primary)"
              >
                {kpis.avgHealthScore}
              </text>
            </RadialBarChart>
          </ResponsiveContainer>
        </KPICard>

      </div>
    </div>
  );
}
