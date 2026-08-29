import { addDays, classDaysBetween, startOfWeek, stepsOnDay, toDayKey } from "@/lib/schedule";
import { typicalEfforts, effortLabel } from "@/lib/workHistory";
import type { Course, Task } from "@/types";

/**
 * What the week ahead actually asks of you, and what last week gave back.
 *
 * The planner spreads steps over the days before a deadline but never says
 * "this is more than fits" — so it quietly confirms an underestimate instead
 * of catching it. And nothing anywhere said what a week had produced, which
 * matters because the felt sense on a Friday evening is "I got nothing done"
 * almost regardless of what happened.
 */

/** Assumed cost of a step nothing is known about — a short sitting, not a day. */
const UNKNOWN_STEP_MINUTES = 30;

/** Hours in an evening, for someone whose classes run 5:15 to 8. */
const EVENING_HOURS = 3;

/** The share of the week that must be priced from real history to speak up. */
const MOSTLY_MEASURED = 0.6;

export interface WeekLoad {
  /** Steps planned from today to the end of the week. */
  steps: number;
  minutes: number;
  /** Days left in the week, today included. */
  daysLeft: number;
  /**
   * Days left that are not already spent in a class.
   *
   * Two evening classes take a third of the week's usable evenings, and a
   * capacity check that counts them as free is wrong in the direction that
   * lets a bad week arrive unannounced.
   */
  eveningsLeft: number;
  /** True when the plan needs more of each remaining day than an evening holds. */
  crowded: boolean;
  /** How much of the estimate came from something actually measured. */
  measured: number;
}

/**
 * The work planned between today and Saturday, priced from your own history
 * where there is any and from a modest guess where there is not.
 */
export function weekLoad(tasks: Task[], today = new Date(), courses: Course[] = []): WeekLoad {
  const efforts = typicalEfforts(tasks);
  const todayKey = toDayKey(today);
  const endOfWeek = toDayKey(addDays(startOfWeek(today), 6));

  let steps = 0;
  let minutes = 0;
  let measured = 0;

  for (let day = new Date(today); toDayKey(day) <= endOfWeek; day = addDays(day, 1)) {
    for (const entry of stepsOnDay(tasks, toDayKey(day))) {
      if (entry.step.done) continue;
      steps += 1;
      // A task's whole history divided by its steps: the record is kept
      // against the task, but what is planned for a day is one step of it.
      const known = entry.step.estimatedMinutes ?? stepShare(efforts, entry.task);
      if (known !== null && known !== undefined) measured += 1;
      minutes += known ?? UNKNOWN_STEP_MINUTES;
    }
  }

  const daysLeft = Math.max(
    1,
    Math.round(
      (new Date(`${endOfWeek}T00:00:00`).getTime() -
        new Date(`${todayKey}T00:00:00`).getTime()) /
        86_400_000,
    ) + 1,
  );

  const inClass = classDaysBetween(courses, todayKey, endOfWeek);
  // Never zero: a week that is entirely class nights still has some room in
  // it, and dividing by zero would report every week as a crisis.
  const eveningsLeft = Math.max(1, daysLeft - inClass.size);

  return {
    steps,
    minutes,
    daysLeft,
    eveningsLeft,
    measured,
    // Only worth saying out loud when most of the estimate is measured rather
    // than assumed. Priced at half an hour a step, a week of short discussion
    // posts looks like a crisis — and a warning that cries wolf is worse than
    // silence in an app whose whole point is not manufacturing dread.
    crowded:
      steps > 0 &&
      measured / steps >= MOSTLY_MEASURED &&
      minutes > eveningsLeft * EVENING_HOURS * 60,
  };
}

function stepShare(
  efforts: ReturnType<typeof typicalEfforts>,
  task: Task,
): number | null {
  const typical = efforts.get(effortLabel(task.title).toLowerCase());
  if (!typical) return null;
  return Math.round(typical.minutes / Math.max(1, task.subtasks.length));
}

/** "about 4½ hours" — vague on purpose, because the inputs are estimates. */
export function describeHours(minutes: number): string {
  if (minutes < 60) return `about ${Math.max(5, Math.round(minutes / 5) * 5)} minutes`;
  const halves = Math.round(minutes / 30) / 2;
  const label = Number.isInteger(halves) ? `${halves}` : `${Math.floor(halves)}½`;
  return `about ${label} ${halves === 1 ? "hour" : "hours"}`;
}

export interface WeekDone {
  steps: number;
  tasks: number;
  minutes: number;
}

/**
 * What the last seven days produced.
 *
 * Counted from the timestamps written when things were ticked, so it is a
 * record rather than an impression.
 */
export function weekDone(tasks: Task[], today = new Date()): WeekDone {
  const since = addDays(today, -7).toISOString();
  let steps = 0;
  let finished = 0;
  let minutes = 0;

  for (const task of tasks) {
    for (const step of task.subtasks) {
      if (step.done && step.doneAt && step.doneAt >= since) steps += 1;
    }
    if (task.status === "done" && task.doneAt && task.doneAt >= since) {
      finished += 1;
      minutes += task.focusMinutes ?? 0;
    }
  }

  return { steps, tasks: finished, minutes };
}
