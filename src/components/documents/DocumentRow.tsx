"use client";

import Link from "next/link";
import { useState } from "react";
import { useAppData } from "@/lib/appData";
import { COURSE_COLORS } from "@/lib/courseStyles";
import { estimateMinutes } from "@/lib/documents/sentences";
import { cn } from "@/lib/utils";
import type { StudyDocument } from "@/types";

const KIND_LABELS: Record<StudyDocument["kind"], string> = {
  pdf: "PDF",
  docx: "Word",
  text: "Text",
};

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

interface DocumentRowProps {
  document: StudyDocument;
  /** Hidden on a course page, where every row is the same course. */
  showCourse?: boolean;
  /**
   * Offered only where there is a course to file the results under. Lets a
   * syllabus be re-scanned after the term start is corrected, or scanned at
   * all if the upload-time offer was dismissed.
   */
  onScan?(): void;
}

export function DocumentRow({ document, showCourse = true, onScan }: DocumentRowProps) {
  const { data, removeDocument, updateDocument } = useAppData();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const course = data.courses.find((item) => item.id === document.courseId) ?? null;
  const minutes = estimateMinutes(document.paragraphs);

  return (
    <div className="relative flex flex-wrap items-start gap-x-4 gap-y-2 py-4">
      <span
        aria-hidden="true"
        className={cn(
          "mt-0.5 grid size-10 shrink-0 place-items-center rounded-xl text-xs font-semibold",
          course ? COURSE_COLORS[course.color].chip : "bg-[var(--color-surface-muted)]",
        )}
      >
        {KIND_LABELS[document.kind]}
      </span>

      <div className="min-w-40 flex-1">
        <h3 className="font-medium">
          <Link
            href={`/reader/${document.id}`}
            className="after:absolute after:inset-0 after:content-['']"
          >
            {document.title}
          </Link>
        </h3>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-[var(--color-ink-muted)]">
          {showCourse ? (
            <span
              className={cn(
                "rounded-md px-2 py-0.5 text-xs font-medium",
                course
                  ? COURSE_COLORS[course.color].chip
                  : "bg-[var(--color-surface-muted)]",
              )}
            >
              {course ? course.code || course.name : "Unfiled"}
            </span>
          ) : null}
          <span>~{minutes} min read</span>
          {document.pageCount ? (
            <span>
              {document.pageCount} {document.pageCount === 1 ? "page" : "pages"}
            </span>
          ) : null}
          <span>{formatSize(document.fileSize)}</span>
          {document.lastSentenceIndex > 0 ? (
            <span className="text-[var(--color-accent)]">In progress</span>
          ) : null}
        </p>
      </div>

      {/* Wraps below the title on narrow screens: three controls plus a
          course picker do not fit beside a filename on a phone. */}
      <div className="relative z-10 ml-auto flex flex-wrap items-center gap-2">
        {onScan ? (
          <button
            type="button"
            onClick={onScan}
            className="min-h-9 rounded-lg px-3 text-sm font-medium text-[var(--color-ink-muted)] transition hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-ink)]"
          >
            Scan for dates
          </button>
        ) : null}

        {/* Refiling from the row itself: a document dropped into the wrong
            course is the most likely thing to need fixing, and making that a
            trip to another screen is how libraries end up disorganised. */}
        <label className="sr-only" htmlFor={`course-${document.id}`}>
          Course for {document.title}
        </label>
        <select
          id={`course-${document.id}`}
          value={document.courseId ?? ""}
          onChange={(event) =>
            updateDocument(document.id, { courseId: event.target.value || null })
          }
          className={cn(
            "min-h-9 rounded-lg border border-[var(--color-border-soft)]",
            "bg-[var(--color-surface)] px-2 text-sm text-[var(--color-ink-muted)]",
          )}
        >
          <option value="">Unfiled</option>
          {data.courses.map((item) => (
            <option key={item.id} value={item.id}>
              {item.code || item.name}
            </option>
          ))}
        </select>

        {confirmingDelete ? (
          <>
            <button
              type="button"
              onClick={() => removeDocument(document.id)}
              className="min-h-9 rounded-lg border border-[#e2b3a9] px-3 text-sm text-[#a8503f] transition hover:bg-[#f6e9e6] dark:border-[#5c3a33] dark:text-[#e29b8b] dark:hover:bg-[#3a2925]"
            >
              Delete
            </button>
            <button
              type="button"
              onClick={() => setConfirmingDelete(false)}
              className="min-h-9 rounded-lg px-3 text-sm text-[var(--color-ink-muted)] transition hover:bg-[var(--color-surface-muted)]"
            >
              Keep
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            aria-label={`Remove ${document.title}`}
            className="grid size-9 place-items-center rounded-lg text-[var(--color-ink-muted)] transition hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-ink)]"
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
              <path d="M5 7h14M10 7V5h4v2m-7 0 1 13h8l1-13" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
