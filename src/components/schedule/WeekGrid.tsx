"use client";

import { cn } from "@/lib/utils";
import { COURSE_COLORS } from "@/lib/courseStyles";
import { formatTimeRange } from "@/lib/syllabusCourseInfo";
import { meetingsOnDay } from "@/lib/schedule";
import { TaskChip } from "@/components/schedule/TaskChip";
import type { DayCell } from "@/lib/schedule";
import type { Course, Task } from "@/types";

interface WeekGridProps {
  days: DayCell[];
  tasksByDay: Map<string, Task[]>;
  courses: Course[];
  /** Courses whose meetings should be drawn, already filtered. */
  meetingCourses: Course[];
  selectedDay: string | null;
  onSelectDay(dayKey: string): void;
  showMeetings: boolean;
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
  meetingCourses,
  selectedDay,
  onSelectDay,
  showMeetings,
}: WeekGridProps) {
  return (
    <div className="grid gap-2 sm:grid-cols-7">
      {days.map((day) => {
        const tasks = tasksByDay.get(day.key) ?? [];
        const open = tasks.filter((task) => task.status !== "done").length;
        const meetings = showMeetings ? meetingsOnDay(meetingCourses, day.key) : [];

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

            {/* Classes sit above the day's work and are drawn as outlines
                rather than filled chips: a lecture is where you will be, not
                something to tick off, and the two should never be confused at
                a glance. */}
            {meetings.length > 0 ? (
              <div className="mb-2 space-y-1">
                {meetings.map((meeting) => (
                  <div
                    key={meeting.course.id}
                    className={cn(
                      "rounded-md border border-dashed px-1.5 py-1 text-xs",
                      "border-[var(--color-border-soft)] text-[var(--color-ink-muted)]",
                    )}
                  >
                    <span className="flex items-center gap-1.5">
                      <span
                        aria-hidden="true"
                        className={cn(
                          "size-1.5 shrink-0 rounded-full",
                          COURSE_COLORS[meeting.course.color].accent,
                        )}
                      />
                      <span className="truncate">
                        {meeting.course.code || meeting.course.name}
                      </span>
                    </span>
                    {/* Wrapping rather than truncating: a clipped time is
                        worse than a two-line one. */}
                    {meeting.startTime ? (
                      <span className="block">
                        {formatTimeRange(meeting.startTime, meeting.endTime)}
                      </span>
                    ) : null}
                    {meeting.location ? (
                      <span className="block">{meeting.location}</span>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}

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
