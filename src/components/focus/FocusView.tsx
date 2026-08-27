"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useAppData } from "@/lib/appData";
import { Card, CardTitle } from "@/components/ui/Card";
import { COURSE_COLORS } from "@/lib/courseStyles";
import { Button, LinkButton } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { TaskRow } from "@/components/focus/TaskRow";
import { QuickAddTask } from "@/components/focus/QuickAddTask";
import { FocusMode } from "@/components/focus/FocusMode";
import { BreakdownDialog } from "@/components/tasks/BreakdownDialog";
import { daysUntil } from "@/lib/utils";
import { dayKeyOf, overdueSteps, stepsOnDay, toDayKey } from "@/lib/schedule";
import { describePlan, planStepDays, replanOpenSteps } from "@/lib/stepPlanner";
import { cn } from "@/lib/utils";
import type { Task } from "@/types";

/**
 * The way out of a plan that has gone stale.
 *
 * Falling behind is the ordinary case for this audience, and a plan still
 * pointing at days that have gone stops being a plan and becomes a list of
 * failures to scroll past. One button re-spreads whatever is left over the
 * days that actually remain.
 */
function CatchUp({
  taskIds,
  count,
  onDone,
}: {
  taskIds: string[];
  count: number;
  onDone(): void;
}) {
  const { data, setSubtasks } = useAppData();
  const today = toDayKey(new Date());

  const tasks = data.tasks.filter((task) => taskIds.includes(task.id));
  const openCount = tasks.reduce(
    (total, task) => total + task.subtasks.filter((step) => !step.done).length,
    0,
  );
  const preview = planStepDays(openCount, {
    from: today,
    due: null,
    perDay: 2,
  });

  function catchUp() {
    for (const task of tasks) {
      setSubtasks(
        task.id,
        replanOpenSteps(task.subtasks, {
          from: today,
          due: task.dueAt ? dayKeyOf(task.dueAt) : null,
          perDay: 2,
        }),
      );
    }
    onDone();
  }

  return (
    <div className="space-y-2 rounded-xl bg-[var(--color-surface)] p-4">
      <p className="text-sm">
        <span className="font-medium">
          {count} {count === 1 ? "step" : "steps"} slipped past {count === 1 ? "its" : "their"} day.
        </span>{" "}
        <span className="text-[var(--color-ink-muted)]">
          That happens. Move what is left onto the days you still have.
        </span>
      </p>
      <Button variant="secondary" onClick={catchUp}>
        Re-spread from today
      </Button>
      <p className="text-xs text-[var(--color-ink-muted)]">
        {describePlan(preview)} Anything already finished keeps the day it was done.
      </p>
    </div>
  );
}

/** One planned step, tickable where it is read. */
function PlannedStepRow({
  entry,
  today,
}: {
  entry: { task: Task; step: Task["subtasks"][number] };
  today: string;
}) {
  const { data, toggleSubtask } = useAppData();
  const [justCompleted, setJustCompleted] = useState(false);
  const course = data.courses.find((item) => item.id === entry.task.courseId) ?? null;
  const done = entry.step.done;
  const late = !done && !!entry.step.plannedFor && entry.step.plannedFor < today;

  return (
    <div className="flex items-start gap-3 rounded-xl bg-[var(--color-surface)] px-3 py-3">
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        onClick={() => {
          if (!done) {
            setJustCompleted(true);
            window.setTimeout(() => setJustCompleted(false), 400);
          }
          toggleSubtask(entry.task.id, entry.step.id);
        }}
        className={cn(
          "mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg border-2 transition",
          done
            ? "border-[var(--color-accent)] bg-[var(--color-accent)] text-[var(--color-on-accent)]"
            : "border-[var(--color-border-soft)] hover:border-[var(--color-focus)]",
        )}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className={cn(
            "size-4 transition-opacity",
            done ? "opacity-100" : "opacity-0",
            justCompleted && "animate-check-pop",
          )}
        >
          <path d="m5 12.5 4.5 4.5L19 7" />
        </svg>
        <span className="sr-only">
          {done ? "Mark as not done" : "Mark as done"}: {entry.step.title}
        </span>
      </button>

      <div className="min-w-0 flex-1">
        <p className={cn("font-medium", done && "text-[var(--color-ink-muted)] line-through")}>
          {entry.step.title}
        </p>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-[var(--color-ink-muted)]">
          {course ? (
            <span
              className={cn(
                "rounded-md px-2 py-0.5 text-xs font-medium",
                COURSE_COLORS[course.color].chip,
              )}
            >
              {course.code || course.name}
            </span>
          ) : null}
          <span className="truncate">{entry.task.title}</span>
          {late ? (
            <span className="text-[#a8503f] dark:text-[#e29b8b]">carried over</span>
          ) : null}
        </p>
      </div>
    </div>
  );
}

