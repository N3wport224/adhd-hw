"use client";

import { useCallback, useId, useRef, useState } from "react";
import { useAppData } from "@/lib/appData";
import {
  ACCEPTED_EXTENSIONS,
  ExtractionError,
  extractDocument,
} from "@/lib/documents/extract";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import type { StudyDocument } from "@/types";

interface DocumentDropzoneProps {
  /** Documents dropped here are bound to this course. Null files them as unfiled. */
  courseId: string | null;
  /** Named in the confirmation line, so the binding is visible not implied. */
  courseName?: string;
  /**
   * Called with each stored document once it has been read. The course page
   * uses this to offer a syllabus scan; the library has nowhere to file the
   * results, so it passes nothing.
   */
  onDocumentAdded?(document: StudyDocument): void;
}

interface Progress {
  fileName: string;
  position: number;
  total: number;
}

export function DocumentDropzone({
  courseId,
  courseName,
  onDocumentAdded,
}: DocumentDropzoneProps) {
  const { addDocument } = useAppData();
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [failures, setFailures] = useState<string[]>([]);
  const [added, setAdded] = useState<string[]>([]);

  // Drag events fire for every child element, so a boolean flag would flicker
  // as the pointer moves across the zone. Counting enter/leave pairs doesn't.
  const dragDepth = useRef(0);

  const ingest = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;
      setFailures([]);
      setAdded([]);

      const problems: string[] = [];
      const succeeded: string[] = [];
      const stored: StudyDocument[] = [];

      for (const [position, file] of files.entries()) {
        setProgress({ fileName: file.name, position: position + 1, total: files.length });
        try {
          const draft = await extractDocument(file, courseId);
          const document = addDocument(draft);
          succeeded.push(document.title);
          stored.push(document);
        } catch (error) {
          problems.push(
            error instanceof ExtractionError
              ? error.message
              : `Something went wrong reading ${file.name}.`,
          );
        }
      }

      setProgress(null);
      setFailures(problems);
      setAdded(succeeded);

      // Announced after the state above, so the confirmation line is already
      // on screen behind whatever the caller opens.
      for (const document of stored) onDocumentAdded?.(document);
    },
    [addDocument, courseId, onDocumentAdded],
  );

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      dragDepth.current = 0;
      setDragging(false);
      void ingest(Array.from(event.dataTransfer.files));
    },
    [ingest],
  );

  const busy = progress !== null;

  return (
    <div className="space-y-3">
      <div
        onDragEnter={(event) => {
          event.preventDefault();
          dragDepth.current += 1;
          setDragging(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => {
          event.preventDefault();
          dragDepth.current = Math.max(0, dragDepth.current - 1);
          if (dragDepth.current === 0) setDragging(false);
        }}
        onDrop={onDrop}
        className={cn(
          "rounded-[var(--radius-card)] border-2 border-dashed px-6 py-10 text-center transition",
          dragging
            ? "border-[var(--color-focus)] bg-[var(--color-accent-wash)]"
            : "border-[var(--color-border-soft)] bg-[var(--color-surface)]",
        )}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="mx-auto size-8 text-[var(--color-ink-muted)]"
        >
          <path d="M12 16V4m0 0L8 8m4-4 4 4M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
        </svg>

        <p className="mt-4 text-base font-medium">
          {busy ? "Reading your file…" : "Drop a reading here"}
        </p>
        <p className="mx-auto mt-1 max-w-sm text-sm text-[var(--color-ink-muted)]">
          {busy && progress ? (
            <>
              {progress.fileName}
              {progress.total > 1 ? ` (${progress.position} of ${progress.total})` : ""}
            </>
          ) : (
            <>
              PDF, Word or text.{" "}
              {courseName ? `Files land in ${courseName}.` : "Files start out unfiled."} Nothing
              leaves your device.
            </>
          )}
        </p>

        <div className="mt-5">
          <label htmlFor={inputId} className="sr-only">
            Choose a document to upload
          </label>
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            multiple
            accept={ACCEPTED_EXTENSIONS.join(",")}
            disabled={busy}
            onChange={(event) => {
              void ingest(Array.from(event.target.files ?? []));
              // Clear the value so re-picking the same file still fires change.
              event.target.value = "";
            }}
            className="sr-only"
          />
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            aria-busy={busy}
          >
            {busy ? "Working…" : "Choose a file"}
          </Button>
        </div>
      </div>

      {added.length > 0 ? (
        <p
          role="status"
          className="animate-rise-fade text-sm text-[var(--color-ink-muted)]"
        >
          Added {added.join(", ")}
          {courseName ? ` to ${courseName}` : ""}.
        </p>
      ) : null}

      {failures.length > 0 ? (
        <ul role="alert" className="space-y-1 text-sm text-[#a8503f] dark:text-[#e29b8b]">
          {failures.map((failure) => (
            <li key={failure}>{failure}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
