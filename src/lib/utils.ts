/** Joins class names, dropping falsy values. */
export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function startOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

/** Whole days from today to `iso`. Negative means overdue. */
export function daysUntil(iso: string, now = new Date()) {
  const target = startOfDay(new Date(iso)).getTime();
  const today = startOfDay(now).getTime();
  return Math.round((target - today) / 86_400_000);
}

/**
 * Deliberately vague for anything past this week — precise countdowns on
 * far-off work are a source of background dread rather than useful signal.
 */
export function describeDueDate(iso: string | null, now = new Date()) {
  if (!iso) return "No due date";
  const days = daysUntil(iso, now);
  if (days < -1) return `${Math.abs(days)} days late`;
  if (days === -1) return "Due yesterday";
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  if (days <= 6) {
    return `Due ${new Date(iso).toLocaleDateString(undefined, { weekday: "long" })}`;
  }
  return `Due ${new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
}

export function formatClock(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
