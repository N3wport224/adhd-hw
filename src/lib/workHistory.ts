import { summariseAssignments } from "@/lib/syllabusParser";
import type { Task } from "@/types";

/**
 * How long this kind of work has actually taken, from your own record.
 *
 * Time blindness is the deficit, not laziness: asked to estimate, most people
 * guess badly and ADHD guesses worse, and no amount of typing a number into a
 * field fixes that. What does help is being shown the last few times you did
 * this exact thing.
 *
 * "This exact thing" is the assignment stripped of the number that only tells
 * one week from another — "Quiz 7" and "Quiz 8" are the same task twice, and
 * a term of them is a real sample.
 */

/** Below this a sample is an anecdote, not a pattern. */
const ENOUGH_SAMPLES = 2;

export interface TypicalEffort {
  label: string;
  /** Median minutes, which a single marathon session cannot drag around. */
  minutes: number;
  samples: number;
}

/** The name a task shares with its siblings: "Quiz 7" and "Quiz 8" are both "Quiz". */
export function effortLabel(title: string): string {
  return summariseAssignments([title])[0]?.label ?? title;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[middle - 1] + sorted[middle]) / 2)
    : sorted[middle];
}

/**
 * What each kind of work has typically cost, across every task that recorded
 * any focus time at all.
 */
export function typicalEfforts(tasks: Task[]): Map<string, TypicalEffort> {
  const byLabel = new Map<string, number[]>();

  for (const task of tasks) {
    const minutes = task.focusMinutes ?? 0;
    if (minutes <= 0) continue;
    const label = effortLabel(task.title);
    const existing = byLabel.get(label.toLowerCase());
    if (existing) existing.push(minutes);
    else byLabel.set(label.toLowerCase(), [minutes]);
  }

  const result = new Map<string, TypicalEffort>();
  for (const [key, values] of byLabel) {
    if (values.length < ENOUGH_SAMPLES) continue;
    result.set(key, {
      label: effortLabel(tasks.find((t) => effortLabel(t.title).toLowerCase() === key)?.title ?? key),
      minutes: median(values),
      samples: values.length,
    });
  }
  return result;
}

/** What this particular task is likely to take, if there is anything to go on. */
export function typicalFor(tasks: Task[], title: string): TypicalEffort | null {
  return typicalEfforts(tasks).get(effortLabel(title).toLowerCase()) ?? null;
}

/** "About 40 minutes, going by the last 3." */
export function describeTypical(effort: TypicalEffort): string {
  const hours = Math.floor(effort.minutes / 60);
  const rest = effort.minutes % 60;
  const time =
    hours > 0 ? `${hours}h${rest > 0 ? ` ${rest}m` : ""}` : `${effort.minutes} minutes`;
  return `About ${time}, going by the last ${effort.samples}`;
}