function greeting(hour: number) {
  if (hour < 5) return "Still up";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

/** Overdue first, then soonest; undated work sinks to the bottom. */
function byUrgency(a: Task, b: Task) {
  if (!a.dueAt && !b.dueAt) return a.createdAt.localeCompare(b.createdAt);
  if (!a.dueAt) return 1;
  if (!b.dueAt) return -1;
  return a.dueAt.localeCompare(b.dueAt);
}

export function FocusView() {
  const { data, ready, updateTask } = useAppData();
  const [focusTaskId, setFocusTaskId] = useState<string | null>(null);
  const [caughtUp, setCaughtUp] = useState(false);
  const [breakdownTask, setBreakdownTask] = useState<Task | null>(null);

  const { nextUp, dueToday, laterCount, doneToday } = useMemo(() => {
    const open = data.tasks.filter((task) => task.status !== "done").sort(byUrgency);
    // "Today" deliberately includes anything overdue: the point of this screen
    // is a single honest answer to "what do I do now", not a tidy calendar.
    const today = open.filter((task) => task.dueAt !== null && daysUntil(task.dueAt) <= 0);
    const todayList = today.length > 0 ? today : open.slice(0, 1);

    const completedToday = data.tasks.filter(
      (task) => task.status === "done" && daysUntil(task.updatedAt) === 0,
    );

    return {
      nextUp: todayList[0] ?? null,
      dueToday: todayList,
      laterCount: open.length - todayList.length,
      doneToday: completedToday,
    };
  }, [data.tasks]);

  const today = toDayKey(new Date());
  /**
   * What was planned for today, plus a few that slipped.
   *
   * A step that slipped must not quietly disappear — but neither should a bad
   * week turn this screen into the wall of everything it exists to prevent.
   * The full count is stated below and the whole list is on Tasks; here, a
   * handful is enough to make the point.
   */
  const CARRIED_SHOWN = 3;
  const { todaysSteps, carriedHidden } = useMemo(() => {
    const carried = overdueSteps(data.tasks, today);
    return {
      todaysSteps: [...carried.slice(0, CARRIED_SHOWN), ...stepsOnDay(data.tasks, today)],
      carriedHidden: Math.max(0, carried.length - CARRIED_SHOWN),
    };
  }, [data.tasks, today]);
  const openToday = todaysSteps.filter((entry) => !entry.step.done);
  const doneTodayCount = todaysSteps.length - openToday.length;

  // Tasks with steps that were meant to happen before today and did not.
  const slippedTaskIds = useMemo(
    () => [...new Set(overdueSteps(data.tasks, today).map((entry) => entry.task.id))],
    [data.tasks, today],
  );
  const slippedCount = overdueSteps(data.tasks, today).length;

  const nextStep = nextUp?.subtasks.find((step) => !step.done) ?? null;
  // Read from the store rather than held in state, so completing steps inside
  // focus mode re-renders it with the task's current shape.
  const focusTask = data.tasks.find((task) => task.id === focusTaskId) ?? null;
  const hour = new Date().getHours();

  return (
    <div className="space-y-10">
      <header className="space-y-2">
        <p className="text-sm text-[var(--color-ink-muted)]">
          {new Date().toLocaleDateString(undefined, {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </p>
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {greeting(hour)}.
        </h2>
        <p className="max-w-prose text-[var(--color-ink-muted)]">
          {!ready
            ? "Getting your things together…"
            : openToday.length > 0
              ? "Here is what today asks of you. Nothing further ahead needs you yet."
              : todaysSteps.length > 0
                ? "Today's plan is done. Anything below is you working ahead."
                : nextUp
                  ? "Here is the one thing to start with. Everything else can wait."
                  : "Nothing is due right now. That is allowed."}
        </p>
      </header>

      {ready ? (
        <>
          {/* Planned steps come before deadlines. A deadline says when work is
              due; a planned step is the piece of it that belongs to today,
              which is the only question this screen is meant to answer. */}
          {/* Gated on the day having any steps at all, not on unfinished ones.
              Ticking off the last step should leave the line struck through
              and the day looking finished — having the whole section vanish
              the instant you succeed takes the moment away. */}
          {todaysSteps.length > 0 ? (
            <section className="space-y-4">
              <Card className="space-y-4 border-[var(--color-focus-ring)] bg-[var(--color-accent-wash)]">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <CardTitle>Planned for today</CardTitle>
                  <p className="text-sm text-[var(--color-ink-muted)]">
                    {openToday.length === 0
                      ? "All done — that is today finished."
                      : doneTodayCount > 0
                        ? `${doneTodayCount} of ${todaysSteps.length} done`
                        : `${openToday.length} to do`}
                  </p>
                </div>

                <ul className="space-y-1">
                  {todaysSteps.map((entry) => (
                    <li key={entry.step.id}>
                      <PlannedStepRow entry={entry} today={today} />
                    </li>
                  ))}
                </ul>

                {carriedHidden > 0 ? (
                  <p className="text-sm text-[var(--color-ink-muted)]">
                    {carriedHidden} more slipped {carriedHidden === 1 ? "step is" : "steps are"}{" "}
                    not shown.{" "}
                    <Link href="/tasks" className="underline underline-offset-4">
                      See them all
                    </Link>
                    .
                  </p>
                ) : null}

                {/* The confirmation lives here rather than inside CatchUp:
                    re-spreading is what makes the slip go away, so a message
                    owned by the prompt would unmount at the exact moment it
                    had something to say. */}
                {slippedCount > 0 ? (
                  <CatchUp
                    taskIds={slippedTaskIds}
                    count={slippedCount}
                    onDone={() => setCaughtUp(true)}
                  />
                ) : caughtUp ? (
                  <p
                    role="status"
                    className="animate-rise-fade rounded-xl bg-[var(--color-surface)] p-4 text-sm text-[var(--color-ink-muted)]"
                  >
                    Re-spread from today. Nothing is behind any more.
                  </p>
                ) : null}
              </Card>
            </section>
          ) : null}

          <Card className="space-y-5 border-[var(--color-focus-ring)] bg-[var(--color-accent-wash)]">
            <div className="flex items-center justify-between gap-4">
              <CardTitle>Next up</CardTitle>
              {doneToday.length > 0 ? (
                <p className="text-sm text-[var(--color-ink-muted)]">
                  {doneToday.length} done today — nice.
                </p>
              ) : null}
            </div>

            {nextUp ? (
              <>
                <div className="divide-y divide-[var(--color-border-soft)]">
                  <TaskRow
                    task={nextUp}
                    onToggle={(done) =>
                      updateTask(nextUp.id, { status: done ? "done" : "todo" })
                    }
                  />
                </div>

                {nextStep ? (
                  <p className="rounded-xl bg-[var(--color-surface)] px-4 py-3 text-sm">
                    <span className="text-[var(--color-ink-muted)]">Start with: </span>
                    {nextStep.title}
                  </p>
                ) : null}

                <div className="flex flex-wrap gap-3">
                  <Button variant="primary" onClick={() => setFocusTaskId(nextUp.id)}>
                    Start a focus session
                  </Button>
                  {nextUp.subtasks.length === 0 ? (
                    <Button variant="secondary" onClick={() => setBreakdownTask(nextUp)}>
                      Break into steps
                    </Button>
                  ) : null}
                </div>
              </>
            ) : (
              <p className="text-[var(--color-ink-muted)]">
                Your list is clear. Add something below when you are ready.
              </p>
            )}
          </Card>

          {dueToday.length > 1 ? (
            <section className="space-y-4">
              <CardTitle>Also today</CardTitle>
              <Card className="divide-y divide-[var(--color-border-soft)]">
                {dueToday.slice(1).map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    onToggle={(done) =>
                      updateTask(task.id, { status: done ? "done" : "todo" })
                    }
                  />
                ))}
              </Card>
            </section>
          ) : null}

          <section className="space-y-4">
            <CardTitle>Capture something</CardTitle>
            <Card>
              <QuickAddTask />
            </Card>
            {laterCount > 0 ? (
              <p className="text-sm text-[var(--color-ink-muted)]">
                {laterCount} more {laterCount === 1 ? "task is" : "tasks are"} waiting for
                later.{" "}
                <Link href="/tasks" className="underline underline-offset-4">
                  See everything
                </Link>
                .
              </p>
            ) : null}
          </section>

          {doneToday.length > 0 ? (
            <section className="space-y-4">
              <CardTitle>Done today</CardTitle>
              {/* Finished work stays on screen for the rest of the day. It is
                  where the checkmark animation lands, it makes progress
                  visible, and it means an accidental tap is one tap to undo. */}
              <Card className="divide-y divide-[var(--color-border-soft)]">
                {doneToday.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    onToggle={(done) =>
                      updateTask(task.id, { status: done ? "done" : "todo" })
                    }
                  />
                ))}
              </Card>
            </section>
          ) : null}

          {data.courses.length === 0 ? (
            <EmptyState
              title="Add your courses when you get a chance"
              body="Once your classes are in, tasks and readings can be filed under them."
              action={
                <LinkButton href="/courses" variant="primary" size="lg">
                  Go to courses
                </LinkButton>
              }
            />
          ) : null}
        </>
      ) : (
        <div
          aria-hidden="true"
          className="h-40 animate-pulse rounded-[var(--radius-card)] bg-[var(--color-surface-muted)]"
        />
      )}

      {focusTask ? (
        <FocusMode task={focusTask} onExit={() => setFocusTaskId(null)} />
      ) : null}

      <BreakdownDialog
        open={breakdownTask !== null}
        task={breakdownTask}
        onClose={() => setBreakdownTask(null)}
      />
    </div>
  );
}
