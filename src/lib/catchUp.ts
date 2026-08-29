import { planStepDays } from "@/lib/stepPlanner";
import { classDaysBetween, toDayKey } from "@/lib/schedule";
import type { Course, SubTask, Task } from "@/types";

/**
 * Getting back on the horse after a bad week.
 *
 * Falling behind is the normal case, not the exception, and until now the app
 * had no answer for it. Steps that slipped kept their old day for ever, so
 * the plan slowly turned into a list of days you failed on — which is the
 * single most reliable way to make someone close an app and not open it
 * again. Nothing here is deleted or hidden. The work is simply given days
 * that have not happened yet.
 */

/** What re-planning would do, before anything is written. */
export interface CatchUpPlan {
  /** Tasks with at least one step that slipped, and their new days. */
  tasks: {
    task: Task;
    /** The steps that had a day in the past. */
    slipped: SubTask[];
    /** Every step of the task, with the open ones re-dated. */
    subtasks: SubTask[];
    /** True when the deadline is already behind us. */
    overdue: boolean;
  }[];
  /** Steps being moved, across everything. */
  stepCount: number;
  /** Days the new plan spans, from today. */
  lastDay: string | null;
}

/**
 * Re-dates everything that slipped, and nothing that did not.
 *
 * Only open steps whose day has already passed are moved, and each task is
 * re-spread within its own deadline rather than everything being flattened
 * into one queue: two courses' work landing on the same three evenings is how
 * the backlog was built in the first place.
 */
export function catchUpPlan(
  tasks: Task[],
  courses: Course[],
  today = toDayKey(new Date()),
  perDay = 1,
): CatchUpPlan {
  const entries: CatchUpPlan["tasks"] = [];
  let stepCount = 0;
  let lastDay: string | null = null;

  for (const task of tasks) {
    if (task.status === "done") continue;
    const slipped = task.subtasks.filter(
      (step) => !step.done && !!step.plannedFor && step.plannedFor < today,
    );
    if (slipped.length === 0) continue;

    const open = task.subtasks.filter((step) => !step.done);
    // The whole remaining task is re-spread, not only the late part: leaving
    // tomorrow's step where it is while three late ones pile onto today
    // rebuilds the same crush by the weekend.
    const horizon = task.dueAt && task.dueAt >= today ? task.dueAt : null;
    const busy = classDaysBetween(courses, today, horizon ?? today);
    const { days } = planStepDays(open.length, {
      from: today,
      due: horizon,
      perDay,
      busy: [...busy],
    });

    let position = 0;
    const subtasks = task.subtasks.map((step) =>
      step.done ? step : { ...step, plannedFor: days[position++] ?? null },
    );

    for (const day of days) if (day && (lastDay === null || day > lastDay)) lastDay = day;
    stepCount += slipped.length;
    entries.push({
      task,
      slipped,
      subtasks,
      overdue: task.dueAt !== null && task.dueAt < today,
    });
  }

  return { tasks: entries, stepCount, lastDay };
}

/** "9 steps across 4 tasks, spread from today to Tuesday, Sep 8." */
export function describeCatchUp(plan: CatchUpPlan): string {
  if (plan.stepCount === 0) return "Nothing has slipped. This is all up to date.";

  const steps = `${plan.stepCount} ${plan.stepCount === 1 ? "step" : "steps"}`;
  const tasks = `${plan.tasks.length} ${plan.tasks.length === 1 ? "task" : "tasks"}`;
  const until =
    plan.lastDay === null
      ? ""
      : `, spread from today to ${new Date(`${plan.lastDay}T00:00:00`).toLocaleDateString(
          undefined,
          { weekday: "long", month: "short", day: "numeric" },
        )}`;
  const passed = plan.tasks.some((entry) => entry.overdue)
    ? " Some deadlines have already passed — those get today."
    : "";

  // Deliberately states the size. A number you can look at is smaller than a
  // pile you are avoiding, and it is nearly always smaller than the guess.
  return `${steps} across ${tasks}${until}.${passed}`;
}

/** True when there is anything to catch up on, cheaply. */
export function hasSlipped(tasks: Task[], today = toDayKey(new Date())): boolean {
  return tasks.some(
    (task) =>
      task.status !== "done" &&
      task.subtasks.some((step) => !step.done && !!step.plannedFor && step.plannedFor < today),
  );
}
