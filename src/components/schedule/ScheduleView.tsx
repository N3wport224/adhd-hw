"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useAppData } from "@/lib/appData";
import {
  addDays,
  addMonths,
  describeMonth,
  describeWeek,
  groupByDay,
  monthGrid,
  nextDayWithWork,
  toDayKey,
  weekDays,
  type ScheduleMode,
} from "@/lib/schedule";
import { cn } from "@/lib/utils";
import { Button, LinkButton } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { controlClass } from "@/components/ui/Field";
import { WeekGrid } from "@/components/schedule/WeekGrid";
import { MonthGrid } from "@/components/schedule/MonthGrid";
import { DayPanel } from "@/components/schedule/DayPanel";

export function ScheduleView() {
  const { data, ready } = useAppData();

  // Week is the default. A month grid of a whole term is the wall of
  // information this app exists to avoid; it earns its place as something you
  // choose to look at, not as what greets you.
  const [mode, setMode] = useState<ScheduleMode>("week");
  const [anchor, setAnchor] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [courseFilter, setCourseFilter] = useState("all");

  const visibleTasks = useMemo(
    () =>
      data.tasks.filter((task) => {
        if (!task.dueAt) return false;
        if (courseFilter === "all") return true;
        if (courseFilter === "unfiled") return task.courseId === null;
        return task.courseId === courseFilter;
      }),
    [data.tasks, courseFilter],
  );

  const tasksByDay = useMemo(() => groupByDay(visibleTasks), [visibleTasks]);
  const days = useMemo(() => weekDays(anchor), [anchor]);
  const cells = useMemo(() => monthGrid(anchor), [anchor]);

  const step = (direction: number) =>
    setAnchor((current) =>
      mode === "week" ? addDays(current, direction * 7) : addMonths(current, direction),
    );

  // Nothing in the span currently on screen — but possibly plenty just past
  // its edge, which is the case worth speaking up about.
  const visibleKeys = new Set((mode === "week" ? days : cells).map((day) => day.key));
  const spanIsEmpty = [...visibleKeys].every(
    (key) => (tasksByDay.get(key) ?? []).length === 0,
  );
  const lastVisibleKey = (mode === "week" ? days : cells).at(-1)?.key ?? toDayKey(new Date());
  const nextWorkDay = spanIsEmpty ? nextDayWithWork(lastVisibleKey, tasksByDay) : null;

  const undated = data.tasks.filter((task) => !task.dueAt && task.status !== "done").length;
  const datedCount = data.tasks.filter((task) => task.dueAt).length;

  if (!ready) {
    return (
      <div
        aria-hidden="true"
        className="h-96 animate-pulse rounded-[var(--radius-card)] bg-[var(--color-surface-muted)]"
      />
    );
  }

  if (datedCount === 0) {
    return (
      <div className="space-y-6">
        <header className="space-y-2">
          <h2 className="text-2xl font-semibold tracking-tight">Schedule</h2>
          <p className="max-w-prose text-[var(--color-ink-muted)]">
            Everything with a due date, across all your courses.
          </p>
        </header>
        <EmptyState
          title="Nothing is scheduled yet"
          body="Upload a syllabus to a course and the dates it finds land here, or add an assignment with a due date by hand."
          action={
            <LinkButton href="/courses" variant="primary" size="lg">
              Go to courses
            </LinkButton>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">Schedule</h2>
        <p className="max-w-prose text-[var(--color-ink-muted)]">
          Everything with a due date, across all your courses. Colour is the course.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <Button
            variant="secondary"
            onClick={() => step(-1)}
            aria-label={mode === "week" ? "Previous week" : "Previous month"}
            className="size-11 px-0"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className="size-5"
            >
              <path d="m15 6-6 6 6 6" />
            </svg>
          </Button>
          <Button
            variant="secondary"
            onClick={() => step(1)}
            aria-label={mode === "week" ? "Next week" : "Next month"}
            className="size-11 px-0"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className="size-5"
            >
              <path d="m9 6 6 6-6 6" />
            </svg>
          </Button>
        </div>

        <p aria-live="polite" className="min-w-44 text-base font-medium">
          {mode === "week" ? describeWeek(anchor) : describeMonth(anchor)}
        </p>

        <Button
          variant="ghost"
          onClick={() => {
            setAnchor(new Date());
            setSelectedDay(toDayKey(new Date()));
          }}
        >
          Today
        </Button>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div
            role="group"
            aria-label="View"
            className="flex rounded-xl border border-[var(--color-border-soft)] p-0.5"
          >
            {(["week", "month"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setMode(option)}
                aria-pressed={mode === option}
                className={cn(
                  "min-h-9 rounded-lg px-3 text-sm font-medium capitalize transition",
                  mode === option
                    ? "bg-[var(--color-accent)] text-white"
                    : "text-[var(--color-ink-muted)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-ink)]",
                )}
              >
                {option}
              </button>
            ))}
          </div>

          <label className="sr-only" htmlFor="schedule-course">
            Filter by course
          </label>
          <select
            id="schedule-course"
            value={courseFilter}
            onChange={(event) => setCourseFilter(event.target.value)}
            className={controlClass("sm")}
          >
            <option value="all">All courses</option>
            {data.courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.code || course.name}
              </option>
            ))}
            <option value="unfiled">No course</option>
          </select>
        </div>
      </div>

      {mode === "week" ? (
        <WeekGrid
          days={days}
          tasksByDay={tasksByDay}
          courses={data.courses}
          selectedDay={selectedDay}
          onSelectDay={setSelectedDay}
        />
      ) : (
        <MonthGrid
          cells={cells}
          tasksByDay={tasksByDay}
          courses={data.courses}
          selectedDay={selectedDay}
          onSelectDay={setSelectedDay}
        />
      )}

      {spanIsEmpty ? (
        <p className="text-sm text-[var(--color-ink-muted)]">
          Nothing due {mode === "week" ? "this week" : "this month"}.{" "}
          {nextWorkDay ? (
            <>
              The next thing is{" "}
              <button
                type="button"
                onClick={() => {
                  setAnchor(new Date(`${nextWorkDay}T00:00:00`));
                  setSelectedDay(nextWorkDay);
                }}
                className="font-medium text-[var(--color-accent)] underline underline-offset-4"
              >
                {new Date(`${nextWorkDay}T00:00:00`).toLocaleDateString(undefined, {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}
              </button>
              .
            </>
          ) : (
            "Nothing later either — you are clear."
          )}
        </p>
      ) : null}

      {selectedDay ? (
        <DayPanel
          dayKey={selectedDay}
          tasks={tasksByDay.get(selectedDay) ?? []}
          onClose={() => setSelectedDay(null)}
        />
      ) : null}

      {undated > 0 ? (
        <p className="text-sm text-[var(--color-ink-muted)]">
          {undated} {undated === 1 ? "task has" : "tasks have"} no due date, so they are
          not on the calendar. They are still on{" "}
          <Link href="/tasks" className="underline underline-offset-4">
            Tasks
          </Link>
          .
        </p>
      ) : null}
    </div>
  );
}
