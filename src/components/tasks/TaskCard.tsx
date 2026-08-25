"use client";

import { useState } from "react";
import { useAppData } from "@/lib/appData";
import { COURSE_COLORS } from "@/lib/courseStyles";
import { cn, describeDueDate, daysUntil } from "@/lib/utils";
import { Card } from "@/components/ui/Card";
import { SubtaskList } from "@/components/tasks/SubtaskList";
import type { Task } from "@/types";

interface TaskCardProps {
  task: Task;
  onBreakDown(task: Task): void;
  /** Open by default for the task the user is most likely acting on. */
  defaultExpanded?: boolean;
}

export function TaskCard({ task, onBreakDown, defaultExpanded = false }: TaskCardProps) {
  const { data, updateTask, removeTask } = useAppData();
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [justCompleted, setJustCompleted] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const course = data.courses.find((item) => item.id === task.courseId) ?? null;
  const done = task.status === "done";
  const overdue = !done && task.dueAt !== null && daysUntil(task.dueAt) < 0;
  const doneSteps = task.subtasks.filter((step) => step.done).length;

  function handleToggle() {
    if (!done) {
      setJustCompleted(true);
      window.setTimeout(() => setJustCompleted(false), 400);
    }
    updateTask(task.id, { status: done ? "todo" : "done" });
  }

  return (
    <Card className={cn("space-y-4", done && "opacity-70")}>
      <div className="flex items-start gap-4">
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
          <p className={cn("font-medium", done && "text-[var(--color-ink-muted)] line-through")}>
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
            <span className={cn(overdue && "text-[#a8503f] dark:text-[#e29b8b]")}>
              {describeDueDate(task.dueAt)}
            </span>
            {task.subtasks.length > 0 ? (
              <span>
                {doneSteps}/{task.subtasks.length} steps
              </span>
            ) : null}
            {task.pomodorosCompleted > 0 ? (
              <span>
                {task.pomodorosCompleted} focus{" "}
                {task.pomodorosCompleted === 1 ? "block" : "blocks"}
              </span>
            ) : null}
          </p>
        </div>

        {/* Deleting takes two taps. Losing an assignment to a mis-tap is a
            far worse outcome here than one extra confirmation. */}
        {confirmingDelete ? (
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => removeTask(task.id)}
              className="min-h-9 rounded-lg border border-[#e2b3a9] px-3 text-sm text-[#a8503f] transition hover:bg-[#f6e9e6] dark:border-[#5c3a33] dark:text-[#e29b8b] dark:hover:bg-[#3a2925]"
            >
              Delete
            </button>
            <button
              type="button"
              onClick={() => setConfirmingDelete(false)}
              className="min-h-9 rounded-lg px-3 text-sm text-[var(--color-ink-muted)] transition hover:bg-[var(--color-surface-muted)]"
            >
              Keep
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            aria-label={`Delete ${task.title}`}
            className="grid size-9 shrink-0 place-items-center rounded-lg text-[var(--color-ink-muted)] transition hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-ink)]"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.6}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className="size-4"
            >
              <path d="M5 7h14M10 7V5h4v2m-7 0 1 13h8l1-13" />
            </svg>
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2 pl-11">
        {task.subtasks.length === 0 ? (
          <button
            type="button"
            onClick={() => onBreakDown(task)}
            className="min-h-9 rounded-lg bg-[var(--color-accent-wash)] px-3 text-sm font-medium text-[var(--color-accent)] transition hover:brightness-95"
          >
            Break into steps
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setExpanded((current) => !current)}
              aria-expanded={expanded}
              className="min-h-9 rounded-lg px-3 text-sm font-medium text-[var(--color-ink-muted)] transition hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-ink)]"
            >
              {expanded ? "Hide steps" : `Show ${task.subtasks.length} steps`}
            </button>
            <button
              type="button"
              onClick={() => onBreakDown(task)}
              className="min-h-9 rounded-lg px-3 text-sm font-medium text-[var(--color-ink-muted)] transition hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-ink)]"
            >
              Suggest more
            </button>
          </>
        )}
      </div>

      {expanded && task.subtasks.length > 0 ? (
        <div className="pl-11">
          <SubtaskList task={task} />
        </div>
      ) : null}
    </Card>
  );
}
