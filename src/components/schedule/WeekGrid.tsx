"use client";

import { cn } from "@/lib/utils";
import { TaskChip } from "@/components/schedule/TaskChip";
import type { DayCell } from "@/lib/schedule";
import type { Course, Task } from "@/types";

interface WeekGridProps {
  days: DayCell[];
  tasksByDay: Map<string, Task[]>;
  courses: Course[];
  selectedDay: string | null;
  onSelectDay(dayKey: string): void;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * Seven columns on a wide screen, seven stacked rows on a narrow one.
 *
 * The week is the default view because it is the only span you can actually
 * act on. A month is for orientation; a week is for deciding what today looks
 * like.
 */
export function WeekGrid({
  days,
  tasksByDay,
  courses,
  selectedDay,
  onSelectDay,
}: WeekGridProps) {
  return (
    <div className="grid gap-2 sm:grid-cols-7">
      {days.map((day) => {
        const tasks = tasksByDay.get(day.key) ?? [];
        const open = tasks.filter((task) => task.status !== "done").length;

        return (
          <div
            key={day.key}
            className={cn(
              "rounded-xl border p-2 transition sm:min-h-40",
              day.isToday
                ? "border-[var(--color-focus)] bg-[var(--color-accent-wash)]"
                : "border-[var(--color-border-soft)] bg-[var(--color-surface)]",
              selectedDay === day.key && "ring-2 ring-[var(--color-focus)]",
            )}
          >
            <button
              type="button"
              onClick={() => onSelectDay(day.key)}
              className="mb-2 flex w-full items-baseline gap-2 rounded-lg px-1 py-0.5 text-left"
            >
              <span className="text-xs font-medium uppercase tracking-wide text-[var(--color-ink-muted)]">
                {WEEKDAYS[day.date.getDay()]}
              </span>
              <span
                className={cn(
                  "text-base font-semibold",
                  day.isToday && "text-[var(--color-accent)]",
                )}
              >
                {day.date.getDate()}
              </span>
              {open > 0 ? (
                <span className="ml-auto text-xs text-[var(--color-ink-muted)]">{open}</span>
              ) : null}
              <span className="sr-only">
                {day.date.toLocaleDateString(undefined, {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}
                {open === 0 ? ", nothing due" : `, ${open} due`}
              </span>
            </button>

            <div className="space-y-1">
              {tasks.map((task) => (
                <TaskChip
                  key={task.id}
                  task={task}
                  course={courses.find((course) => course.id === task.courseId) ?? null}
                  onSelect={() => onSelectDay(day.key)}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
