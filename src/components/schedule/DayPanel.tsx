"use client";

import { useAppData } from "@/lib/appData";
import { COURSE_COLORS } from "@/lib/courseStyles";
import { cn } from "@/lib/utils";
import { Card, CardTitle } from "@/components/ui/Card";
import { formatTimeRange } from "@/lib/syllabusCourseInfo";
import { meetingsOnDay, stepsOnDay } from "@/lib/schedule";
import type { Task } from "@/types";

interface DayPanelProps {
  dayKey: string;
  tasks: Task[];
  onClose(): void;
}

/**
 * The full detail for one selected day, with working checkboxes.
 *
 * The calendar squares stay deliberately terse; this is where a day becomes
 * something you can act on rather than only look at.
 */
export function DayPanel({ dayKey, tasks, onClose }: DayPanelProps) {
  const { data, updateTask, toggleSubtask } = useAppData();
  const date = new Date(`${dayKey}T00:00:00`);
  const meetings = meetingsOnDay(data.courses, dayKey);
  const steps = stepsOnDay(data.tasks, dayKey);

  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <CardTitle>
          {date.toLocaleDateString(undefined, {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </CardTitle>
        <button
          type="button"
          onClick={onClose}
          className="min-h-9 rounded-lg px-3 text-sm text-[var(--color-ink-muted)] transition hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-ink)]"
        >
          Close
        </button>
      </div>

      {meetings.length > 0 ? (
        <ul className="space-y-1">
          {meetings.map((meeting) => (
            <li
              key={meeting.course.id}
              className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-[var(--color-ink-muted)]"
            >
              <span
                className={cn(
                  "rounded px-1.5 py-0.5 text-xs font-medium",
                  COURSE_COLORS[meeting.course.color].chip,
                )}
              >
                {meeting.course.code || meeting.course.name}
              </span>
              <span>
                {meeting.startTime
                  ? formatTimeRange(meeting.startTime, meeting.endTime)
                  : "Class"}
              </span>
              {meeting.location ? <span>{meeting.location}</span> : null}
            </li>
          ))}
        </ul>
      ) : null}

      {steps.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-muted)]">
            To do this day
          </p>
          <ul className="divide-y divide-[var(--color-border-soft)]">
            {steps.map((entry) => {
              const course =
                data.courses.find((item) => item.id === entry.task.courseId) ?? null;
              return (
                <li key={entry.step.id} className="flex items-start gap-3 py-3">
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={entry.step.done}
                    onClick={() => toggleSubtask(entry.task.id, entry.step.id)}
                    className={cn(
                      "mt-0.5 grid size-6 shrink-0 place-items-center rounded-md border-2 transition",
                      entry.step.done
                        ? "border-[var(--color-accent)] bg-[var(--color-accent)] text-white"
                        : "border-[var(--color-border-soft)] hover:border-[var(--color-focus)]",
                    )}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={3.5}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                      className={cn("size-3.5", entry.step.done ? "opacity-100" : "opacity-0")}
                    >
                      <path d="m5 12.5 4.5 4.5L19 7" />
                    </svg>
                    <span className="sr-only">
                      {entry.step.done ? "Mark as not done" : "Mark as done"}:{" "}
                      {entry.step.title}
                    </span>
                  </button>

                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        "text-sm",
                        entry.step.done && "text-[var(--color-ink-muted)] line-through",
                      )}
                    >
                      {entry.step.title}
                    </p>
                    <p className="flex flex-wrap items-center gap-2 text-xs text-[var(--color-ink-muted)]">
                      {course ? (
                        <span
                          className={cn(
                            "rounded px-1.5 py-0.5 font-medium",
                            COURSE_COLORS[course.color].chip,
                          )}
                        >
                          {course.code || course.name}
                        </span>
                      ) : null}
                      <span className="truncate">{entry.task.title}</span>
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {tasks.length === 0 ? (
        <p className="text-sm text-[var(--color-ink-muted)]">
          {steps.length > 0
            ? "Nothing else is due this day."
            : meetings.length > 0
              ? "Nothing due this day."
              : "Nothing due, no class."}
        </p>
      ) : (
        <ul className="divide-y divide-[var(--color-border-soft)]">
          {tasks.map((task) => {
            const course = data.courses.find((item) => item.id === task.courseId) ?? null;
            const done = task.status === "done";
            return (
              <li key={task.id} className="flex items-start gap-3 py-3">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={done}
                  onClick={() => updateTask(task.id, { status: done ? "todo" : "done" })}
                  className={cn(
                    "mt-0.5 grid size-6 shrink-0 place-items-center rounded-md border-2 transition",
                    done
                      ? "border-[var(--color-accent)] bg-[var(--color-accent)] text-white"
                      : "border-[var(--color-border-soft)] hover:border-[var(--color-focus)]",
                  )}
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={3.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                    className={cn("size-3.5", done ? "opacity-100" : "opacity-0")}
                  >
                    <path d="m5 12.5 4.5 4.5L19 7" />
                  </svg>
                  <span className="sr-only">
                    {done ? "Mark as not done" : "Mark as done"}: {task.title}
                  </span>
                </button>

                <div className="min-w-0 flex-1">
                  <p className={cn("text-sm", done && "text-[var(--color-ink-muted)] line-through")}>
                    {task.title}
                  </p>
                  <p className="flex flex-wrap items-center gap-2 text-xs text-[var(--color-ink-muted)]">
                    {course ? (
                      <span
                        className={cn(
                          "rounded px-1.5 py-0.5 font-medium",
                          COURSE_COLORS[course.color].chip,
                        )}
                      >
                        {course.code || course.name}
                      </span>
                    ) : (
                      <span>No course</span>
                    )}
                    {task.subtasks.length > 0 ? (
                      <span>
                        {task.subtasks.filter((step) => step.done).length}/{task.subtasks.length} steps
                      </span>
                    ) : null}
                    {task.source?.kind === "syllabus" ? <span>from the syllabus</span> : null}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
