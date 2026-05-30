import React from 'react';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import { ResponsiveContainer } from 'recharts';

export default React.memo(function KPICard({ title, value, trend, trendDirection, children }) {
  const isUp = trendDirection === 'up';
  const isDown = trendDirection === 'down';
  const isFlat = trendDirection === 'flat';

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-base-elevated p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h3 className="text-sm font-medium text-text-secondary">{title}</h3>
          <p className="mt-1 text-2xl font-bold text-text-primary">{value}</p>
        </div>
        <div
          className={`flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${
            isUp
              ? 'bg-success/10 text-success'
              : isDown
              ? 'bg-danger/10 text-danger'
              : 'bg-text-secondary/10 text-text-secondary'
          }`}
        >
          {isUp && <ArrowUpRight size={14} />}
          {isDown && <ArrowDownRight size={14} />}
          {isFlat && <Minus size={14} />}
          <span>{trend}</span>
        </div>
      </div>
      <div className="mt-auto h-[80px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
