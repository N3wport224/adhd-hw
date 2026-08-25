"use client";

import Link from "next/link";
import { COURSE_COLORS } from "@/lib/courseStyles";
import { cn } from "@/lib/utils";
import { CourseIcon } from "@/components/courses/CourseIcon";
import type { Course } from "@/types";

interface CourseCardProps {
  course: Course;
  /** Open assignments, shown as a count rather than a list. */
  openTaskCount: number;
  onEdit(course: Course): void;
}

export function CourseCard({ course, openTaskCount, onEdit }: CourseCardProps) {
  const palette = COURSE_COLORS[course.color];

  return (
    <div
      className={cn(
        "group relative flex h-full flex-col gap-4 overflow-hidden rounded-[var(--radius-card)]",
        "border border-[var(--color-border-soft)] bg-[var(--color-surface)] p-6 transition",
        "hover:border-[var(--color-focus)]",
      )}
    >
      <span aria-hidden="true" className={cn("absolute inset-x-0 top-0 h-1", palette.accent)} />

      <div className="flex items-start gap-4">
        <span
          aria-hidden="true"
          className={cn("grid size-11 shrink-0 place-items-center rounded-xl", palette.chip)}
        >
          <CourseIcon icon={course.icon} />
        </span>

        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 text-base font-semibold tracking-tight">
            {/* Stretched link: the whole card is the target, but only one
                accessible name lands in the tab order. */}
            <Link href={`/courses/${course.id}`} className="after:absolute after:inset-0">
              {course.name}
            </Link>
          </h3>
          {course.code ? (
            <p className="truncate text-sm text-[var(--color-ink-muted)]">{course.code}</p>
          ) : null}
        </div>

        <button
          type="button"
          onClick={() => onEdit(course)}
          aria-label={`Edit ${course.name}`}
          className={cn(
            "relative z-10 grid size-9 shrink-0 place-items-center rounded-lg",
            "text-[var(--color-ink-muted)] transition hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-ink)]",
          )}
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
            <path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17v3Z" />
          </svg>
        </button>
      </div>

      <dl className="space-y-1 text-sm text-[var(--color-ink-muted)]">
        {course.instructor ? (
          <div className="flex gap-2">
            <dt className="sr-only">Instructor</dt>
            <dd className="truncate">{course.instructor}</dd>
          </div>
        ) : null}
        {course.meetingInfo ? (
          <div className="flex gap-2">
            <dt className="sr-only">Meets</dt>
            <dd className="truncate">{course.meetingInfo}</dd>
          </div>
        ) : null}
      </dl>

      <p className="mt-auto text-sm text-[var(--color-ink-muted)]">
        {openTaskCount === 0
          ? "Nothing open right now"
          : `${openTaskCount} open ${openTaskCount === 1 ? "task" : "tasks"}`}
      </p>
    </div>
  );
}
