import type { Task } from "@/types";

/**
 * Calendar arithmetic for the schedule.
 *
 * Everything here works in local time. A due date is stored as the instant of
 * local midnight on the day the student picked, so grouping by UTC day would
 * shift half the term by one square for anyone west of Greenwich.
 */

export interface DayCell {
  /** Local calendar day, YYYY-MM-DD. The key tasks are grouped under. */
  key: string;
  date: Date;
  /** False for the leading and trailing days that pad a month grid. */
  inCurrentMonth: boolean;
  isToday: boolean;
}

export type ScheduleMode = "week" | "month";

export function toDayKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** The local calendar day a stored due date falls on. */
export function dayKeyOf(iso: string) {
  return toDayKey(new Date(iso));
}

export function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

export function addMonths(date: Date, months: number) {
  // Anchored to the 1st first, so stepping from the 31st does not skip a month.
  const copy = new Date(date.getFullYear(), date.getMonth() + months, 1);
  return copy;
}

export function startOfWeek(date: Date) {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return addDays(copy, -copy.getDay());
}

function cell(date: Date, monthOfGrid: number, todayKey: string): DayCell {
  const key = toDayKey(date);
  return {
    key,
    date,
    inCurrentMonth: date.getMonth() === monthOfGrid,
    isToday: key === todayKey,
  };
}

/** The seven days of the week containing `anchor`, Sunday first. */
export function weekDays(anchor: Date, today = new Date()): DayCell[] {
  const start = startOfWeek(anchor);
  const todayKey = toDayKey(today);
  return Array.from({ length: 7 }, (_, offset) =>
    cell(addDays(start, offset), anchor.getMonth(), todayKey),
  );
}

/**
 * A whole-week grid covering `anchor`'s month — always full weeks, so the
 * columns line up under their weekday headings.
 */
export function monthGrid(anchor: Date, today = new Date()): DayCell[] {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
  const start = startOfWeek(first);
  const todayKey = toDayKey(today);

  const cells: DayCell[] = [];
  for (let date = start; date <= last || cells.length % 7 !== 0; date = addDays(date, 1)) {
    cells.push(cell(date, anchor.getMonth(), todayKey));
    // A guard rather than a condition anyone has to reason about: six weeks
    // is the most any month can span.
    if (cells.length >= 42) break;
  }
  return cells;
}

/** Dated tasks, keyed by the local day they are due, each list date-ordered. */
export function groupByDay(tasks: Task[]) {
  const byDay = new Map<string, Task[]>();
  for (const task of tasks) {
    if (!task.dueAt) continue;
    const key = dayKeyOf(task.dueAt);
    const existing = byDay.get(key);
    if (existing) existing.push(task);
    else byDay.set(key, [task]);
  }
  for (const list of byDay.values()) {
    list.sort((a, b) => (a.dueAt ?? "").localeCompare(b.dueAt ?? "") || a.title.localeCompare(b.title));
  }
  return byDay;
}

/**
 * The next day at or after `fromKey` that still has unfinished work.
 *
 * A student who has just imported a term of dates and lands on a quiet week
 * has no way to tell an empty calendar from a broken import. This is what
 * lets the view say "nothing this week, the next thing is here".
 */
export function nextDayWithWork(fromKey: string, tasksByDay: Map<string, Task[]>) {
  let best: string | null = null;
  for (const [key, tasks] of tasksByDay) {
    if (key < fromKey) continue;
    if (!tasks.some((task) => task.status !== "done")) continue;
    if (best === null || key < best) best = key;
  }
  return best;
}

/**
 * The span a week view is showing, for the heading.
 *
 * Assembled from whole formats rather than by asking for a partial one:
 * `toLocaleDateString` with a day and a year but no month is not a format any
 * locale defines, and browsers answer it with a debug string.
 */
export function describeWeek(anchor: Date) {
  const start = startOfWeek(anchor);
  const end = addDays(start, 6);
  const monthDay = (date: Date) =>
    date.toLocaleDateString(undefined, { month: "short", day: "numeric" });

  if (start.getFullYear() !== end.getFullYear()) {
    return `${monthDay(start)}, ${start.getFullYear()} – ${monthDay(end)}, ${end.getFullYear()}`;
  }
  if (start.getMonth() !== end.getMonth()) {
    return `${monthDay(start)} – ${monthDay(end)}, ${end.getFullYear()}`;
  }
  return `${monthDay(start)} – ${end.getDate()}, ${end.getFullYear()}`;
}

export function describeMonth(anchor: Date) {
  return anchor.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}
