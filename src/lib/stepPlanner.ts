import { addDays, toDayKey } from "@/lib/schedule";

/**
 * Spreading the steps of a task across the days it has left.
 *
 * A due date says when something must be finished and nothing about when to
 * start, which is precisely the gap that turns a week of runway into a
 * Thursday night. Steps get their own days so the work arrives in the size a
 * single evening can hold.
 */

export interface PlanOptions {
  /** First day work can happen — normally today. */
  from: string;
  /** The deadline. Null plans forward at the requested pace instead. */
  due: string | null;
  /** How many steps a day should ideally carry. */
  perDay: number;
  /** Leave Saturdays and Sundays clear. */
  skipWeekends?: boolean;
}

export interface PlanSummary {
  /** One day per step, in order. */
  days: string[];
  /** Days that ended up carrying work. */
  daysUsed: number;
  /** The most any single day carries. */
  busiestDay: number;
  /** Whole days between the last planned step and the deadline. */
  daysSpare: number | null;
  /** True when the deadline forced more per day than was asked for. */
  crowded: boolean;
}

function isWeekend(day: string) {
  const weekday = new Date(`${day}T00:00:00`).getDay();
  return weekday === 0 || weekday === 6;
}

/** Every candidate working day from `from` to `due`, inclusive. */
function workingDays(from: string, due: string | null, needed: number, skipWeekends: boolean) {
  const days: string[] = [];
  const start = new Date(`${from}T00:00:00`);

  if (due && due >= from) {
    for (let offset = 0; ; offset += 1) {
      const day = toDayKey(addDays(start, offset));
      if (day > due) break;
      if (!skipWeekends || !isWeekend(day)) days.push(day);
      // A term-long deadline should not build a thousand-entry list.
      if (days.length >= 400) break;
    }
  }

  // No deadline, or a deadline already past, or a window that is entirely
  // weekend — plan forward from today at the requested pace instead.
  if (days.length === 0) {
    for (let offset = 0; days.length < needed; offset += 1) {
      const day = toDayKey(addDays(start, offset));
      if (!skipWeekends || !isWeekend(day)) days.push(day);
    }
  }

  return days;
}

/**
 * Assigns each step a day.
 *
 * Steps are spread across the whole window rather than packed against the
 * start: the point is a little every day, not a burst now and nothing after.
 * Spreading also leaves the last day or two clear, which is the buffer that
 * makes a deadline survive one bad evening.
 */
export function planStepDays(count: number, options: PlanOptions): PlanSummary {
  if (count <= 0) {
    return { days: [], daysUsed: 0, busiestDay: 0, daysSpare: null, crowded: false };
  }

  const perDay = Math.max(1, Math.floor(options.perDay));
  const needed = Math.ceil(count / perDay);
  const available = workingDays(options.from, options.due, needed, options.skipWeekends ?? false);

  // Use only as many days as the requested pace calls for, so "two a day"
  // does not become "one every third day" just because the deadline is far
  // off. When the deadline is nearer than that, every day gets used.
  const window = Math.min(available.length, needed);
  const days = Array.from({ length: count }, (_, index) => {
    const slot = Math.floor((index * window) / count);
    return available[Math.min(slot, available.length - 1)];
  });

  const perDayCounts = new Map<string, number>();
  for (const day of days) perDayCounts.set(day, (perDayCounts.get(day) ?? 0) + 1);
  const busiestDay = Math.max(...perDayCounts.values());

  const lastDay = days[days.length - 1];
  const daysSpare =
    options.due && options.due >= lastDay
      ? Math.round(
          (new Date(`${options.due}T00:00:00`).getTime() -
            new Date(`${lastDay}T00:00:00`).getTime()) /
            86_400_000,
        )
      : null;

  return {
    days,
    daysUsed: perDayCounts.size,
    busiestDay,
    daysSpare,
    crowded: busiestDay > perDay,
  };
}

/** "2 a day for 4 days, finishing 2 days early" */
export function describePlan(summary: PlanSummary) {
  if (summary.days.length === 0) return "Nothing to plan.";

  const pace =
    summary.busiestDay === 1
      ? "One a day"
      : `Up to ${summary.busiestDay} a day`;
  const span = `${summary.daysUsed} ${summary.daysUsed === 1 ? "day" : "days"}`;

  if (summary.daysSpare === null) return `${pace} over ${span}.`;
  if (summary.daysSpare === 0) return `${pace} over ${span}, finishing the day it is due.`;
  return `${pace} over ${span}, finishing ${summary.daysSpare} ${
    summary.daysSpare === 1 ? "day" : "days"
  } early.`;
}
