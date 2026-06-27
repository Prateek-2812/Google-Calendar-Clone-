import { useDroppable } from '@dnd-kit/core';
import { cn } from '@/lib/utils';
import DraggableEventCard from './DraggableEventCard';
import type { LocalEvent, PlacedDayEvent } from '@/lib/eventLayout';

interface DayColumnProps {
  day: Date;
  isToday: boolean;
  placedEvents: PlacedDayEvent[];
  handleCellClick: (day: Date, hour: number, e: React.MouseEvent) => void;
  handleEventClick: (event: LocalEvent, e: React.MouseEvent) => void;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);

export default function DayColumn({
  day,
  isToday,
  placedEvents,
  handleCellClick,
  handleEventClick,
}: DayColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `day-${day.toISOString()}`,
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex-1 relative border-r border-[#dadce0] last:border-r-0',
        isToday && 'bg-[#f0f4ff]/30',
        isOver && 'bg-[#e8f0fe]/50' // Highlight column when dragging over
      )}
    >
      {/* Clickable time slots */}
      <div className="absolute inset-0 z-0 flex flex-col">
        {HOURS.map((h) => (
          <div
            key={h}
            className="flex-1 cursor-pointer hover:bg-black/5 transition-colors"
            onClick={(e) => handleCellClick(day, h, e)}
          />
        ))}
      </div>

      {/* Absolute Event Cards */}
      {placedEvents.map((pe) => (
        <DraggableEventCard
          key={pe.event.instance_id}
          event={pe.event}
          color={pe.event.color || '#039BE5'}
          onClick={(e) => handleEventClick(pe.event, e)}
          style={{
            top: `${pe.topPercent}%`,
            height: `${pe.heightPercent}%`,
            left: `${pe.leftPercent}%`,
            width: `${pe.widthPercent}%`,
          }}
        />
      ))}
    </div>
  );
}
