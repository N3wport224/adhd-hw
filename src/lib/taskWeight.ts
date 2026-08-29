import { singular } from "@/lib/utils";
import { effortLabel } from "@/lib/workHistory";
import type { Course, GradeWeight, Task } from "@/types";

/**
 * What a piece of work is worth, from the grading breakdown the course
 * already carries.
 *
 * The app parses the breakdown, draws it as a chart, and then ranks
 * everything by date alone — so a discussion post worth one percent sits
 * level with a final worth twenty-five. That is fine on a quiet week and
 * useless on the week you have to drop something, which is exactly when the
 * question gets asked.
 */

/** Below this a category is not worth mentioning next to a task. */
const WORTH_SAYING = 5;

function normalise(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Words a category and a task title share once the plurals are off. */
function words(text: string): Set<string> {
  return new Set(
    normalise(text)
      .split(" ")
      .filter((word) => word.length > 2)
      .map(singular),
  );
}

/**
 * The grading category a task belongs to, matched on the words they share.
 *
 * "Quiz 7" against "Quizzes", "Project Assignment 3" against "Project
 * Assignments". Deliberately conservative: no shared word, no claim.
 */
export function categoryOf(task: Task, course: Course | null): GradeWeight | null {
  const weights = course?.gradingWeights ?? [];
  if (weights.length === 0) return null;

  // The task without the number that only says which week it is.
  const taskWords = words(effortLabel(task.title));
  if (taskWords.size === 0) return null;

  let best: { weight: GradeWeight; overlap: number } | null = null;
  for (const weight of weights) {
    const categoryWords = words(weight.label);
    let overlap = 0;
    for (const word of taskWords) if (categoryWords.has(word)) overlap += 1;
    if (overlap === 0) continue;
    if (!best || overlap > best.overlap) best = { weight, overlap };
  }

  return best ? best.weight : null;
}

export function gradeShareOf(task: Task, course: Course | null): number | null {
  return categoryOf(task, course)?.percent ?? null;
}

/**
 * The share of the grade one instance of this work carries.
 *
 * A category is split across everything in it: thirteen quizzes worth
 * thirteen percent are one percent each, and saying "13%" beside a single
 * quiz would be a lie in the direction that causes panic.
 */
export function taskShareOf(task: Task, course: Course | null, siblings: Task[]): number | null {
  const share = gradeShareOf(task, course);
  if (share === null) return null;

  const label = effortLabel(task.title).toLowerCase();
  const count = siblings.filter(
    (other) => other.courseId === task.courseId && effortLabel(other.title).toLowerCase() === label,
  ).length;

  return count > 1 ? share / count : share;
}

/** "worth 25% of the grade" — only when it is big enough to change a decision. */
export function describeShare(share: number | null): string | null {
  if (share === null || share < WORTH_SAYING) return null;
  return `worth ${Math.round(share)}% of the grade`;
}
