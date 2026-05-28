import { User, DollarSign } from 'lucide-react';
import { Draggable } from '@hello-pangea/dnd';

/* --------------------------------------------------------------------------
   Score → tier mapping for visual badge
   -------------------------------------------------------------------------- */

function scoreTier(score) {
  if (score == null) return { label: '—', color: 'bg-base-elevated text-text-secondary' };
  if (score >= 70) return { label: 'Hot', color: 'bg-[var(--color-danger-muted)] text-danger' };
  if (score >= 40) return { label: 'Warm', color: 'bg-[var(--color-warning-muted)] text-warning' };
  return { label: 'Cold', color: 'bg-[var(--color-info-muted)] text-[var(--color-info)]' };
}

/**
 * Draggable lead card for the Kanban board.
 *
 * @param {{
 *   lead: object,
 *   index: number,
 * }} props
 */
export default function KanbanCard({ lead, index }) {
  const tier = scoreTier(lead.score);

  const initials = lead.assigned_name
    ? lead.assigned_name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : null;

  return (
    <Draggable draggableId={lead.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={`
            group rounded-lg border bg-base-surface p-3.5
            transition-all duration-150 cursor-grab active:cursor-grabbing
            ${snapshot.isDragging
              ? 'border-accent shadow-lg shadow-accent/10 scale-[1.02] rotate-[0.5deg]'
              : 'border-border hover:border-[var(--color-border-light)]'
            }
          `}
          style={{
            ...provided.draggableProps.style,
          }}
        >
          {/* Customer name */}
          <p className="text-sm font-medium text-text-primary mb-2 leading-snug truncate">
            {lead.customer_name || lead.title || 'Untitled Lead'}
          </p>

          {/* Meta row */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Score badge */}
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-2xs font-semibold ${tier.color}`}>
              {lead.score != null ? `${lead.score} · ${tier.label}` : tier.label}
            </span>

            {/* Value */}
            {lead.value != null && (
              <span className="inline-flex items-center gap-0.5 text-2xs text-text-secondary">
                <DollarSign size={10} />
                {Number(lead.value).toLocaleString()}
              </span>
            )}
          </div>

          {/* Footer: source + assignee */}
          <div className="mt-3 flex items-center justify-between">
            {lead.source && (
              <span className="text-2xs text-text-muted capitalize truncate max-w-[100px]">
                {lead.source}
              </span>
            )}

            {initials ? (
              <div
                className="
                  flex h-6 w-6 items-center justify-center rounded-full
                  bg-accent/15 text-2xs font-semibold text-accent
                  ring-2 ring-base-surface
                "
                title={lead.assigned_name}
              >
                {initials}
              </div>
            ) : (
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-base-elevated text-text-muted">
                <User size={10} />
              </div>
            )}
          </div>
        </div>
      )}
    </Draggable>
  );
}
