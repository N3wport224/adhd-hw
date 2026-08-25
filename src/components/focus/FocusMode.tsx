"use client";

import { useEffect } from "react";
import { useAppData } from "@/lib/appData";
import { COURSE_COLORS } from "@/lib/courseStyles";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { PomodoroTimer } from "@/components/focus/PomodoroTimer";
import type { Task } from "@/types";

interface FocusModeProps {
  task: Task;
  onExit(): void;
}

/**
 * One task, one step, one timer, and nothing else on screen — not the
 * sidebar, not the rest of the list, not the count of what is left.
 *
 * This covers the whole viewport rather than being a section of the page.
 * Everything still visible at the edges is something to look at instead of
 * the work, which is the exact failure this view exists to prevent.
 */
export function FocusMode({ task, onExit }: FocusModeProps) {
  const { data, updateTask, toggleSubtask } = useAppData();
  const course = data.courses.find((item) => item.id === task.courseId) ?? null;
  const nextStep = task.subtasks.find((step) => !step.done) ?? null;
  const doneSteps = task.subtasks.filter((step) => step.done).length;

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onExit();
    }
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onExit]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Focus mode: ${task.title}`}
      className="fixed inset-0 z-50 overflow-y-auto bg-[var(--color-canvas)]"
    >
      <div className="mx-auto flex min-h-dvh max-w-2xl flex-col items-center justify-center gap-8 px-6 py-12 text-center">
        <div className="space-y-3">
          {course ? (
            <span
              className={cn(
                "inline-block rounded-md px-2 py-0.5 text-xs font-medium",
                COURSE_COLORS[course.color].chip,
              )}
            >
              {course.code || course.name}
            </span>
          ) : null}
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">{task.title}</h2>
        </div>

        {nextStep ? (
          <div className="w-full max-w-md space-y-4 rounded-[var(--radius-card)] border border-[var(--color-border-soft)] bg-[var(--color-surface)] p-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-muted)]">
              This step only
            </p>
            <p className="text-lg">{nextStep.title}</p>
            <Button variant="secondary" onClick={() => toggleSubtask(task.id, nextStep.id)}>
              Step done
            </Button>
            {task.subtasks.length > 1 ? (
              <p className="text-sm text-[var(--color-ink-muted)]">
                {doneSteps} of {task.subtasks.length} steps done
              </p>
            ) : null}
          </div>
        ) : null}

        <PomodoroTimer
          taskTitle={nextStep ? undefined : task.title}
          completedTotal={task.pomodorosCompleted}
          onFocusComplete={() =>
            updateTask(task.id, { pomodorosCompleted: task.pomodorosCompleted + 1 })
          }
        />

        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button
            variant="secondary"
            onClick={() => {
              updateTask(task.id, { status: "done" });
              onExit();
            }}
          >
            Whole task done
          </Button>
          <Button variant="ghost" onClick={onExit}>
            Leave focus mode
          </Button>
        </div>

        <p className="text-sm text-[var(--color-ink-muted)]">Press Escape to leave.</p>
      </div>
    </div>
  );
}
