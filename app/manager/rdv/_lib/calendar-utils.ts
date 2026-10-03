import type { Meeting } from "../_types";

function toLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function buildCalendarMeetings(meetings: Meeting[]): Map<string, Meeting[]> {
  const map = new Map<string, Meeting[]>();
  for (const m of meetings) {
    if (!m.callbackDate) continue;
    const key = toLocalDateKey(new Date(m.callbackDate));
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(m);
  }
  return map;
}

export function buildCalendarDays(calendarDate: Date): { date: Date; inMonth: boolean }[] {
  const year = calendarDate.getFullYear();
  const month = calendarDate.getMonth();
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const startDay = (first.getDay() + 6) % 7;
  const days: { date: Date; inMonth: boolean }[] = [];
  for (let i = startDay - 1; i >= 0; i--) {
    const d = new Date(year, month, -i);
    days.push({ date: d, inMonth: false });
  }
  for (let d = 1; d <= last.getDate(); d++) {
    days.push({ date: new Date(year, month, d), inMonth: true });
  }
  while (days.length % 7 !== 0) {
    const d = new Date(year, month + 1, days.length - last.getDate() - startDay + 1);
    days.push({ date: d, inMonth: false });
  }
  return days;
}

export function buildWeekDays(calendarDate: Date): Date[] {
  const weekStart = new Date(calendarDate);
  const day = weekStart.getDay();
  weekStart.setDate(weekStart.getDate() - ((day + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });
}
