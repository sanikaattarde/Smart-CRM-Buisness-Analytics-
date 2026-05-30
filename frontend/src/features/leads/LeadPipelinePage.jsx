import { useEffect, useMemo } from 'react';
import { Kanban, RefreshCw } from 'lucide-react';
import KanbanBoard from './components/KanbanBoard';
import useLeadStore from '../../store/leadStore';

/* --------------------------------------------------------------------------
   Demo seed data (used when backend is unreachable)
   -------------------------------------------------------------------------- */

const DEMO_STAGES = [
  { id: 's1', name: 'New', order_index: 0, color: '#3b82f6' },
  { id: 's2', name: 'Contacted', order_index: 1, color: '#8b5cf6' },
  { id: 's3', name: 'Qualified', order_index: 2, color: '#f59e0b' },
  { id: 's4', name: 'Proposal', order_index: 3, color: '#f97316' },
  { id: 's5', name: 'Closed Won', order_index: 4, color: '#22c55e' },
];

const DEMO_LEADS = [
  { id: 'l1', customer_name: 'Acme Corp', score: 82, value: 45000, source: 'website', assigned_name: 'Jane Smith', pipeline_stage_id: 's1' },
  { id: 'l2', customer_name: 'Globex Inc', score: 65, value: 32000, source: 'referral', assigned_name: 'John Doe', pipeline_stage_id: 's1' },
  { id: 'l3', customer_name: 'Initech', score: 48, value: 18000, source: 'cold call', assigned_name: 'Jane Smith', pipeline_stage_id: 's2' },
  { id: 'l4', customer_name: 'Umbrella LLC', score: 91, value: 72000, source: 'inbound', assigned_name: 'Alex Chen', pipeline_stage_id: 's2' },
  { id: 'l5', customer_name: 'Stark Industries', score: 74, value: 55000, source: 'partner', assigned_name: 'John Doe', pipeline_stage_id: 's3' },
  { id: 'l6', customer_name: 'Wayne Enterprises', score: 38, value: 12000, source: 'website', assigned_name: null, pipeline_stage_id: 's3' },
  { id: 'l7', customer_name: 'Oscorp', score: 85, value: 88000, source: 'referral', assigned_name: 'Alex Chen', pipeline_stage_id: 's4' },
  { id: 'l8', customer_name: 'Daily Planet', score: 60, value: 28000, source: 'trade show', assigned_name: 'Jane Smith', pipeline_stage_id: 's1' },
  { id: 'l9', customer_name: 'Cyberdyne', score: 25, value: 9000, source: 'cold call', assigned_name: null, pipeline_stage_id: 's5' },
  { id: 'l10', customer_name: 'Wonka Industries', score: 70, value: 40000, source: 'inbound', assigned_name: 'John Doe', pipeline_stage_id: 's4' },
];

/* --------------------------------------------------------------------------
   Skeleton loader for board
   -------------------------------------------------------------------------- */

function BoardSkeleton() {
  return (
    <div className="flex gap-4 animate-pulse">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="w-[300px] shrink-0 rounded-xl bg-base/60 p-3">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-2.5 w-2.5 rounded-full bg-base-elevated" />
            <div className="h-4 w-20 rounded bg-base-elevated" />
          </div>
          {Array.from({ length: 3 - i % 2 }).map((_, j) => (
            <div key={j} className="mb-2 rounded-lg border border-border bg-base-surface p-3.5">
              <div className="h-4 w-3/4 rounded bg-base-elevated mb-2" />
              <div className="h-3 w-1/2 rounded bg-base-elevated" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/* --------------------------------------------------------------------------
   Page Component
   -------------------------------------------------------------------------- */

export default function LeadPipelinePage() {
  const leads = useLeadStore((s) => s.leads);
  const stages = useLeadStore((s) => s.stages);
  const loading = useLeadStore((s) => s.loading);
  const stagesLoading = useLeadStore((s) => s.stagesLoading);
  const fetchLeads = useLeadStore((s) => s.fetchLeads);
  const fetchStages = useLeadStore((s) => s.fetchStages);

  const isLoading = loading || stagesLoading;

  // Use demo data when store has no data (backend unavailable)
  const effectiveStages = stages.length > 0 ? stages : DEMO_STAGES;
  const effectiveLeads = leads.length > 0 ? leads : DEMO_LEADS;

  // Group leads by stage
  const leadsByStage = useMemo(() => {
    const grouped = {};
    for (const stage of effectiveStages) {
      grouped[stage.id] = [];
    }
    for (const lead of effectiveLeads) {
      const key = lead.pipeline_stage_id;
      if (grouped[key]) {
        grouped[key].push(lead);
      } else {
        grouped[key] = [lead];
      }
    }
    return grouped;
  }, [effectiveStages, effectiveLeads]);

  // Total pipeline value
  const totalValue = useMemo(
    () => effectiveLeads.reduce((sum, l) => sum + (Number(l.value) || 0), 0),
    [effectiveLeads]
  );

  useEffect(() => {
    fetchStages();
    fetchLeads();
  }, [fetchStages, fetchLeads]);

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Kanban size={18} className="text-accent" />
            <h2 className="text-sm font-medium text-text-secondary">Sales Pipeline</h2>
          </div>
          <div className="flex items-center gap-4 text-xs text-text-muted">
            <span>{effectiveLeads.length} leads</span>
            <span className="h-3 w-px bg-border" />
            <span>${totalValue.toLocaleString()} total value</span>
          </div>
        </div>

        <button
          onClick={() => { fetchStages(); fetchLeads(); }}
          className="btn-ghost text-xs gap-1.5"
          disabled={isLoading}
        >
          <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Board */}
      {isLoading && stages.length === 0 ? (
        <BoardSkeleton />
      ) : (
        <KanbanBoard stages={effectiveStages} leadsByStage={leadsByStage} />
      )}
    </div>
  );
}
