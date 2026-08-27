"use client";

import { useRef } from "react";
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
  /** Names the grid for screen readers, e.g. "September 2026". */
  label: string;
}

const WEEKDAYS = [
  ["Sun", "Sunday"],
  ["Mon", "Monday"],
  ["Tue", "Tuesday"],
  ["Wed", "Wednesday"],
  ["Thu", "Thursday"],
  ["Fri", "Friday"],
  ["Sat", "Saturday"],
];

/** Where each key moves the cursor: a day sideways, a week up or down. */
const MOVES: Record<string, (from: number) => number> = {
  ArrowRight: (from) => from + 1,
  ArrowLeft: (from) => from - 1,
  ArrowDown: (from) => from + 7,
  ArrowUp: (from) => from - 7,
  Home: (from) => from - (from % 7),
  End: (from) => from + 6 - (from % 7),
};

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
  label,
}: MonthGridProps) {
  const gridRef = useRef<HTMLDivElement>(null);

  // Six weeks of squares is forty-two tab stops if every one is tabbable, and
  // everything below the calendar sits behind them. One stop, arrow keys to
  // move — Left and Right by a day, Up and Down by a week — is how a date
  // grid is meant to behave.
  // The square that holds the tab stop: whichever day is selected, else
  // today, else the first of the month on show.
  const stopIndex =
    [
      cells.findIndex((cell) => cell.key === selectedDay),
      cells.findIndex((cell) => cell.isToday),
      cells.findIndex((cell) => cell.inCurrentMonth),
    ].find((index) => index >= 0) ?? 0;

  function onKeyDown(event: React.KeyboardEvent) {
    const move = MOVES[event.key];
    if (!move) return;
    event.preventDefault();

    // No wrapping: running off the end of the grid would land on a day the
    // squares don't show, which reads as the selection vanishing.
    const next = move(stopIndex);
    if (next < 0 || next >= cells.length) return;

    onSelectDay(cells[next].key);
    gridRef.current?.querySelectorAll<HTMLElement>('[role="gridcell"]')[next]?.focus();
  }

  const weeks = Array.from({ length: Math.ceil(cells.length / 7) }, (_, week) =>
    cells.slice(week * 7, week * 7 + 7),
  );

  return (
    <div
      ref={gridRef}
      role="grid"
      aria-label={label}
      onKeyDown={onKeyDown}
      className="space-y-1"
    >
      <div role="row" className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map(([short, full]) => (
          <div
            key={short}
            role="columnheader"
            className="px-1 pb-1 text-center text-xs font-medium uppercase tracking-wide text-[var(--color-ink-muted)]"
          >
            {/* The heading is abbreviated to a letter on a phone, so the name
                it is read out by lives in the text rather than the label. */}
            <span className="sr-only">{full}</span>
            <span aria-hidden="true">
              {short.charAt(0)}
              <span className="hidden sm:inline">{short.slice(1)}</span>
            </span>
          </div>
        ))}
      </div>

      {weeks.map((week) => (
        <div key={week[0].key} role="row" className="grid grid-cols-7 gap-1">
        {week.map((cell) => {
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
              role="gridcell"
              aria-selected={selectedDay === cell.key}
              tabIndex={cells.indexOf(cell) === stopIndex ? 0 : -1}
              onClick={() => onSelectDay(cell.key)}
              className={cn(
                "flex min-h-16 flex-col gap-1 rounded-lg border p-1 text-left transition sm:min-h-24",
                // One branch, not a background layered over another: two
                // `bg-` utilities in the same class string are settled by the
                // order of the stylesheet, not the order they are written in.
                // The days either side of the month are set back with a
                // duller ground rather than a lower opacity — faded text on
                // those squares fell under the contrast floor, and a date you
                // cannot read is not a subtle one.
                cell.isToday
                  ? "border-[var(--color-focus)] bg-[var(--color-accent-wash)]"
                  : cell.inCurrentMonth
                    ? "border-[var(--color-border-soft)] bg-[var(--color-surface)]"
                    : "border-[var(--color-border-soft)] bg-[var(--color-surface-muted)]",
                selectedDay === cell.key && "ring-2 ring-[var(--color-focus)]",
              )}
            >
              <span
                className={cn(
                  "px-1 text-xs font-semibold",
                  cell.isToday
                    ? "text-[var(--color-accent)]"
                    : cell.inCurrentMonth
                      ? "text-[var(--color-ink)]"
                      : "text-[var(--color-ink-muted)]",
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
      ))}
    </div>
  );
}
