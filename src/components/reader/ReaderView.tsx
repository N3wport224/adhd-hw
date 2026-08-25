"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useAppData, useDocument } from "@/lib/appData";
import { COURSE_COLORS } from "@/lib/courseStyles";
import { estimateMinutes, toSentences } from "@/lib/documents/sentences";
import { useSpeechReader } from "@/lib/speech";
import { cn } from "@/lib/utils";
import { LinkButton } from "@/components/ui/Button";
import { controlClass } from "@/components/ui/Field";
import { EmptyState } from "@/components/ui/EmptyState";
import { ReaderControls } from "@/components/reader/ReaderControls";
import { ReaderPane } from "@/components/reader/ReaderPane";
import type { StudyDocument } from "@/types";

export function ReaderView({ documentId }: { documentId: string }) {
  const { ready } = useAppData();
  const document = useDocument(documentId);

  if (!ready) {
    return (
      <div
        aria-hidden="true"
        className="h-96 animate-pulse rounded-[var(--radius-card)] bg-[var(--color-surface-muted)]"
      />
    );
  }

  if (!document) {
    return (
      <EmptyState
        title="That document is not here"
        body="It may have been removed from your library."
        action={
          <LinkButton href="/reader" variant="primary">
            Back to the library
          </LinkButton>
        }
      />
    );
  }

  // Mounted only once the document is loaded, and keyed by id. The saved
  // resume position seeds `useState` on first render, so the reader must not
  // exist before that position is known — otherwise every document would
  // reopen at sentence one.
  return <DocumentReader key={document.id} document={document} />;
}

function DocumentReader({ document }: { document: StudyDocument }) {
  const { data, updateDocument } = useAppData();
  const documentId = document.id;

  // Sentences are derived, never stored: one splitter owns the numbering, so a
  // saved resume index always means the same place in the text.
  const sentences = useMemo(() => toSentences(document.paragraphs), [document.paragraphs]);

  const [startIndex] = useState(() =>
    Math.min(document.lastSentenceIndex, Math.max(sentences.length - 1, 0)),
  );

  // Writing on every sentence would rewrite the whole document record several
  // times a minute. The position only needs to survive leaving the page.
  const pendingIndex = useRef(startIndex);
  const handleIndexChange = useCallback((index: number) => {
    pendingIndex.current = index;
  }, []);

  const reader = useSpeechReader({
    sentences,
    initialIndex: startIndex,
    onIndexChange: handleIndexChange,
  });

  useEffect(() => {
    const flush = () => updateDocument(documentId, { lastSentenceIndex: pendingIndex.current });
    const flushIfHiding = () => {
      if (window.document.visibilityState === "hidden") flush();
    };

    // Three chances to persist, because none of them is reliable alone.
    // Saving on every sentence would rewrite a multi-megabyte record several
    // times a minute; the interval keeps that cost bounded. Leaving the page
    // runs the cleanup below, but closing the tab does not — and by the time
    // `pagehide` fires there may not be enough time left for an IndexedDB
    // write to land, so `visibilitychange` (which fires earlier) does the
    // real work on mobile.
    const timer = window.setInterval(flush, 5_000);
    window.document.addEventListener("visibilitychange", flushIfHiding);
    window.addEventListener("pagehide", flush);

    return () => {
      window.clearInterval(timer);
      window.document.removeEventListener("visibilitychange", flushIfHiding);
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [documentId, updateDocument]);

  const course = data.courses.find((item) => item.id === document.courseId) ?? null;
  const [renaming, setRenaming] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");

  return (
    <div className="space-y-8">
      <nav aria-label="Breadcrumb" className="text-sm text-[var(--color-ink-muted)]">
        <Link href="/reader" className="underline underline-offset-4">
          Library
        </Link>
        <span aria-hidden="true"> / </span>
        <span>{document.title}</span>
      </nav>

      <header className="space-y-2">
        {renaming ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const next = draftTitle.trim();
              if (next) updateDocument(document.id, { title: next });
              setRenaming(false);
            }}
            className="flex flex-wrap gap-3"
          >
            <label htmlFor="document-title" className="sr-only">
              Document title
            </label>
            <input
              id="document-title"
              autoFocus
              value={draftTitle}
              onChange={(event) => setDraftTitle(event.target.value)}
              className={cn("flex-1 text-lg", controlClass())}
            />
            <button
              type="submit"
              className="min-h-11 rounded-xl bg-[var(--color-accent)] px-4 text-sm font-medium text-white"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setRenaming(false)}
              className="min-h-11 rounded-xl px-4 text-sm text-[var(--color-ink-muted)]"
            >
              Cancel
            </button>
          </form>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-2xl font-semibold tracking-tight">{document.title}</h2>
            <button
              type="button"
              onClick={() => {
                setDraftTitle(document.title);
                setRenaming(true);
              }}
              className="rounded-lg px-2 py-1 text-sm text-[var(--color-ink-muted)] underline underline-offset-4 transition hover:text-[var(--color-ink)]"
            >
              Rename
            </button>
          </div>
        )}

        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-[var(--color-ink-muted)]">
          {course ? (
            <Link
              href={`/courses/${course.id}`}
              className={cn(
                "rounded-md px-2 py-0.5 text-xs font-medium",
                COURSE_COLORS[course.color].chip,
              )}
            >
              {course.code || course.name}
            </Link>
          ) : (
            <span className="rounded-md bg-[var(--color-surface-muted)] px-2 py-0.5 text-xs font-medium">
              Unfiled
            </span>
          )}
          <span>{document.fileName}</span>
          <span>~{estimateMinutes(document.paragraphs)} min</span>
          <span>
            {sentences.length} {sentences.length === 1 ? "sentence" : "sentences"}
          </span>
        </p>
      </header>

      {/* Controls stay put while the text scrolls: hunting for pause is the
          last thing someone needs when they have lost the thread. */}
      <div className="sticky top-16 z-20 lg:top-20">
        <ReaderControls reader={reader} totalSentences={sentences.length} />
      </div>

      <ReaderPane
        sentences={sentences}
        activeIndex={reader.index}
        charIndex={reader.charIndex}
        speaking={reader.status === "playing"}
        onSelectSentence={(index) => reader.jumpTo(index)}
      />
    </div>
  );
}
