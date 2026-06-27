import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Merge Tailwind CSS class names safely. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format an ISO date string to a localized display string. */
export function formatDate(isoString: string, options?: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    ...options,
  }).format(new Date(isoString));
}

/** Returns true if a date is today. */
export function isToday(date: Date): boolean {
  const today = new Date();
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}

/** Returns the ISO week number for a given date. */
export function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/** Get the days of the week containing a given date (Sun–Sat). */
export function getWeekDays(date: Date): Date[] {
  const start = new Date(date);
  const day = start.getDay();
  start.setDate(start.getDate() - day);

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

/** Get all days in the month grid (up to 6 weeks) for a given date. */
export function getMonthDays(year: number, month: number): Date[] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const days: Date[] = [];

  // Pad start with previous month days
  const startPad = firstDay.getDay();
  for (let i = startPad - 1; i >= 0; i--) {
    const d = new Date(firstDay);
    d.setDate(firstDay.getDate() - i - 1);
    days.push(d);
  }

  // Current month days
  for (let i = 1; i <= lastDay.getDate(); i++) {
    days.push(new Date(year, month, i));
  }

  // Pad end to complete the grid (42 cells = 6 weeks)
  const remaining = 42 - days.length;
  for (let i = 1; i <= remaining; i++) {
    const d = new Date(lastDay);
    d.setDate(lastDay.getDate() + i);
    days.push(d);
  }

  return days;
}
