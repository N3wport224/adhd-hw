import type { Course, SubTask, Task } from "@/types";

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

/** One step of a task, placed on the day it is meant to be done. */
export interface PlannedStep {
  task: Task;
  step: SubTask;
}

/**
 * The steps planned for a given day, across every task.
 *
 * Deadlines say when work is due; these say when to actually do it, which is
 * the half a calendar of due dates leaves out.
 */
export function stepsOnDay(tasks: Task[], dayKey: string): PlannedStep[] {
  const planned: PlannedStep[] = [];
  for (const task of tasks) {
    if (task.status === "done") continue;
    for (const step of task.subtasks) {
      if (step.plannedFor === dayKey) planned.push({ task, step });
    }
  }
  return planned;
}

/** Every step planned on or before `dayKey` and still not done. */
export function overdueSteps(tasks: Task[], dayKey: string): PlannedStep[] {
  const late: PlannedStep[] = [];
  for (const task of tasks) {
    if (task.status === "done") continue;
    for (const step of task.subtasks) {
      if (!step.done && step.plannedFor && step.plannedFor < dayKey) {
        late.push({ task, step });
      }
    }
  }
  return late;
}

/** Groups planned steps by day, the way `groupByDay` does for tasks. */
export function groupStepsByDay(tasks: Task[]) {
  const byDay = new Map<string, PlannedStep[]>();
  for (const task of tasks) {
    if (task.status === "done") continue;
    for (const step of task.subtasks) {
      if (!step.plannedFor) continue;
      const existing = byDay.get(step.plannedFor);
      if (existing) existing.push({ task, step });
      else byDay.set(step.plannedFor, [{ task, step }]);
    }
  }
  return byDay;
}

/** A class meeting placed on one particular day. */
export interface Meeting {
  course: Course;
  startTime: string | null;
  endTime: string | null;
  location: string;
}

/** How long a term runs when a course has no end date set. */
const DEFAULT_TERM_MONTHS = 4;

/**
 * The days between two dates on which you are in a class.
 *
 * Both the planner and the week-load warning treat an evening as free time,
 * which for someone with two classes running 5:15 to 8:00 is wrong twice a
 * week. An evening already spent is not somewhere to put work.
 */
export function classDaysBetween(
  courses: Course[],
  from: string,
  to: string,
): Set<string> {
  const days = new Set<string>();
  if (courses.length === 0 || to < from) return days;

  let cursor = new Date(`${from}T00:00:00`);
  // A term is not a decade; the bound stops a mistyped date walking for ever.
  for (let guard = 0; guard < 400; guard += 1) {
    const day = toDayKey(cursor);
    if (day > to) break;
    if (meetingsOnDay(courses, day).length > 0) days.add(day);
    cursor = addDays(cursor, 1);
  }
  return days;
}

/**
 * The span a course's weekly rules apply over.
 *
 * A term start with no end is common — syllabi say when a course begins far
 * more often than when it stops — so the end is assumed rather than left
 * open, which would repeat a Tuesday class for ever.
 */
export function termBounds(course: Course) {
  if (!course.termStart) return null;
  const start = course.termStart;
  const end =
    course.termEnd ??
    toDayKey(addMonths(new Date(`${start}T00:00:00`), DEFAULT_TERM_MONTHS));
  return { start, end };
}

/**
 * The classes meeting on a given day.
 *
 * Recurrence is computed rather than stored: a weekly class is a rule, and
 * expanding it into a row per week would put hundreds of near-identical
 * records in storage that all have to be revised the moment a room changes.
 */
export function meetingsOnDay(courses: Course[], dayKey: string): Meeting[] {
  const weekday = new Date(`${dayKey}T00:00:00`).getDay();

  return courses
    .filter((course) => {
      const pattern = course.meetingPattern;
      if (!pattern || pattern.days.length === 0) return false;
      if (!pattern.days.includes(weekday as (typeof pattern.days)[number])) return false;

      // Outside the term, the rule does not apply — otherwise a class would
      // appear to meet every Tuesday for ever.
      const bounds = termBounds(course);
      return bounds === null || (dayKey >= bounds.start && dayKey <= bounds.end);
    })
    .map((course) => ({
      course,
      startTime: course.meetingPattern?.startTime ?? null,
      endTime: course.meetingPattern?.endTime ?? null,
      location: course.meetingPattern?.location ?? "",
    }))
    .sort((a, b) => (a.startTime ?? "99").localeCompare(b.startTime ?? "99"));
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
