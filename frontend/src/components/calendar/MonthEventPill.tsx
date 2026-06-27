import { useDraggable } from '@dnd-kit/core';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import type { LocalEvent, PlacedEvent } from '@/lib/eventLayout';

interface MonthEventPillProps {
  pe: PlacedEvent;
  wIndex: number;
  handleEventClick: (event: LocalEvent, e: React.MouseEvent) => void;
}

export default function MonthEventPill({ pe, wIndex, handleEventClick }: MonthEventPillProps) {
  const isSpanning = pe.colSpan > 1 || pe.event.is_all_day;
  const color = pe.event.color || '#039BE5';

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `month-move-${pe.event.instance_id}-${wIndex}`,
    data: { type: 'move-month', event: pe.event },
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn(
        "px-1 pointer-events-auto transition-opacity",
        isDragging ? 'opacity-30' : 'opacity-100'
      )}
      style={{
        gridColumn: `${pe.colStart} / span ${pe.colSpan}`,
        gridRow: `${pe.track + 2}`,
      }}
    >
      <button
        onClick={(e) => handleEventClick(pe.event, e)}
        className={cn(
          'w-full text-left truncate rounded px-1.5 py-0.5 text-xs font-medium transition-all hover:brightness-95 focus-visible:ring-1 focus-visible:ring-primary-500 outline-none cursor-grab active:cursor-grabbing',
          isSpanning ? 'text-white shadow-[0_1px_2px_0_rgba(60,64,67,0.3)]' : 'bg-transparent hover:bg-black/5'
        )}
        style={isSpanning ? { backgroundColor: color } : { color: color }}
        title={`${pe.event.title}\n${pe.event.is_all_day ? 'All day' : format(pe.event.localStart, 'p')}`}
      >
        {!isSpanning && (
          <span
            className="inline-block w-2 h-2 rounded-full mr-1.5 align-baseline"
            style={{ backgroundColor: color }}
          />
        )}
        {!isSpanning && !pe.event.is_all_day && (
          <span className="font-semibold mr-1">
            {format(pe.event.localStart, 'h:mm a')}
          </span>
        )}
        {pe.event.title}
      </button>
    </div>
  );
}
