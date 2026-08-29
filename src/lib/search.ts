import { EXTRA_SECTIONS, NAV_ITEMS } from "@/components/layout/navigation";
import type { AppData } from "@/types";

/**
 * Finding one thing among a term of them.
 *
 * Two courses come to something like seventy tasks, two hundred steps and a
 * shelf of readings, and the only way to reach any of it was to remember
 * where it lives and navigate there. Remembering where things live is not a
 * reasonable thing to ask of the person this app is for.
 */

export type ResultKind = "course" | "task" | "step" | "document" | "page";

export interface SearchResult {
  id: string;
  kind: ResultKind;
  title: string;
  /** What it belongs to — a course code, a parent task. */
  context: string | null;
  href: string;
  /** Higher sorts first. */
  score: number;
}

const KIND_ORDER: Record<ResultKind, number> = {
  page: 0,
  course: 1,
  task: 2,
  step: 3,
  document: 4,
};

function normalise(text: string) {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * How well a haystack answers a query, or null for not at all.
 *
 * A prefix beats a word start beats a substring, which is what makes typing
 * "mid" put the midterm above a task that merely mentions it. Every term has
 * to appear somewhere, so "quiz 3" does not match every quiz.
 */
function rank(haystack: string, terms: string[]): number | null {
  const hay = normalise(haystack);
  let total = 0;

  for (const term of terms) {
    const at = hay.indexOf(term);
    if (at < 0) return null;
    total += at === 0 ? 3 : hay[at - 1] === " " ? 2 : 1;
  }

  // Shorter titles win ties: "Quiz 3" is a better answer to "quiz" than
  // "Read chapter 4 before the quiz".
  return total * 10 - Math.min(9, Math.floor(hay.length / 20));
}

/** Everything matching, best first. */
export function searchApp(data: AppData, query: string, limit = 12): SearchResult[] {
  const terms = normalise(query).split(" ").filter(Boolean);
  if (terms.length === 0) return [];

  const results: SearchResult[] = [];
  const courseOf = new Map(data.courses.map((course) => [course.id, course]));
  const label = (courseId: string | null) => {
    const course = courseId === null ? null : courseOf.get(courseId);
    return course ? course.code || course.name : null;
  };

  // Settings is not in the main nav but is very much a place you go, and its
  // blurb is searched as a fallback so "backup" finds it without knowing that
  // backups live under settings.
  for (const item of [...NAV_ITEMS, ...EXTRA_SECTIONS]) {
    const byLabel = rank(item.label, terms);
    const score = byLabel ?? (rank(item.blurb, terms) === null ? null : 1);
    if (score !== null) {
      results.push({
        id: `page-${item.href}`,
        kind: "page",
        title: item.label,
        context: null,
        href: item.href,
        score,
      });
    }
  }

  for (const course of data.courses) {
    const score = rank(`${course.name} ${course.code}`, terms);
    if (score !== null) {
      results.push({
        id: course.id,
        kind: "course",
        title: course.name,
        context: course.code || null,
        href: `/courses/${course.id}`,
        score,
      });
    }
  }

  for (const task of data.tasks) {
    const score = rank(task.title, terms);
    if (score !== null) {
      results.push({
        id: task.id,
        kind: "task",
        title: task.title,
        context: label(task.courseId),
        href: "/tasks",
        score: score + (task.status === "done" ? -15 : 0),
      });
    }

    // Steps are searched too: "the risk section" is a step, and it is what
    // someone actually remembers about a week's work.
    for (const step of task.subtasks) {
      const stepScore = rank(step.title, terms);
      if (stepScore !== null) {
        results.push({
          id: step.id,
          kind: "step",
          title: step.title,
          context: task.title,
          href: "/tasks",
          score: stepScore - 5 + (step.done ? -15 : 0),
        });
      }
    }
  }

  for (const document of data.documents) {
    const score = rank(document.title, terms);
    if (score !== null) {
      results.push({
        id: document.id,
        kind: "document",
        title: document.title,
        context: label(document.courseId),
        href: `/reader/${document.id}`,
        score,
      });
    }
  }

  return results
    .sort((a, b) => b.score - a.score || KIND_ORDER[a.kind] - KIND_ORDER[b.kind])
    .slice(0, limit);
}

export const KIND_LABELS: Record<ResultKind, string> = {
  page: "Page",
  course: "Course",
  task: "Task",
  step: "Step",
  document: "Reading",
};
