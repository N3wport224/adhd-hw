"use client";

import { useMemo, useState } from "react";
import { useAppData } from "@/lib/appData";
import { lectureTaskDrafts, plannedLectureWeeks } from "@/lib/lecturePlan";
import { formatISODate } from "@/lib/syllabusDates";
import { describeMeetingPattern } from "@/lib/syllabusCourseInfo";
import {
  KIND_LABELS,
  summariseAssignments,
  type Confidence,
  type SyllabusParseResult,
} from "@/lib/syllabusParser";
import { cn, plural } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { controlClass } from "@/components/ui/Field";
import type { Course, GradeWeight, MeetingPattern, StudyDocument } from "@/types";

interface SyllabusReviewModalProps {
  open: boolean;
  course: Course;
  document: StudyDocument;
  result: SyllabusParseResult;
  /** Re-runs the parse against a different term start. */
  onChangeTermStart(termStart: string): void;
  onClose(): void;
  onImported(summary: {
    added: number;
    skipped: number;
    weights: number;
    details: boolean;
    lectures: number;
  }): void;
}

/** One editable row of the review table. */
interface Row {
  id: string;
  selected: boolean;
  title: string;
  dueAt: string;
  rawDate: string | null;
  kind: string;
  confidence: Confidence;
  excerpt: string;
}

const CONFIDENCE_LABELS: Record<Confidence, string> = {
  high: "Confident",
  medium: "Likely",
  low: "Unsure",
};

const CONFIDENCE_STYLES: Record<Confidence, string> = {
  high: "bg-[var(--color-accent-soft)] text-[var(--color-ink)]",
  medium: "bg-[var(--color-surface-muted)] text-[var(--color-ink-muted)]",
  low: "bg-[#f6efdd] text-[#6b5626] dark:bg-[#3b3320] dark:text-[#e3d0a2]",
};

