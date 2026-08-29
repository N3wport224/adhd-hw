import { categoryOf } from "@/lib/taskWeight";
import type { Course, Task } from "@/types";

/**
 * Where you actually stand, from marks you enter yourself.
 *
 * The app already reads what everything is worth and never asks what you got,
 * which leaves the one number that governs how a term feels entirely to
 * imagination. Imagination is not neutral about it: with nothing to check
 * against, a bad quiz becomes the whole grade, and the answer to "am I
 * failing?" is whatever mood is asking. A real number is usually kinder than
 * the guess, and when it is not, it is at least actionable.
 *
 * No letter grades. Every school cuts them differently and a wrong B+ is
 * worse than no letter at all — you set the target you are aiming at and this
 * says what it would take.
 */

/** One grading category, and how much of it has been settled. */
export interface CategoryStanding {
  label: string;
  /** The category's share of the final grade, per the syllabus. */
  weight: number;
  /** Tasks in this category that carry a mark. */
  gradedCount: number;
  /** Every task in the category, marked or not. */
  totalCount: number;
  /** The average across what is marked, 0–100. Null when nothing is. */
  average: number | null;
  /** Percentage points of the final grade this category has already earned. */
  banked: number;
  /** Percentage points of the final grade this category has already decided. */
  settled: number;
}

export interface CourseStanding {
  categories: CategoryStanding[];
  /** Percentage points of the final grade earned so far. */
  banked: number;
  /** Percentage points already decided, earned or lost. */
  settled: number;
  /** Percentage points still to play for. */
  remaining: number;
  /** The average across everything marked so far, 0–100. Null when nothing is. */
  standing: number | null;
}

function scored(task: Task): boolean {
  return task.score != null && task.score.outOf > 0;
}

/**
 * A course's standing from its tasks.
 *
 * Each category's weight is split by how much of it has been handed back:
 * five of thirteen quizzes marked settles five thirteenths of the quiz
 * weight, and leaves the rest to play for. Counting the whole weight as
 * decided on the first quiz would read as a catastrophe every October.
 */
export function courseStanding(course: Course, tasks: Task[]): CourseStanding {
  const weights = course.gradingWeights ?? [];
  const mine = tasks.filter((task) => task.courseId === course.id);

  const categories: CategoryStanding[] = weights.map((weight) => {
    const items = mine.filter((task) => categoryOf(task, course)?.label === weight.label);
    const marked = items.filter(scored);

    const earned = marked.reduce((sum, task) => sum + task.score!.earned, 0);
    const outOf = marked.reduce((sum, task) => sum + task.score!.outOf, 0);
    const average = outOf > 0 ? (earned / outOf) * 100 : null;

    // Nothing in the category at all means nothing to split it by, so it
    // stays entirely to play for rather than dividing by zero.
    const share = items.length > 0 ? marked.length / items.length : 0;
    const settled = weight.percent * share;

    return {
      label: weight.label,
      weight: weight.percent,
      gradedCount: marked.length,
      totalCount: items.length,
      average,
      banked: average === null ? 0 : (settled * average) / 100,
      settled,
    };
  });

  const banked = categories.reduce((sum, item) => sum + item.banked, 0);
  const settled = categories.reduce((sum, item) => sum + item.settled, 0);
  const total = weights.reduce((sum, weight) => sum + weight.percent, 0);

  return {
    categories,
    banked,
    settled,
    // Against the syllabus's own total rather than a flat 100: a breakdown
    // that adds to 98 is a rounding artefact, not two free points.
    remaining: Math.max(0, total - settled),
    standing: settled > 0 ? (banked / settled) * 100 : null,
  };
}

/** What every remaining point must average for a target to still be reachable. */
export interface Needed {
  /** The average required across everything left, 0–100. */
  average: number;
  /** True when the target is already secured whatever happens next. */
  alreadyThere: boolean;
  /** True when no possible result on the rest can reach it. */
  outOfReach: boolean;
}

/**
 * What the rest of the term has to average to land on a target.
 *
 * The question a student actually asks in November, and the one thing a pile
 * of marks cannot answer by being looked at.
 */
export function neededForTarget(standing: CourseStanding, target: number): Needed | null {
  if (standing.remaining <= 0) return null;
  const average = ((target - standing.banked) / standing.remaining) * 100;
  return {
    average,
    alreadyThere: average <= 0,
    outOfReach: average > 100,
  };
}

/** One line for a course card: "82% so far · 61 points still to play for". */
export function describeStanding(standing: CourseStanding): string | null {
  if (standing.standing === null) return null;
  return `${Math.round(standing.standing)}% so far, across ${Math.round(standing.settled)}% of the grade`;
}
