import { addDays, format, isSameDay, isToday, isTomorrow, startOfWeek } from "date-fns";
import type { Task } from "./data";

export function weekDays(base = new Date(), count = 5) {
  const start = startOfWeek(base, { weekStartsOn: 1 });
  return Array.from({ length: count }, (_, i) => addDays(start, i));
}

export function tasksOn(tasks: Task[], day: Date) {
  return tasks
    .filter((t) => t.scheduled_at && isSameDay(new Date(t.scheduled_at), day))
    .sort((a, b) => +new Date(a.scheduled_at!) - +new Date(b.scheduled_at!));
}

export function dueLabel(iso: string | null) {
  if (!iso) return "No deadline";
  const d = new Date(iso);
  const time = format(d, "h:mm a");
  if (isToday(d)) return `Due today · ${time}`;
  if (isTomorrow(d)) return `Due tomorrow · ${time}`;
  if (d < new Date()) return `Overdue · ${format(d, "EEE MMM d")}`;
  return `Due ${format(d, "EEE · MMM d")}`;
}

export const toLocalInput = (iso: string | null) => (iso ? format(new Date(iso), "yyyy-MM-dd'T'HH:mm") : "");
export const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : null);

export const scheduleTone: Record<string, string> = {
  high: "bg-rose/10 outline-rose/30",
  medium: "bg-elec/15 outline-elec/30",
  low: "bg-cyan/10 outline-cyan/30",
};
