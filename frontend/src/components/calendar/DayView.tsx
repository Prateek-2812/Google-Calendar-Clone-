import { useCalendarStore } from '@/store/calendarStore';
import TimeGrid from './TimeGrid';

export default function DayView() {
  const { currentDate } = useCalendarStore();

  return <TimeGrid days={[currentDate]} />;
}
