import { memo } from 'react';
import { Droppable } from '@hello-pangea/dnd';
import { Plus } from 'lucide-react';
import KanbanCard from './KanbanCard';
import useUiStore from '../../../store/uiStore';

/**
 * Droppable Kanban column representing a single pipeline stage.
 *
 * @param {{
 *   stage: { id: string, name: string, color?: string, order_index?: number },
 *   leads: object[],
 * }} props
 */
function KanbanColumn({ stage, leads }) {
  const openModal = useUiStore((s) => s.openModal);

  const stageColor = stage.color || 'var(--color-accent)';

  return (
    <div className="flex w-[300px] shrink-0 flex-col rounded-xl bg-base/60" style={{ contentVisibility: 'auto' }}>
      {/* Column header */}
      <div className="flex items-center justify-between px-3 pt-3 pb-2">
        <div className="flex items-center gap-2">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ background: stageColor }}
          />
          <h3 className="text-sm font-semibold text-text-primary">{stage.name}</h3>
          <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-base-elevated px-1.5 text-2xs font-medium text-text-secondary">
            {leads.length}
          </span>
        </div>

        <button
          onClick={() => openModal('createLead', { stageId: stage.id })}
          className="
            flex h-6 w-6 items-center justify-center rounded-md
            text-text-muted transition-colors
            hover:bg-base-elevated hover:text-text-primary
          "
          aria-label={`Add lead to ${stage.name}`}
        >
          <Plus size={14} />
        </button>
      </div>

      {/* Droppable area */}
      <Droppable droppableId={stage.id}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`
              flex-1 space-y-2 overflow-y-auto px-2 pb-2
              rounded-b-xl transition-colors duration-200 min-h-[120px]
              ${snapshot.isDraggingOver
                ? 'bg-accent/5 ring-1 ring-inset ring-accent/20'
                : ''
              }
            `}
          >
            {leads.length === 0 && !snapshot.isDraggingOver && (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-base-elevated">
                  <Plus size={16} className="text-text-muted" />
                </div>
                <p className="text-xs text-text-muted">No leads in this stage</p>
                <button
                  onClick={() => openModal('createLead', { stageId: stage.id })}
                  className="mt-1.5 text-xs font-medium text-accent hover:text-accent-hover transition-colors"
                >
                  Add a lead
                </button>
              </div>
            )}

            {leads.map((lead, index) => (
              <KanbanCard key={lead.id} lead={lead} index={index} />
            ))}

            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  );
}

export default memo(KanbanColumn);
