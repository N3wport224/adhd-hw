"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { CourseIcon } from "@/components/courses/CourseIcon";
import {
  COURSE_COLORS,
  COURSE_COLOR_KEYS,
  COURSE_ICONS,
  COURSE_ICON_KEYS,
} from "@/lib/courseStyles";
import { cn } from "@/lib/utils";
import type { Course, CourseDraft } from "@/types";

const BLANK_DRAFT: CourseDraft = {
  name: "",
  code: "",
  instructor: "",
  meetingInfo: "",
  color: "sage",
  icon: "book",
};

interface CourseFormDialogProps {
  open: boolean;
  /** Present when editing; absent when adding. */
  course?: Course | null;
  onClose(): void;
  onSubmit(draft: CourseDraft): void;
  onDelete?(): void;
}

export function CourseFormDialog({
  open,
  course,
  onClose,
  onSubmit,
  onDelete,
}: CourseFormDialogProps) {
  return (
    <Dialog
      open={open}
      title={course ? "Edit course" : "Add a course"}
      description="Only the name is required — the rest can wait."
      onClose={onClose}
    >
      {/* The dialog unmounts when closed, and the key remounts the form when
          the target course changes — so the form's own initial state is always
          correct and a cancelled edit leaves nothing behind. */}
      <CourseForm
        key={course?.id ?? "new"}
        course={course}
        onClose={onClose}
        onSubmit={onSubmit}
        onDelete={onDelete}
      />
    </Dialog>
  );
}

function CourseForm({
  course,
  onClose,
  onSubmit,
  onDelete,
}: Omit<CourseFormDialogProps, "open">) {
  const [draft, setDraft] = useState<CourseDraft>(() =>
    course
      ? {
          name: course.name,
          code: course.code,
          instructor: course.instructor,
          meetingInfo: course.meetingInfo,
          color: course.color,
          icon: course.icon,
        }
      : BLANK_DRAFT,
  );
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const canSave = draft.name.trim().length > 0;

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSave) return;
    onSubmit({
      ...draft,
      name: draft.name.trim(),
      code: draft.code.trim(),
      instructor: draft.instructor.trim(),
      meetingInfo: draft.meetingInfo.trim(),
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Field label="Course name">
        {({ id, className }) => (
          <input
            id={id}
            className={className}
            value={draft.name}
            onChange={(event) => setDraft({ ...draft, name: event.target.value })}
            placeholder="Intro to Psychology"
            autoComplete="off"
            required
          />
        )}
      </Field>

      <div className="grid gap-6 sm:grid-cols-2">
        <Field label="Course code">
          {({ id, className }) => (
            <input
              id={id}
              className={className}
              value={draft.code}
              onChange={(event) => setDraft({ ...draft, code: event.target.value })}
              placeholder="PSY 210"
              autoComplete="off"
            />
          )}
        </Field>

        <Field label="Instructor">
          {({ id, className }) => (
            <input
              id={id}
              className={className}
              value={draft.instructor}
              onChange={(event) =>
                setDraft({ ...draft, instructor: event.target.value })
              }
              placeholder="Dr. Reyes"
              autoComplete="off"
            />
          )}
        </Field>
      </div>

      <Field label="When it meets" hint="Free text for now — the syllabus parser will fill this in later.">
        {({ id, className }) => (
          <input
            id={id}
            className={className}
            value={draft.meetingInfo}
            onChange={(event) =>
              setDraft({ ...draft, meetingInfo: event.target.value })
            }
            placeholder="Tue / Thu, 9:30am"
            autoComplete="off"
          />
        )}
      </Field>

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">Colour</legend>
        <div className="flex flex-wrap gap-2">
          {COURSE_COLOR_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setDraft({ ...draft, color: key })}
              aria-pressed={draft.color === key}
              aria-label={COURSE_COLORS[key].label}
              title={COURSE_COLORS[key].label}
              className={cn(
                "grid size-11 place-items-center rounded-xl text-white transition",
                "ring-offset-2 ring-offset-[var(--color-surface)]",
                COURSE_COLORS[key].swatch,
                draft.color === key
                  ? "ring-2 ring-[var(--color-ink)]"
                  : "hover:ring-2 hover:ring-[var(--color-border-soft)]",
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
                className={cn("size-4", draft.color === key ? "opacity-100" : "opacity-0")}
              >
                <path d="m5 12.5 4.5 4.5L19 7" />
              </svg>
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">Icon</legend>
        <div className="flex flex-wrap gap-2">
          {COURSE_ICON_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setDraft({ ...draft, icon: key })}
              aria-pressed={draft.icon === key}
              aria-label={COURSE_ICONS[key].label}
              title={COURSE_ICONS[key].label}
              className={cn(
                "grid size-11 place-items-center rounded-xl border transition",
                "ring-offset-2 ring-offset-[var(--color-surface)]",
                draft.icon === key
                  ? "border-transparent bg-[var(--color-surface-muted)] ring-2 ring-[var(--color-ink)]"
                  : "border-[var(--color-border-soft)] hover:bg-[var(--color-surface-muted)]",
              )}
            >
              <CourseIcon icon={key} />
            </button>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center gap-3 pt-2">
        <Button type="submit" variant="primary" disabled={!canSave}>
          {course ? "Save changes" : "Add course"}
        </Button>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>

        {course && onDelete ? (
          <div className="ml-auto">
            {confirmingDelete ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-[var(--color-ink-muted)]">Sure?</span>
                <Button variant="danger" onClick={onDelete}>
                  Delete
                </Button>
                <Button variant="ghost" onClick={() => setConfirmingDelete(false)}>
                  Keep
                </Button>
              </div>
            ) : (
              <Button variant="danger" onClick={() => setConfirmingDelete(true)}>
                Delete course
              </Button>
            )}
          </div>
        ) : null}
      </div>

      {course && confirmingDelete ? (
        <p className="text-sm text-[var(--color-ink-muted)]">
          Tasks and documents in this course are kept — they just become unfiled.
        </p>
      ) : null}
    </form>
  );
}
