import { useDroppable } from '@dnd-kit/core';
import { format, isSameMonth, isSameDay } from 'date-fns';
import { cn } from '@/lib/utils';

interface MonthDayCellProps {
  day: Date;
  currentDate: Date;
  today: Date;
  handleCellClick: (day: Date, e: React.MouseEvent) => void;
  handleDayNumberClick: (day: Date, e: React.MouseEvent) => void;
}

export default function MonthDayCell({
  day,
  currentDate,
  today,
  handleCellClick,
  handleDayNumberClick,
}: MonthDayCellProps) {
  const isCurrentMonth = isSameMonth(day, currentDate);
  const isToday = isSameDay(day, today);
  const isWeekend = day.getDay() === 0 || day.getDay() === 6;

  const { setNodeRef, isOver } = useDroppable({
    id: `month-day-${day.toISOString()}`,
  });

  return (
    <div
      ref={setNodeRef}
      onClick={(e) => handleCellClick(day, e)}
      className={cn(
        'border-r border-[#dadce0] last:border-r-0 cursor-pointer transition-colors',
        !isCurrentMonth ? 'bg-[#fafafa]' : 'hover:bg-[#f8f9fa]',
        isWeekend && isCurrentMonth && 'bg-[#f8f9fa]/60',
        isOver && 'bg-[#e8f0fe]'
      )}
    >
      {/* Day number badge */}
      <div className="flex items-start justify-center p-1 md:justify-start md:pl-2">
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => handleDayNumberClick(day, e)}
          className={cn(
            'inline-flex items-center justify-center w-7 h-7 rounded-full text-sm font-medium z-10',
            'hover:bg-[#f1f3f4] transition-colors',
            !isCurrentMonth && 'text-[#b0b3b8]',
            isCurrentMonth && !isToday && 'text-[#3c4043]',
            isToday && 'bg-[#1a73e8] text-white hover:bg-[#1765cc]'
          )}
        >
          {day.getDate() === 1 && !isCurrentMonth
            ? format(day, 'MMM d')
            : format(day, 'd')}
        </span>
      </div>
    </div>
  );
}