export function SyllabusReviewModal(props: SyllabusReviewModalProps) {
  return (
    <Dialog
      open={props.open}
      title="Check what was found"
      description="This was read off the document by pattern matching, so it will get some of it wrong. Nothing is added until you say so."
      onClose={props.onClose}
      size="wide"
    >
      {/* Keyed on the parse so changing the term start rebuilds the rows from
          the new dates rather than leaving stale edits behind. */}
      <ReviewForm key={props.result.termStart} {...props} />
    </Dialog>
  );
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** How far ahead is worth putting on a list today. */
const HORIZON_DAYS = 31;

function horizon() {
  const date = new Date();
  date.setDate(date.getDate() + HORIZON_DAYS);
  return date.toISOString().slice(0, 10);
}

/**
 * Days as toggles and times as fields, rather than a text box to retype.
 * The parser gets the pattern right most of the time; correcting a single
 * wrong day should cost one tap.
 */
function MeetingPatternEditor({
  pattern,
  onChange,
}: {
  pattern: MeetingPattern | null;
  onChange(next: MeetingPattern | null): void;
}) {
  const current: MeetingPattern = pattern ?? {
    days: [],
    startTime: null,
    endTime: null,
    location: "",
  };

  const toggleDay = (day: number) => {
    const days = current.days.includes(day as MeetingPattern["days"][number])
      ? current.days.filter((item) => item !== day)
      : [...current.days, day as MeetingPattern["days"][number]].sort((a, b) => a - b);
    onChange(days.length === 0 && !current.startTime ? null : { ...current, days });
  };

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">When it meets</p>
      <div className="flex flex-wrap gap-1">
        {DAY_LABELS.map((label, day) => {
          const on = current.days.includes(day as MeetingPattern["days"][number]);
          return (
            <button
              key={label}
              type="button"
              onClick={() => toggleDay(day)}
              aria-pressed={on}
              className={cn(
                "min-h-10 min-w-12 rounded-lg border text-sm font-medium transition",
                on
                  ? "border-transparent bg-[var(--color-accent)] text-[var(--color-on-accent)]"
                  : "border-[var(--color-border-soft)] text-[var(--color-ink-muted)] hover:bg-[var(--color-surface-muted)]",
              )}
            >
              {label}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <label htmlFor="meeting-start" className="block text-xs text-[var(--color-ink-muted)]">
            Starts
          </label>
          <input
            id="meeting-start"
            type="time"
            value={current.startTime ?? ""}
            onChange={(event) =>
              onChange({ ...current, startTime: event.target.value || null })
            }
            className={cn("w-auto", controlClass("sm"))}
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="meeting-end" className="block text-xs text-[var(--color-ink-muted)]">
            Ends
          </label>
          <input
            id="meeting-end"
            type="time"
            value={current.endTime ?? ""}
            onChange={(event) => onChange({ ...current, endTime: event.target.value || null })}
            className={cn("w-auto", controlClass("sm"))}
          />
        </div>
        <div className="min-w-40 flex-1 space-y-1">
          <label htmlFor="meeting-location" className="block text-xs text-[var(--color-ink-muted)]">
            Where
          </label>
          <input
            id="meeting-location"
            value={current.location}
            onChange={(event) => onChange({ ...current, location: event.target.value })}
            placeholder="Room or building"
            className={cn("w-full", controlClass("sm"))}
          />
        </div>
      </div>

      {current.days.length > 0 ? (
        <p className="text-sm text-[var(--color-ink-muted)]">
          {describeMeetingPattern(current)}
        </p>
      ) : (
        <p className="text-sm text-[var(--color-ink-muted)]">
          No meeting days set, so this course will not appear on the calendar as a
          class.
        </p>
      )}
    </div>
  );
}

function ReviewForm({
  course,
  document,
  result,
  onChangeTermStart,
  onClose,
  onImported,
}: SyllabusReviewModalProps) {
  const { data, importTasks, updateCourse } = useAppData();

  // Declared before the row state that reads it: a lazy useState initializer
  // runs during this call, so a const declared further down is still in its
  // temporal dead zone and blows the whole screen up.
  const hasFeed = data.tasks.some(
    (task) => task.courseId === course.id && task.source?.kind === "calendar",
  );

  const [rows, setRows] = useState<Row[]>(() =>
    result.assignments.map((assignment) => ({
      id: assignment.id,
      // Unsure rows start unchecked. The point of this screen is that a
      // student can trust what lands in their list, and a wrong due date is
      // worse than a missing one.
      //
      // So does anything past the next month. A term arrives as forty-odd
      // items, and importing all of them on day one is the wall of everything
      // this app exists to avoid — the rest is one click away, when it is
      // closer to being real.
      selected:
        assignment.confidence !== "low" &&
        assignment.dueAt !== null &&
        assignment.dueAt <= horizon() &&
        // A course whose dates already came from its calendar feed does not
        // need them guessed at from prose. The grading breakdown and the
        // course details are what this scan is still the only source of.
        !hasFeed,
      title: assignment.title,
      dueAt: assignment.dueAt ?? "",
      rawDate: assignment.rawDate,
      kind: KIND_LABELS[assignment.kind],
      confidence: assignment.confidence,
      excerpt: assignment.excerpt,
    })),
  );

  const [weights, setWeights] = useState<GradeWeight[]>(result.gradingWeights);
  const [saveWeights, setSaveWeights] = useState(result.gradingWeights.length > 0);
  const [showExcerpt, setShowExcerpt] = useState<string | null>(null);

  const [instructor, setInstructor] = useState(result.details.instructor ?? course.instructor);
  const [officeHours, setOfficeHours] = useState(result.details.officeHours ?? course.officeHours ?? "");
  const [meetingPattern, setMeetingPattern] = useState<MeetingPattern | null>(
    result.details.meetingPattern ?? course.meetingPattern ?? null,
  );
  const [saveDetails, setSaveDetails] = useState(
    result.details.instructor !== null ||
      result.details.meetingPattern !== null ||
      result.details.officeHours !== null,
  );
  const [termEnd, setTermEnd] = useState(course.termEnd ?? "");
  const [addLectures, setAddLectures] = useState(true);

  // The lecture weeks follow the term and meeting days as edited on this
  // screen, not as they were saved before it opened.
  const patternToUse = saveDetails ? meetingPattern : (course.meetingPattern ?? null);
  const lectureDrafts = useMemo(
    () =>
      lectureTaskDrafts({
        ...course,
        termStart: result.termStart,
        termEnd: termEnd || null,
        meetingPattern: patternToUse,
      }),
    [course, result.termStart, termEnd, patternToUse],
  );
  const alreadyPlanned = plannedLectureWeeks(data.tasks, course.id);
  const newLectureWeeks = lectureDrafts.filter(
    (draft) => draft.source?.kind === "lectures" && !alreadyPlanned.has(draft.source.weekStart),
  ).length;

  const selected = rows.filter((row) => row.selected);
  const importable = selected.filter((row) => row.title.trim().length > 0);
  const weightTotal = weights.reduce((sum, weight) => sum + weight.percent, 0);

  const foundDetails =
    result.details.instructor !== null ||
    result.details.meetingPattern !== null ||
    result.details.officeHours !== null;
  const nothingFound =
    result.assignments.length === 0 && result.gradingWeights.length === 0 && !foundDetails;

  const patch = (id: string, changes: Partial<Row>) =>
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...changes } : row)));

  function handleImport() {
    // One call, not two: the deduplication reads the tasks as they are now,
    // and a second call in the same tick would still be looking at them.
    const summary = importTasks([
      ...importable.map((row) => ({
        courseId: course.id,
        title: row.title.trim(),
        notes: "",
        dueAt: row.dueAt ? new Date(`${row.dueAt}T00:00:00`).toISOString() : null,
        status: "todo" as const,
        subtasks: [],
        source: { kind: "syllabus" as const, documentId: document.id, excerpt: row.excerpt },
      })),
      ...(addLectures ? lectureDrafts : []),
    ]);

    updateCourse(course.id, {
      termStart: result.termStart,
      termEnd: termEnd || null,
      ...(saveWeights ? { gradingWeights: weights } : {}),
      ...(saveDetails
        ? {
            instructor: instructor.trim(),
            officeHours: officeHours.trim(),
            meetingPattern,
          }
        : {}),
    });

    const lectures = addLectures ? newLectureWeeks : 0;
    onImported({
      ...summary,
      // The count the student cares about is assignments; lectures are their
      // own line in the confirmation.
      added: summary.added - lectures,
      skipped: summary.skipped - (addLectures ? lectureDrafts.length - lectures : 0),
      lectures,
      weights: saveWeights ? weights.length : 0,
      details: saveDetails && (instructor.trim() !== "" || meetingPattern !== null),
    });
  }

  const addedLectures = addLectures ? newLectureWeeks : 0;
  const addButtonLabel = (() => {
    const parts: string[] = [];
    if (importable.length > 0) {
      parts.push(`${importable.length} ${importable.length === 1 ? "assignment" : "assignments"}`);
    }
    if (addedLectures > 0) {
      parts.push(`${addedLectures} ${addedLectures === 1 ? "week" : "weeks"} of lectures`);
    }
    if (parts.length === 0) return "Save grading breakdown";
    return `Add ${parts.join(" and ")}`;
  })();

  const laterCount = rows.filter(
    (row) => !row.selected && row.dueAt !== "" && row.dueAt > horizon(),
  ).length;

  const shape = useMemo(
    () => summariseAssignments(importable.map((row) => row.title)),
    [importable],
  );

  const orderedRows = useMemo(
    () => [...rows].sort((a, b) => (a.dueAt || "9999").localeCompare(b.dueAt || "9999")),
    [rows],
  );

  return (
    <div className="space-y-8">
      <section className="space-y-3 rounded-xl bg-[var(--color-surface-muted)] p-4">
        <label htmlFor="term-start" className="block text-sm font-medium">
          When does the term start?
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <input
            id="term-start"
            type="date"
            value={result.termStart}
            onChange={(event) => {
              if (event.target.value) onChangeTermStart(event.target.value);
            }}
            className={cn("w-auto", controlClass("sm"))}
          />
          <p className="w-full text-sm text-[var(--color-ink-muted)] sm:w-auto sm:flex-1">
            Syllabi write “Oct 12” and “Week 4” without a year. Change this and the
            dates below are worked out again.
          </p>
        </div>
      </section>

      {result.warnings.length > 0 ? (
        <ul className="space-y-1 text-sm text-[#6b5626] dark:text-[#e3d0a2]">
          {result.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      ) : null}

      {nothingFound ? (
        <p className="rounded-xl border border-dashed border-[var(--color-border-soft)] px-4 py-8 text-center text-sm text-[var(--color-ink-muted)]">
          Nothing recognisable was found in this document. That happens with
          scanned pages and with schedules laid out as images. The document is
          still in your library and readable — you can add its dates by hand.
        </p>
      ) : null}

      {foundDetails ? (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-base font-semibold">Course details</h3>
            <label className="flex items-center gap-2 text-sm text-[var(--color-ink-muted)]">
              <input
                type="checkbox"
                checked={saveDetails}
                onChange={() => setSaveDetails((current) => !current)}
                className="size-4 accent-[var(--color-accent)]"
              />
              Save to the course
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label htmlFor="detail-instructor" className="block text-sm font-medium">
                Instructor
              </label>
              <input
                id="detail-instructor"
                value={instructor}
                onChange={(event) => setInstructor(event.target.value)}
                placeholder="Not found"
                className={cn("w-full", controlClass("sm"))}
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="detail-office" className="block text-sm font-medium">
                Office hours
              </label>
              <input
                id="detail-office"
                value={officeHours}
                onChange={(event) => setOfficeHours(event.target.value)}
                placeholder="Not found"
                className={cn("w-full", controlClass("sm"))}
              />
            </div>
          </div>

          <MeetingPatternEditor pattern={meetingPattern} onChange={setMeetingPattern} />

          {meetingPattern ? (
            <div className="space-y-1">
              <label htmlFor="term-end" className="block text-sm font-medium">
                Last day of term
              </label>
              <input
                id="term-end"
                type="date"
                value={termEnd}
                min={result.termStart}
                onChange={(event) => setTermEnd(event.target.value)}
                className={cn("w-auto", controlClass("sm"))}
              />
              <p className="text-sm text-[var(--color-ink-muted)]">
                Class meetings stop repeating here. Left empty, they run about four
                months from the start of term.
              </p>
            </div>
          ) : null}
        </section>
      ) : null}

      {rows.length > 0 ? (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-base font-semibold">
              Assignments{" "}
              <span className="font-normal text-[var(--color-ink-muted)]">
                {selected.length} of {rows.length} selected
              </span>
            </h3>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                onClick={() => setRows((c) => c.map((row) => ({ ...row, selected: true })))}
              >
                Select all
              </Button>
              <Button
                variant="ghost"
                onClick={() => setRows((c) => c.map((row) => ({ ...row, selected: false })))}
              >
                None
              </Button>
            </div>
          </div>

          {hasFeed ? (
            <p className="rounded-xl bg-[var(--color-accent-wash)] px-4 py-3 text-sm">
              This course already has its dates from its calendar feed, which is
              the more reliable source — so nothing here is ticked. Tick anything
              the feed missed.
            </p>
          ) : null}

          {laterCount > 0 && !hasFeed ? (
            <p className="text-sm text-[var(--color-ink-muted)]">
              {laterCount} further out than a month {laterCount === 1 ? "is" : "are"} left
              unticked — <button
                type="button"
                onClick={() => setRows((c) => c.map((row) => ({ ...row, selected: true })))}
                className="underline underline-offset-4 hover:text-[var(--color-ink)]"
              >
                take the whole term
              </button>{" "}
              if you would rather see it all.
            </p>
          ) : null}

          {shape.length > 0 ? (
            <p className="text-sm text-[var(--color-ink-muted)]">
              That is{" "}
              {shape
                .map((group) => `${group.count} × ${plural(group.label, group.count)}`)
                .join(", ")}
              .
            </p>
          ) : null}

          <ul className="space-y-2">
            {orderedRows.map((row) => (
              <li
                key={row.id}
                className={cn(
                  "rounded-xl border p-3 transition",
                  row.selected
                    ? "border-[var(--color-focus-ring)] bg-[var(--color-surface)]"
                    : "border-[var(--color-border-soft)] bg-[var(--color-surface-muted)]",
                )}
              >
                <div className="flex flex-wrap items-start gap-3">
                  <input
                    type="checkbox"
                    checked={row.selected}
                    onChange={() => patch(row.id, { selected: !row.selected })}
                    aria-label={`Import ${row.title || "this row"}`}
                    className="mt-3 size-5 shrink-0 accent-[var(--color-accent)]"
                  />

                  <div className="min-w-45 flex-1 space-y-2">
                    <label className="sr-only" htmlFor={`title-${row.id}`}>
                      Assignment title
                    </label>
                    <input
                      id={`title-${row.id}`}
                      value={row.title}
                      onChange={(event) => patch(row.id, { title: event.target.value })}
                      className={cn("w-full", controlClass("sm"))}
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          "rounded-md px-2 py-0.5 text-xs font-medium",
                          CONFIDENCE_STYLES[row.confidence],
                        )}
                      >
                        {CONFIDENCE_LABELS[row.confidence]}
                      </span>
                      <span className="text-xs text-[var(--color-ink-muted)]">{row.kind}</span>
                      {row.rawDate ? (
                        <span className="text-xs text-[var(--color-ink-muted)]">
                          read from “{row.rawDate}”
                        </span>
                      ) : null}
                      <button
                        type="button"
                        onClick={() =>
                          setShowExcerpt(showExcerpt === row.id ? null : row.id)
                        }
                        aria-expanded={showExcerpt === row.id}
                        className="text-xs text-[var(--color-ink-muted)] underline underline-offset-4 transition hover:text-[var(--color-ink)]"
                      >
                        {showExcerpt === row.id ? "Hide source" : "Show source"}
                      </button>
                    </div>
                    {showExcerpt === row.id ? (
                      <p className="rounded-lg bg-[var(--color-surface-muted)] p-3 text-xs leading-relaxed text-[var(--color-ink-muted)]">
                        {row.excerpt}
                      </p>
                    ) : null}
                  </div>

                  <div className="space-y-1">
                    <label className="sr-only" htmlFor={`due-${row.id}`}>
                      Due date
                    </label>
                    <input
                      id={`due-${row.id}`}
                      type="date"
                      value={row.dueAt}
                      onChange={(event) => patch(row.id, { dueAt: event.target.value })}
                      className={cn("w-auto", controlClass("sm"))}
                    />
                    {row.dueAt ? (
                      <p className="text-xs text-[var(--color-ink-muted)]">
                        {formatISODate(row.dueAt)}
                      </p>
                    ) : (
                      <p className="text-xs text-[#a8503f] dark:text-[#e29b8b]">No date read</p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => setRows((c) => c.filter((item) => item.id !== row.id))}
                    aria-label={`Discard ${row.title || "this row"}`}
                    className="mt-1 grid size-9 shrink-0 place-items-center rounded-lg text-[var(--color-ink-muted)] transition hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-ink)]"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.8}
                      strokeLinecap="round"
                      aria-hidden="true"
                      className="size-4"
                    >
                      <path d="m6 6 12 12M18 6 6 18" />
                    </svg>
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {weights.length > 0 ? (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-base font-semibold">Grading breakdown</h3>
            <label className="flex items-center gap-2 text-sm text-[var(--color-ink-muted)]">
              <input
                type="checkbox"
                checked={saveWeights}
                onChange={() => setSaveWeights((current) => !current)}
                className="size-4 accent-[var(--color-accent)]"
              />
              Save to the course
            </label>
          </div>

          <ul className="space-y-2">
            {weights.map((weight, position) => (
              <li key={`${weight.label}-${position}`} className="flex items-center gap-2">
                <label className="sr-only" htmlFor={`weight-label-${position}`}>
                  Category
                </label>
                <input
                  id={`weight-label-${position}`}
                  value={weight.label}
                  onChange={(event) =>
                    setWeights((current) =>
                      current.map((item, i) =>
                        i === position ? { ...item, label: event.target.value } : item,
                      ),
                    )
                  }
                  className={cn("flex-1", controlClass("sm"))}
                />
                <label className="sr-only" htmlFor={`weight-percent-${position}`}>
                  Percent of the grade
                </label>
                <input
                  id={`weight-percent-${position}`}
                  type="number"
                  min={0}
                  max={100}
                  value={weight.percent}
                  onChange={(event) =>
                    setWeights((current) =>
                      current.map((item, i) =>
                        i === position ? { ...item, percent: Number(event.target.value) } : item,
                      ),
                    )
                  }
                  className={cn("w-20", controlClass("sm"))}
                />
                <span aria-hidden="true" className="text-sm text-[var(--color-ink-muted)]">
                  %
                </span>
                <button
                  type="button"
                  onClick={() => setWeights((c) => c.filter((_, i) => i !== position))}
                  aria-label={`Remove ${weight.label}`}
                  className="grid size-9 shrink-0 place-items-center rounded-lg text-[var(--color-ink-muted)] transition hover:bg-[var(--color-surface-muted)]"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.8}
                    strokeLinecap="round"
                    aria-hidden="true"
                    className="size-4"
                  >
                    <path d="m6 6 12 12M18 6 6 18" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>

          <p
            className={cn(
              "text-sm",
              Math.abs(weightTotal - 100) > 1
                ? "text-[#a8503f] dark:text-[#e29b8b]"
                : "text-[var(--color-ink-muted)]",
            )}
          >
            Adds up to {Math.round(weightTotal * 10) / 10}%
          </p>
        </section>
      ) : null}

      <section className="space-y-3">
        <h3 className="text-base font-semibold">Lectures</h3>
        <label className="flex items-start gap-3 rounded-xl bg-[var(--color-surface-muted)] p-4 text-sm">
          <input
            type="checkbox"
            checked={addLectures}
            onChange={() => setAddLectures((current) => !current)}
            className="mt-0.5 size-4 accent-[var(--color-accent)]"
          />
          <span>
            <span className="font-medium">
              Add a lectures task for each week of term
            </span>
            <span className="mt-1 block text-[var(--color-ink-muted)]">
              {newLectureWeeks === 0 ? (
                alreadyPlanned.size > 0 ? (
                  "Every week of this term already has one."
                ) : (
                  "Set a term start above and the weeks will appear here."
                )
              ) : (
                <>
                  {newLectureWeeks} {newLectureWeeks === 1 ? "week" : "weeks"}
                  {patternToUse && patternToUse.days.length > 0
                    ? `, one step per class — ${describeMeetingPattern(patternToUse)}`
                    : ", one step a week, since no class days were found"}
                  .{" "}
                  {alreadyPlanned.size > 0
                    ? `The ${alreadyPlanned.size} already added are left alone.`
                    : "Each one lands on the day it happens."}
                </>
              )}
            </span>
          </span>
        </label>
      </section>

      <div className="sticky bottom-0 -mx-6 -mb-6 flex flex-wrap items-center gap-3 border-t border-[var(--color-border-soft)] bg-[var(--color-surface)] px-6 py-4">
        <Button
          variant="primary"
          onClick={handleImport}
          disabled={importable.length === 0 && !saveWeights && addedLectures === 0}
        >
          {addButtonLabel}
        </Button>
        <Button variant="ghost" onClick={onClose}>
          Not now
        </Button>
        <p className="text-sm text-[var(--color-ink-muted)]">
          You can edit or delete anything after it is added.
        </p>
      </div>
    </div>
  );
}
