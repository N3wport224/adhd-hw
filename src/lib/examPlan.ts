import { classDaysBetween, addDays, toDayKey } from "@/lib/schedule";
import { createId } from "@/lib/utils";
import type { Course, SubTask, Task } from "@/types";

/**
 * The run-up to an exam.
 *
 * This app's whole argument is that a deadline says when work is finished and
 * nothing about when to start — and then it left exams, the highest-stakes
 * items on the whole term, as a single row on a single day. An exam is the
 * one deadline where nothing is handed in, so nothing forces the work to
 * happen early, and the entire cost lands on the night before.
 *
 * Sessions are counted backwards from the exam rather than forwards from
 * today, because the days that matter are the ones next to it.
 */

/** How the sittings are spaced, nearest the exam first. */
const DAYS_BEFORE = [1, 2, 4, 7, 10, 14] as const;

/** Words that mean a mark is decided in one sitting with nothing to hand in. */
const EXAM_WORDS = /\b(exam|midterm|final|test|quiz)\b/i;

export interface ExamPlanOptions {
  /** How many revision sittings to lay out. */
  sessions: number;
  /** First day a sitting may fall on — normally today. */
  from: string;
  /** Days already spent in a class. */
  courses?: Course[];
}

/** True when a task is the kind of thing that wants a run-up. */
export function looksLikeAnExam(task: Task): boolean {
  return task.dueAt !== null && EXAM_WORDS.test(task.title);
}

/**
 * The days a revision plan would use, nearest the exam first.
 *
 * Returned in chronological order. Days already gone, and the exam day
 * itself, are never used: revising on the morning of is what this exists to
 * replace.
 */
export function revisionDays(
  examDay: string,
  options: ExamPlanOptions,
): string[] {
  const exam = new Date(`${examDay}T00:00:00`);
  const busy = classDaysBetween(options.courses ?? [], options.from, examDay);
  const wanted = Math.max(1, Math.min(options.sessions, DAYS_BEFORE.length));

  const chosen: string[] = [];
  const spare: string[] = [];

  for (const back of DAYS_BEFORE) {
    const day = toDayKey(addDays(exam, -back));
    if (day < options.from) continue;
    // A class night is kept in reserve rather than discarded: a run-up of two
    // sittings instead of four because the free days ran out is worse than
    // one of them landing after a lecture.
    if (busy.has(day)) spare.push(day);
    else chosen.push(day);
    if (chosen.length === wanted) break;
  }

  const days = [...chosen, ...spare.slice(0, Math.max(0, wanted - chosen.length))];
  return days.sort();
}

/**
 * Revision steps for an exam, on the days leading up to it.
 *
 * Each one names what it is for, because "study" is not a next action and an
 * unnamed session is one you can decide later and therefore never.
 */
export function revisionSteps(
  task: Task,
  options: ExamPlanOptions,
  makeId: () => string = createId,
): SubTask[] {
  if (task.dueAt === null) return [];
  const days = revisionDays(task.dueAt, options);
  if (days.length === 0) return [];

  const last = days.length - 1;
  return days.map((day, index) => ({
    id: makeId(),
    title:
      index === last
        ? "Last look: the things you keep getting wrong"
        : index === 0
          ? "First pass: read back over everything and mark what is shaky"
          : `Work the shaky parts, ${last - index === 1 ? "second" : "next"} pass`,
    done: false,
    // An hour is what a revision sitting is worth planning as. Shorter is not
    // a session; longer is a promise nobody keeps on a Tuesday.
    estimatedMinutes: 60,
    plannedFor: day,
  }));
}
