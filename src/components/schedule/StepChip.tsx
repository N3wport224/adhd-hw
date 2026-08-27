"use client";

import { useState } from "react";
import { useAppData } from "@/lib/appData";
import { COURSE_COLORS } from "@/lib/courseStyles";
import { cn } from "@/lib/utils";
import type { PlannedStep } from "@/lib/schedule";
import type { Course } from "@/types";

/**
 * A step planned for a day, with its checkbox right there.
 *
 * Ticking it off has to be possible from the calendar itself. Having to open
 * a task to say you did the thing you just did is the friction that stops a
 * plan being kept up to date, and a plan nobody updates stops being true.
 */
export function StepChip({ entry, course }: { entry: PlannedStep; course: Course | null }) {
  const { toggleSubtask } = useAppData();
  const [justCompleted, setJustCompleted] = useState(false);
  const done = entry.step.done;

  return (
    <div
      className={cn(
        "flex items-start gap-1.5 rounded-md px-1.5 py-1 text-xs transition",
        done
          ? "text-[var(--color-ink-muted)]"
          : course
            ? COURSE_COLORS[course.color].chip
            : "bg-[var(--color-surface-muted)] text-[var(--color-ink)]",
      )}
    >
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
          "mt-px grid size-4 shrink-0 place-items-center rounded border transition",
          done
            ? "border-[var(--color-accent)] bg-[var(--color-accent)] text-[var(--color-on-accent)]"
            : "border-current/40 hover:border-[var(--color-focus)]",
        )}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={4}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className={cn(
            "size-2.5 transition-opacity",
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

      <span className={cn("min-w-0 flex-1", done && "line-through")}>
        <span className="line-clamp-2">{entry.step.title}</span>
        {/* Set back by size, not by transparency: at 70% opacity this line
            fell under the contrast floor on the lighter course colours. */}
        <span className="block truncate text-[11px]">{entry.task.title}</span>
      </span>
    </div>
  );
}
