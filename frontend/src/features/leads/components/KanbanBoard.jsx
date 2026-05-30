import { memo, useCallback, useMemo } from 'react';
import { DragDropContext } from '@hello-pangea/dnd';
import KanbanColumn from './KanbanColumn';
import useLeadStore from '../../../store/leadStore';

/**
 * Top-level Kanban board wrapping the DragDropContext.
 * Receives stages and grouped leads; delegates drop events to the store.
 *
 * @param {{
 *   stages: object[],
 *   leadsByStage: Record<string, object[]>,
 * }} props
 */
function KanbanBoard({ stages, leadsByStage }) {
  const moveLead = useLeadStore((s) => s.moveLead);

  const sortedStages = useMemo(
    () => [...stages].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0)),
    [stages]
  );

  const handleDragEnd = useCallback(
    (result) => {
      const { draggableId, source, destination } = result;

      // Dropped outside a droppable, or back to the same spot
      if (!destination) return;
      if (
        source.droppableId === destination.droppableId &&
        source.index === destination.index
      ) {
        return;
      }

      // Optimistic move — store handles rollback on failure
      moveLead(draggableId, destination.droppableId);
    },
    [moveLead]
  );

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin">
        {sortedStages.map((stage) => (
          <KanbanColumn
            key={stage.id}
            stage={stage}
            leads={leadsByStage[stage.id] || []}
          />
        ))}
      </div>
    </DragDropContext>
  );
}

export default memo(KanbanBoard);
