"use client";

import { useState } from "react";
import { useAppData } from "@/lib/appData";
import { COURSE_COLORS } from "@/lib/courseStyles";
import { cn, describeDueDate } from "@/lib/utils";
import type { Task } from "@/types";

interface TaskRowProps {
  task: Task;
  onToggle(done: boolean): void;
}

export function TaskRow({ task, onToggle }: TaskRowProps) {
  const { data } = useAppData();
  const [justCompleted, setJustCompleted] = useState(false);
  const course = data.courses.find((item) => item.id === task.courseId) ?? null;
  const done = task.status === "done";

  function handleToggle() {
    const next = !done;
    // The pop only plays on the way to done — un-checking should feel neutral,
    // never like a penalty.
    if (next) {
      setJustCompleted(true);
      window.setTimeout(() => setJustCompleted(false), 400);
    }
    onToggle(next);
  }

  return (
    <div className="flex items-start gap-4 py-4">
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        onClick={handleToggle}
        className={cn(
          "mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg border-2 transition",
          done
            ? "border-[var(--color-accent)] bg-[var(--color-accent)] text-white"
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
          {done ? "Mark as not done" : "Mark as done"}: {task.title}
        </span>
      </button>

      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "text-base font-medium transition",
            done && "text-[var(--color-ink-muted)] line-through",
          )}
        >
          {task.title}
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
          <span>{describeDueDate(task.dueAt)}</span>
          {task.subtasks.length > 0 ? (
            <span>
              {task.subtasks.filter((step) => step.done).length}/{task.subtasks.length} steps
            </span>
          ) : null}
        </p>
      </div>
    </div>
  );
}
