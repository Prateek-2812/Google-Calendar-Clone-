import { startOfWeek, addDays } from 'date-fns';
import { useCalendarStore } from '@/store/calendarStore';
import TimeGrid from './TimeGrid';

export default function WeekView() {
  const { currentDate } = useCalendarStore();

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
  const weekDays  = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return <TimeGrid days={weekDays} />;
}
