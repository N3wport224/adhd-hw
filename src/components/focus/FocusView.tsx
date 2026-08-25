"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useAppData } from "@/lib/appData";
import { Card, CardTitle } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { TaskRow } from "@/components/focus/TaskRow";
import { QuickAddTask } from "@/components/focus/QuickAddTask";
import { daysUntil } from "@/lib/utils";
import type { Task } from "@/types";

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
            : nextUp
              ? "Here is the one thing to start with. Everything else can wait."
              : "Nothing is due right now. That is allowed."}
        </p>
      </header>

      {ready ? (
        <>
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
    </div>
  );
}
