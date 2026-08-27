"use client";

import { useState } from "react";
import { ChoiceGroup } from "@/components/ui/ChoiceGroup";
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
  termStart: null,
  termEnd: null,
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

/** The check that marks the chosen colour. Always rendered, so picking a
 *  different swatch is a fade rather than a jump in the row's height. */
function Tick({ shown }: { shown: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={cn("size-4 transition-opacity", shown ? "opacity-100" : "opacity-0")}
    >
      <path d="m5 12.5 4.5 4.5L19 7" />
    </svg>
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
          termStart: course.termStart ?? null,
          termEnd: course.termEnd ?? null,
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
      termStart: draft.termStart || null,
      termEnd: draft.termEnd || null,
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
        <legend className="text-sm font-medium">Term dates</legend>
        <p className="text-sm text-[var(--color-ink-muted)]">
          What “Week 4” on a syllabus means, and how far the weekly lectures and
          class times run.
        </p>
        <div className="grid gap-6 sm:grid-cols-2">
          <Field label="First day">
            {({ id, className }) => (
              <input
                id={id}
                type="date"
                className={className}
                value={draft.termStart ?? ""}
                onChange={(event) => setDraft({ ...draft, termStart: event.target.value })}
              />
            )}
          </Field>
          <Field label="Last day">
            {({ id, className }) => (
              <input
                id={id}
                type="date"
                className={className}
                value={draft.termEnd ?? ""}
                onChange={(event) => setDraft({ ...draft, termEnd: event.target.value })}
              />
            )}
          </Field>
        </div>
      </fieldset>

      <div className="space-y-3">
        {/* The group carries its own name, so the heading beside it is
            decoration — a legend as well would announce "Colour" twice. */}
        <p aria-hidden="true" className="text-sm font-medium">
          Colour
        </p>
        <ChoiceGroup
          label="Colour"
          value={draft.color}
          onSelect={(color) => setDraft({ ...draft, color })}
          className="flex flex-wrap gap-2"
          choices={COURSE_COLOR_KEYS.map((key) => ({
            value: key,
            label: COURSE_COLORS[key].label,
            className: COURSE_COLORS[key].swatch,
            content: <Tick shown={draft.color === key} />,
          }))}
          optionClassName={(selected) =>
            cn(
              "grid size-11 place-items-center rounded-xl text-white transition",
              "ring-offset-2 ring-offset-[var(--color-surface)]",
              selected ? "ring-2 ring-[var(--color-ink)]" : "hover:ring-2 hover:ring-[var(--color-border-soft)]",
            )
          }
        />
      </div>

      <div className="space-y-3">
        {/* The group carries its own name, so the heading beside it is
            decoration — a legend as well would announce "Icon" twice. */}
        <p aria-hidden="true" className="text-sm font-medium">
          Icon
        </p>
        <ChoiceGroup
          label="Icon"
          value={draft.icon}
          onSelect={(icon) => setDraft({ ...draft, icon })}
          className="flex flex-wrap gap-2"
          choices={COURSE_ICON_KEYS.map((key) => ({
            value: key,
            label: COURSE_ICONS[key].label,
            content: <CourseIcon icon={key} />,
          }))}
          optionClassName={(selected) =>
            cn(
              "grid size-11 place-items-center rounded-xl border transition",
              "ring-offset-2 ring-offset-[var(--color-surface)]",
              selected
                ? "border-transparent bg-[var(--color-surface-muted)] ring-2 ring-[var(--color-ink)]"
                : "border-[var(--color-border-soft)] hover:bg-[var(--color-surface-muted)]",
            )
          }
        />
      </div>

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
