"use client";

import { COURSE_COLORS } from "@/lib/courseStyles";
import { cn } from "@/lib/utils";
import type { Course, Task } from "@/types";

interface TaskChipProps {
  task: Task;
  course: Course | null;
  onSelect(): void;
}

/**
 * One piece of work on a calendar square. Colour carries the course, so a
 * week can be read for shape — "three purple things on Thursday" — without
 * reading a single word.
 */
export function TaskChip({ task, course, onSelect }: TaskChipProps) {
  const done = task.status === "done";

  return (
    <button
      type="button"
      onClick={onSelect}
      title={`${task.title}${course ? ` · ${course.code || course.name}` : ""}`}
      className={cn(
        "flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-xs transition",
        "hover:brightness-95",
        done
          ? "bg-[var(--color-surface-muted)] text-[var(--color-ink-muted)] line-through"
          : course
            ? COURSE_COLORS[course.color].chip
            : "bg-[var(--color-surface-muted)] text-[var(--color-ink)]",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "size-1.5 shrink-0 rounded-full",
          done ? "bg-[var(--color-ink-muted)]" : course ? COURSE_COLORS[course.color].accent : "bg-[var(--color-ink-muted)]",
        )}
      />
      <span className="truncate">{task.title}</span>
    </button>
  );
}
