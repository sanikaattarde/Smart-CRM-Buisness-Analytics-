/**
 * Skeleton loading card matching KPICard dimensions.
 * Renders a pulsing placeholder while dashboard data loads.
 */
export default function SkeletonCard() {
  return (
    <div className="card p-5 animate-pulse">
      {/* Header row */}
      <div className="flex items-center justify-between mb-4">
        <div className="h-4 w-24 rounded bg-base-elevated" />
        <div className="h-5 w-16 rounded-full bg-base-elevated" />
      </div>

      {/* Value */}
      <div className="h-8 w-32 rounded bg-base-elevated mb-1" />

      {/* Subtitle */}
      <div className="h-3 w-20 rounded bg-base-elevated mb-5" />

      {/* Chart placeholder */}
      <div className="h-[100px] w-full rounded-lg bg-base-elevated" />
    </div>
  );
}
