import { typicalEfforts, effortLabel } from "@/lib/workHistory";
import type { PlannedStep } from "@/lib/schedule";
import type { Task } from "@/types";

/**
 * "I have twenty minutes" — a question the app could not answer.
 *
 * The day's list was all-or-nothing: everything planned, in one block, whether
 * you had the evening or the gap before a lecture. Twenty free minutes spent
 * looking at a list of two-hour jobs is twenty minutes spent deciding not to
 * start, and the honest thing to do with a small window is to show only what
 * fits in it.
 */

/** Assumed cost of a step nothing is known about, matching the week-load figure. */
const UNKNOWN_STEP_MINUTES = 30;

/** The windows worth offering. Beyond an hour, everything is on the table. */
export const TIME_WINDOWS = [15, 30, 60] as const;
export type TimeWindow = (typeof TIME_WINDOWS)[number];

/**
 * What a step is expected to cost: its own estimate, then the task's measured
 * history divided by its steps, then a modest guess.
 */
export function stepMinutes(entry: PlannedStep, tasks: Task[]): number {
  if (entry.step.estimatedMinutes !== null) return entry.step.estimatedMinutes;
  const typical = typicalEfforts(tasks).get(effortLabel(entry.task.title).toLowerCase());
  if (typical) return Math.round(typical.minutes / Math.max(1, entry.task.subtasks.length));
  return UNKNOWN_STEP_MINUTES;
}

/**
 * The steps that fit a window.
 *
 * A step whose estimate is only a guess is included in the largest window
 * regardless: filtering work out of view on the strength of an assumption is
 * how a list quietly becomes wrong.
 */
export function stepsThatFit(
  entries: PlannedStep[],
  minutes: TimeWindow | null,
  tasks: Task[],
): PlannedStep[] {
  if (minutes === null) return entries;
  return entries.filter((entry) => stepMinutes(entry, tasks) <= minutes);
}

/** "about 20 minutes" for a step, for the label beside it. */
export function describeStepMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round((minutes / 60) * 2) / 2;
  return `${Number.isInteger(hours) ? hours : `${Math.floor(hours)}½`} hr`;
}
