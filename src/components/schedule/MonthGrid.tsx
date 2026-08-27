"use client";

import { COURSE_COLORS } from "@/lib/courseStyles";
import { cn } from "@/lib/utils";
import { stepsOnDay, type DayCell } from "@/lib/schedule";
import type { Course, Task } from "@/types";

interface MonthGridProps {
  cells: DayCell[];
  tasksByDay: Map<string, Task[]>;
  /** Tasks to draw planned steps from, already filtered. */
  stepTasks: Task[];
  courses: Course[];
  selectedDay: string | null;
  onSelectDay(dayKey: string): void;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** How many chips fit in a square before the rest become a count. */
const VISIBLE_CHIPS = 2;

/**
 * The whole month at a glance — for spotting the week everything lands in,
 * not for reading. Squares stay terse on purpose; selecting one opens the
 * day panel underneath with the detail.
 */
export function MonthGrid({
  cells,
  tasksByDay,
  stepTasks,
  courses,
  selectedDay,
  onSelectDay,
}: MonthGridProps) {
  return (
    <div className="space-y-1">
      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map((weekday) => (
          <div
            key={weekday}
            aria-hidden="true"
            className="px-1 pb-1 text-center text-xs font-medium uppercase tracking-wide text-[var(--color-ink-muted)]"
          >
            {weekday.charAt(0)}
            <span className="hidden sm:inline">{weekday.slice(1)}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell) => {
          const steps = stepsOnDay(stepTasks, cell.key);
          // Steps come first: a month square has room for two lines, and what
          // to do that day is more use than what happens to be due.
          const entries = [
            ...steps.map((entry) => ({
              key: entry.step.id,
              title: entry.step.title,
              done: entry.step.done,
              courseId: entry.task.courseId,
            })),
            ...(tasksByDay.get(cell.key) ?? []).map((task) => ({
              key: task.id,
              title: task.title,
              done: task.status === "done",
              courseId: task.courseId,
            })),
          ];
          const open = entries.filter((entry) => !entry.done);

          return (
            <button
              key={cell.key}
              type="button"
              onClick={() => onSelectDay(cell.key)}
              aria-pressed={selectedDay === cell.key}
              className={cn(
                "flex min-h-16 flex-col gap-1 rounded-lg border p-1 text-left transition sm:min-h-24",
                cell.isToday
                  ? "border-[var(--color-focus)] bg-[var(--color-accent-wash)]"
                  : "border-[var(--color-border-soft)] bg-[var(--color-surface)]",
                !cell.inCurrentMonth && "opacity-45",
                selectedDay === cell.key && "ring-2 ring-[var(--color-focus)]",
              )}
            >
              <span
                className={cn(
                  "px-1 text-xs font-semibold",
                  cell.isToday && "text-[var(--color-accent)]",
                )}
              >
                {cell.date.getDate()}
              </span>
              <span className="sr-only">
                {cell.date.toLocaleDateString(undefined, {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}
                {open.length === 0 ? ", nothing due" : `, ${open.length} due`}
              </span>

              {/* Dots below the small breakpoint: chip text is unreadable in a
                  square this size on a phone, but the colours still say
                  which courses land where. */}
              <span className="flex flex-wrap gap-0.5 px-1 sm:hidden">
                {entries.slice(0, 4).map((entry) => {
                  const course = courses.find((item) => item.id === entry.courseId) ?? null;
                  return (
                    <span
                      key={entry.key}
                      aria-hidden="true"
                      className={cn(
                        "size-1.5 rounded-full",
                        entry.done
                          ? "bg-[var(--color-border-soft)]"
                          : course
                            ? COURSE_COLORS[course.color].accent
                            : "bg-[var(--color-ink-muted)]",
                      )}
                    />
                  );
                })}
              </span>

              <span className="hidden flex-1 flex-col gap-0.5 sm:flex">
                {entries.slice(0, VISIBLE_CHIPS).map((entry) => {
                  const course = courses.find((item) => item.id === entry.courseId) ?? null;
                  return (
                    <span
                      key={entry.key}
                      className={cn(
                        "truncate rounded px-1 py-0.5 text-[11px] leading-tight",
                        entry.done
                          ? "bg-[var(--color-surface-muted)] text-[var(--color-ink-muted)] line-through"
                          : course
                            ? COURSE_COLORS[course.color].chip
                            : "bg-[var(--color-surface-muted)]",
                      )}
                    >
                      {entry.title}
                    </span>
                  );
                })}
                {entries.length > VISIBLE_CHIPS ? (
                  <span className="px-1 text-[11px] text-[var(--color-ink-muted)]">
                    +{entries.length - VISIBLE_CHIPS} more
                  </span>
                ) : null}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
