"use client";

import { useMemo, useState } from "react";
import { useAppData } from "@/lib/appData";
import { formatISODate } from "@/lib/syllabusDates";
import { KIND_LABELS, type Confidence, type SyllabusParseResult } from "@/lib/syllabusParser";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { controlClass } from "@/components/ui/Field";
import type { Course, GradeWeight, StudyDocument } from "@/types";

interface SyllabusReviewModalProps {
  open: boolean;
  course: Course;
  document: StudyDocument;
  result: SyllabusParseResult;
  /** Re-runs the parse against a different term start. */
  onChangeTermStart(termStart: string): void;
  onClose(): void;
  onImported(summary: { added: number; skipped: number; weights: number }): void;
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

function ReviewForm({
  course,
  document,
  result,
  onChangeTermStart,
  onClose,
  onImported,
}: SyllabusReviewModalProps) {
  const { importTasks, updateCourse } = useAppData();

  const [rows, setRows] = useState<Row[]>(() =>
    result.assignments.map((assignment) => ({
      id: assignment.id,
      // Unsure rows start unchecked. The point of this screen is that a
      // student can trust what lands in their list, and a wrong due date is
      // worse than a missing one.
      selected: assignment.confidence !== "low" && assignment.dueAt !== null,
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

  const selected = rows.filter((row) => row.selected);
  const importable = selected.filter((row) => row.title.trim().length > 0);
  const weightTotal = weights.reduce((sum, weight) => sum + weight.percent, 0);

  const nothingFound = result.assignments.length === 0 && result.gradingWeights.length === 0;

  const patch = (id: string, changes: Partial<Row>) =>
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...changes } : row)));

  function handleImport() {
    const summary = importTasks(
      importable.map((row) => ({
        courseId: course.id,
        title: row.title.trim(),
        notes: "",
        dueAt: row.dueAt ? new Date(`${row.dueAt}T00:00:00`).toISOString() : null,
        status: "todo" as const,
        subtasks: [],
        source: { kind: "syllabus" as const, documentId: document.id, excerpt: row.excerpt },
      })),
    );

    updateCourse(course.id, {
      termStart: result.termStart,
      ...(saveWeights ? { gradingWeights: weights } : {}),
    });

    onImported({ ...summary, weights: saveWeights ? weights.length : 0 });
  }

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

      <div className="sticky bottom-0 -mx-6 -mb-6 flex flex-wrap items-center gap-3 border-t border-[var(--color-border-soft)] bg-[var(--color-surface)] px-6 py-4">
        <Button
          variant="primary"
          onClick={handleImport}
          disabled={importable.length === 0 && !saveWeights}
        >
          {importable.length > 0
            ? `Add ${importable.length} ${importable.length === 1 ? "assignment" : "assignments"}`
            : "Save grading breakdown"}
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
