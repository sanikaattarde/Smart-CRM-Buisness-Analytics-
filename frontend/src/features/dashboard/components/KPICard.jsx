import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

/**
 * Dashboard KPI card with a header row (title + trend badge),
 * a large value readout, and a children slot for a mini Recharts graph.
 *
 * @param {{
 *   title: string,
 *   value: string | number,
 *   subtitle?: string,
 *   trend?: number,
 *   trendLabel?: string,
 *   icon?: import('lucide-react').LucideIcon,
 *   accentColor?: string,
 *   children?: React.ReactNode,
 * }} props
 */
export default function KPICard({
  title,
  value,
  subtitle = '',
  trend,
  trendLabel = 'vs last period',
  icon: Icon,
  accentColor = 'var(--color-accent)',
  children,
}) {
  const isPositive = trend > 0;
  const isNeutral = trend === 0 || trend == null;
  const TrendIcon = isNeutral ? Minus : isPositive ? TrendingUp : TrendingDown;

  const trendColor = isNeutral
    ? 'text-text-secondary bg-base-elevated'
    : isPositive
      ? 'text-success bg-[var(--color-success-muted)]'
      : 'text-danger bg-[var(--color-danger-muted)]';

  return (
    <div className="card group relative overflow-hidden p-5 transition-all duration-200 hover:border-[var(--color-border-light)]">
      {/* Subtle gradient glow on hover */}
      <div
        className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-20"
        style={{ background: accentColor }}
      />

      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {Icon && (
            <div
              className="flex h-7 w-7 items-center justify-center rounded-md"
              style={{ background: `color-mix(in srgb, ${accentColor} 15%, transparent)` }}
            >
              <Icon size={14} style={{ color: accentColor }} />
            </div>
          )}
          <span className="text-sm font-medium text-text-secondary">{title}</span>
        </div>

        {trend != null && (
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${trendColor}`}>
            <TrendIcon size={12} />
            {Math.abs(trend).toFixed(1)}%
          </span>
        )}
      </div>

      {/* Value */}
      <div className="mb-0.5">
        <span className="text-2xl font-bold tracking-tight text-text-primary">{value}</span>
      </div>
      {subtitle && (
        <p className="text-xs text-text-muted mb-4">{subtitle}</p>
      )}
      {trendLabel && trend != null && !subtitle && (
        <p className="text-xs text-text-muted mb-4">{trendLabel}</p>
      )}

      {/* Mini chart slot */}
      {children && (
        <div className="mt-2 h-[100px] w-full">
          {children}
        </div>
      )}
    </div>
  );
}
