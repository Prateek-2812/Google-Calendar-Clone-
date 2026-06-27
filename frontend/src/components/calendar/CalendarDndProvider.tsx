import { useState } from 'react';
import {
  DndContext,
  DragOverlay,
  useSensor,
  useSensors,
  PointerSensor,
  closestCenter,
  type Modifier,
  type DragStartEvent,
  type DragMoveEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { restrictToWindowEdges } from '@dnd-kit/modifiers';
import { format, addMinutes, differenceInMinutes } from 'date-fns';
import { useMutateEventPatch } from '@/hooks/useMutateEventPatch';
import DraggableEventCard from './DraggableEventCard';
import type { LocalEvent } from '@/lib/eventLayout';

interface Props {
  children: React.ReactNode;
}

/** Snaps the dragged element to 15-minute intervals (15px in our grid). */
const snapTo15Min: Modifier = ({ transform }) => ({
  ...transform,
  y: Math.round(transform.y / 15) * 15,
  x: 0, // lock horizontal movement for time-grid drags
});

export default function CalendarDndProvider({ children }: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  );

  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeEvent, setActiveEvent] = useState<LocalEvent | null>(null);
  const [activeType, setActiveType] = useState<'move' | 'move-month' | 'resize' | null>(null);
  const [dragOffsetY, setDragOffsetY] = useState(0);

  const mutation = useMutateEventPatch();

  // ── Handlers ──────────────────────────────────────────────────

  const handleDragStart = ({ active }: DragStartEvent) => {
    setActiveId(String(active.id));
    setActiveEvent(active.data.current?.event ?? null);
    setActiveType(active.data.current?.type ?? null);
    setDragOffsetY(0);
  };

  const handleDragMove = ({ delta }: DragMoveEvent) => {
    setDragOffsetY(delta.y);
  };

  const handleDragEnd = ({ active, delta, over }: DragEndEvent) => {
    // Reset visual state immediately
    setActiveId(null);
    setActiveEvent(null);
    setActiveType(null);
    setDragOffsetY(0);

    const evt = active.data.current?.event as LocalEvent | undefined;
    const type = active.data.current?.type as string | undefined;

    if (!evt || (delta.x === 0 && delta.y === 0)) return;

    // Snap delta to 15-min intervals on Y axis
    const minutesDelta = Math.round(delta.y / 15) * 15;

    let newStart = new Date(evt.localStart);
    let newEnd = new Date(evt.localEnd);

    if (type === 'move') {
      // ── Time-grid move ──
      if (over?.id && String(over.id).startsWith('day-')) {
        // Dropped onto a different day column — change the date, keep the time
        const dropDate = new Date(String(over.id).replace('day-', ''));
        newStart = new Date(dropDate);
        newStart.setHours(evt.localStart.getHours(), evt.localStart.getMinutes(), 0, 0);
        newEnd = new Date(newStart.getTime() + differenceInMinutes(evt.localEnd, evt.localStart) * 60_000);
      }
      // Apply vertical time offset
      newStart = addMinutes(newStart, minutesDelta);
      newEnd   = addMinutes(newEnd,   minutesDelta);

    } else if (type === 'move-month') {
      // ── Month-view move ──
      if (!over?.id || !String(over.id).startsWith('month-day-')) return;
      const dropDate = new Date(String(over.id).replace('month-day-', ''));
      const durationMs = evt.localEnd.getTime() - evt.localStart.getTime();
      newStart = new Date(dropDate);
      newStart.setHours(evt.localStart.getHours(), evt.localStart.getMinutes(), 0, 0);
      newEnd = new Date(newStart.getTime() + durationMs);

    } else if (type === 'resize') {
      // ── Bottom-handle resize (end time only) ──
      newEnd = addMinutes(newEnd, minutesDelta);
      if (newEnd <= newStart) return; // prevent 0/negative duration
    } else {
      return;
    }

    mutation.mutate({
      instanceId: evt.instance_id,
      eventId: evt.event_id,
      isRecurring: !!evt.recurrence_rule,
      originalStartUtc: evt.original_start_utc,
      newStartUtc: newStart.toISOString(),
      newEndUtc: newEnd.toISOString(),
    });
  };

  // ── Live drag labels ───────────────────────────────────────────

  let liveTimeLabel: string | undefined;
  let liveDurationLabel: string | undefined;

  if (activeEvent && (activeType === 'move' || activeType === 'resize')) {
    const snappedDelta = Math.round(dragOffsetY / 15) * 15;
    if (activeType === 'move') {
      const s = addMinutes(activeEvent.localStart, snappedDelta);
      const e = addMinutes(activeEvent.localEnd, snappedDelta);
      liveTimeLabel = `${format(s, 'h:mm a')} – ${format(e, 'h:mm a')}`;
    } else {
      const e = addMinutes(activeEvent.localEnd, snappedDelta);
      liveTimeLabel = `${format(activeEvent.localStart, 'h:mm a')} – ${format(e, 'h:mm a')}`;
      const diffM = Math.max(15, differenceInMinutes(e, activeEvent.localStart));
      const h = Math.floor(diffM / 60);
      const m = diffM % 60;
      liveDurationLabel = h > 0 ? `${h} hr${m > 0 ? ` ${m} min` : ''}` : `${m} min`;
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={activeType === 'move-month' ? [restrictToWindowEdges] : [restrictToWindowEdges, snapTo15Min]}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
    >
      {children}

      <DragOverlay dropAnimation={null}>
        {activeId && activeEvent ? (
          activeType === 'move-month' ? (
            /* Month pill ghost */
            <div
              className="px-2 py-0.5 rounded text-xs font-medium text-white shadow-lg opacity-90 pointer-events-none"
              style={{ backgroundColor: activeEvent.color || '#039BE5', minWidth: 80 }}
            >
              {activeEvent.title}
            </div>
          ) : (
            /* Time-grid ghost card */
            <DraggableEventCard
              event={activeEvent}
              color={activeEvent.color || '#039BE5'}
              onClick={() => {}}
              style={{ position: 'relative', width: '100%', height: '100%' }}
              isDraggingOverlay
              liveTimeLabel={liveTimeLabel}
              liveDurationLabel={liveDurationLabel}
            />
          )
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
