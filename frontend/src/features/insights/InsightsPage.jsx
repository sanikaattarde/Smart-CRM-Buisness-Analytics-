import React, { useEffect, useState } from 'react';
import { AlertTriangle, TrendingUp, Target, Lightbulb, Loader2 } from 'lucide-react';
import api from '../../services/api';
import useUiStore from '../../store/uiStore';

// Helper to pick an icon and color based on insight text content
function getInsightStyling(text) {
  const lower = text.toLowerCase();
  if (lower.includes('churn')) {
    return { icon: AlertTriangle, color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/20' };
  }
  if (lower.includes('revenue') || lower.includes('forecast') || lower.includes('increase') || lower.includes('growth')) {
    return { icon: TrendingUp, color: 'text-green-500', bg: 'bg-green-500/10', border: 'border-green-500/20' };
  }
  if (lower.includes('lead') || lower.includes('segment') || lower.includes('pipeline')) {
    return { icon: Target, color: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-500/20' };
  }
  return { icon: Lightbulb, color: 'text-yellow-500', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20' };
}

export default function InsightsPage() {
  const [insights, setInsights] = useState([]);
  const [loading, setLoading] = useState(true);
  const addNotification = useUiStore((state) => state.addNotification);

  useEffect(() => {
    async function fetchInsights() {
      try {
        const { data } = await api.get('/analytics/insights');
        setInsights(data.data?.insights || []);
      } catch (err) {
        addNotification({ type: 'error', message: 'Failed to load AI Insights.' });
      } finally {
        setLoading(false);
      }
    }
    fetchInsights();
  }, [addNotification]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">AI Business Insights</h1>
        <p className="text-sm text-text-secondary mt-1">
          Machine learning generated recommendations and anomaly detection.
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card p-6 border border-border bg-base-elevated rounded-xl animate-pulse">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-base shrink-0" />
                <div className="space-y-3 flex-1">
                  <div className="h-4 bg-base rounded w-3/4" />
                  <div className="h-3 bg-base rounded w-full" />
                  <div className="h-3 bg-base rounded w-5/6" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : insights.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-text-secondary bg-base-elevated rounded-xl border border-border">
          <Lightbulb size={48} className="mb-4 opacity-50 text-yellow-500" />
          <p className="text-lg font-medium text-text-primary">No critical insights</p>
          <p className="text-sm">All metrics are within normal range.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 auto-rows-max">
          {insights.map((insight, index) => {
            const { icon: Icon, color, bg, border } = getInsightStyling(insight);
            return (
              <div
                key={index}
                className={`card p-6 bg-base-elevated border ${border} rounded-xl shadow-sm hover:shadow-md transition-shadow flex items-start gap-4`}
              >
                <div className={`p-2.5 rounded-xl ${bg} ${color} shrink-0`}>
                  <Icon size={20} />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-text-primary leading-relaxed font-medium">
                    {/* The ML service occasionally prepends emojis, strip them if present to rely on our clean Lucide icons */}
                    {insight.replace(/^[\u2600-\u27BF\uD83C-\uD83E][\uDC00-\uDFFF\u200D\uFE0F]*\s*/, '')}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
