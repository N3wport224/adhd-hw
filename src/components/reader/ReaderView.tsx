"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLatestRef } from "@/lib/useLatestRef";
import Link from "next/link";
import { documentBlocks, useAppData, useDocument } from "@/lib/appData";
import { COURSE_COLORS } from "@/lib/courseStyles";
import { estimateMinutes, toSentences, type Sentence } from "@/lib/documents/sentences";
import { useSpeechReader } from "@/lib/speech";
import { useReaderSettings } from "@/lib/readerSettings";
import { ReaderSettingsPanel } from "@/components/reader/ReaderSettingsPanel";
import { cn, createId } from "@/lib/utils";
import { LinkButton } from "@/components/ui/Button";
import { controlClass } from "@/components/ui/Field";
import { EmptyState } from "@/components/ui/EmptyState";
import { ReaderControls } from "@/components/reader/ReaderControls";
import { KeepNoteDialog } from "@/components/reader/KeepNoteDialog";
import { ReaderPane } from "@/components/reader/ReaderPane";
import type { DocumentNote, StudyDocument } from "@/types";

export interface ReaderSection {
  title: string;
  level: number;
  /** The sentence the section begins at, so jumping to it starts playback there. */
  sentenceIndex: number;
  /** The heading's own block, which is unique where a sentence index may not be. */
  blockIndex: number;
}

/**
 * A collapsed table of contents.
 *
 * Long readings are where losing your place hurts most, and scrolling back to
 * find a heading means reading everything in between. It starts closed so it
 * costs nothing on a document nobody wants to navigate.
 */
function DocumentOutline({
  sections,
  reader,
}: {
  sections: ReaderSection[];
  reader: ReturnType<typeof useSpeechReader>;
}) {
  const [open, setOpen] = useState(false);
  const current = [...sections]
    .reverse()
    .find((section) => section.sentenceIndex <= reader.index);

  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--color-border-soft)] bg-[var(--color-surface)]">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex min-h-12 w-full items-center gap-2 px-4 text-left text-sm"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className={cn(
            "size-4 text-[var(--color-ink-muted)] transition-transform",
            open ? "rotate-0" : "-rotate-90",
          )}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
        <span className="font-medium">Sections</span>
        <span className="truncate text-[var(--color-ink-muted)]">
          {current ? current.title : `${sections.length} in this document`}
        </span>
      </button>

      {open ? (
        <ul className="space-y-0.5 border-t border-[var(--color-border-soft)] p-2">
          {sections.map((section) => (
            <li key={section.blockIndex}>
              <button
                type="button"
                onClick={() => reader.jumpTo(section.sentenceIndex)}
                className={cn(
                  "block w-full truncate rounded-lg px-3 py-2 text-left text-sm transition",
                  section.level === 1 ? "font-medium" : "",
                  section.level === 3 ? "pl-8" : section.level === 2 ? "pl-5" : "",
                  current?.sentenceIndex === section.sentenceIndex
                    ? "bg-[var(--color-accent-soft)]"
                    : "hover:bg-[var(--color-surface-muted)]",
                )}
              >
                {section.title}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

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
  // A sentence on its way to becoming a note.
  const [keeping, setKeeping] = useState<Sentence | null>(null);
  const keptIndices = useMemo(
    () => new Set((document.notes ?? []).map((note) => note.sentenceIndex)),
    [document.notes],
  );
  const documentId = document.id;

  // Sentences are derived, never stored: one splitter owns the numbering, so a
  // saved resume index always means the same place in the text.
  const blocks = useMemo(() => documentBlocks(document), [document]);
  // Sentences are numbered per block, so `paragraphIndex` on each sentence is
  // the index of the block it belongs to — which is what lets the pane render
  // each group with its own structure.
  const sentences = useMemo(
    () => toSentences(blocks.map((block) => block.text)),
    [blocks],
  );

  /**
   * Where each heading starts, for the outline and the section controls.
   *
   * A heading no sentence was derived from is dropped rather than defaulted
   * to zero: sending every unplaceable heading to sentence 0 makes them
   * duplicates of each other in the list, and clicking one jumps silently to
   * the top of the document instead of to the section it names.
   */
  const sections = useMemo(
    () =>
      blocks
        .map((block, index) => ({ block, index }))
        .filter((entry) => entry.block.kind === "heading")
        .map((entry) => ({
          title: entry.block.text,
          level: entry.block.level ?? 3,
          blockIndex: entry.index,
          sentenceIndex: sentences.find((s) => s.paragraphIndex === entry.index)?.index,
        }))
        .filter((section) => section.sentenceIndex !== undefined)
        .map((section) => ({ ...section, sentenceIndex: section.sentenceIndex as number })),
    [blocks, sentences],
  );

  const [startIndex] = useState(() =>
    Math.min(document.lastSentenceIndex, Math.max(sentences.length - 1, 0)),
  );

  // Writing on every sentence would rewrite the whole document record several
  // times a minute. The position only needs to survive leaving the page.
  const pendingIndex = useRef(startIndex);
  const handleIndexChange = useCallback((index: number) => {
    pendingIndex.current = index;
  }, []);

  /**
   * A beat of silence before each heading, so sections are audible and not
   * only visible. Kept short — long enough to hear as a break, short enough
   * that it never feels like the reader has stopped working.
   */
  const pauseBefore = useCallback(
    (index: number) => {
      const sentence = sentences[index];
      if (!sentence || sentence.index === 0) return 0;
      const block = blocks[sentence.paragraphIndex];
      if (block?.kind !== "heading") return 0;
      // Only at the start of the heading, not between its own sentences.
      const previous = sentences[index - 1];
      return previous?.paragraphIndex === sentence.paragraphIndex ? 0 : 450;
    },
    [blocks, sentences],
  );

  const reader = useSpeechReader({
    sentences,
    initialIndex: startIndex,
    onIndexChange: handleIndexChange,
    pauseBefore,
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

  // Read through refs so the key handler is bound once rather than rebuilt on
  // every sentence — re-registering a listener sixty times a minute is how
  // keystrokes go missing.
  const readerRef = useLatestRef(reader);
  const jumpSection = useCallback(
    (direction: number) => {
      const ordered = direction > 0 ? sections : [...sections].reverse();
      const next = ordered.find((section) =>
        direction > 0
          ? section.sentenceIndex > reader.index
          : section.sentenceIndex < reader.index,
      );
      if (next) reader.jumpTo(next.sentenceIndex);
      else if (direction < 0) reader.jumpTo(0);
    },
    [sections, reader],
  );
  const jumpSectionRef = useLatestRef(jumpSection);

  const course = data.courses.find((item) => item.id === document.courseId) ?? null;
  const [renaming, setRenaming] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { settings, update, reset } = useReaderSettings();

  /**
   * Keyboard control of playback.
   *
   * Listening to a long reading means having both hands free and the page
   * scrolled well away from the controls; reaching for the mouse to pause is
   * exactly the interruption this view is meant to avoid. Typing anywhere —
   * renaming the document, say — hands the keys back.
   */
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      switch (event.key) {
        case " ":
          event.preventDefault();
          if (readerRef.current.status === "playing") readerRef.current.pause();
          else readerRef.current.play();
          break;
        case "ArrowRight":
          event.preventDefault();
          if (event.shiftKey) jumpSectionRef.current(1);
          else readerRef.current.skip(1);
          break;
        case "ArrowLeft":
          event.preventDefault();
          if (event.shiftKey) jumpSectionRef.current(-1);
          else readerRef.current.skip(-1);
          break;
        case "Escape":
          readerRef.current.stop();
          break;
        default:
          break;
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [readerRef, jumpSectionRef]);

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
              className="min-h-11 rounded-xl bg-[var(--color-accent)] px-4 text-sm font-medium text-[var(--color-on-accent)]"
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
        <ReaderControls
          reader={reader}
          totalSentences={sentences.length}
          sections={sections}
          settingsOpen={settingsOpen}
          onToggleSettings={() => setSettingsOpen((open) => !open)}
          settingsPanel={
            <ReaderSettingsPanel settings={settings} onChange={update} onReset={reset} />
          }
        />
      </div>

      {sections.length > 1 ? <DocumentOutline sections={sections} reader={reader} /> : null}

      <ReaderPane
        blocks={blocks}
        sentences={sentences}
        activeIndex={reader.index}
        charIndex={reader.charIndex}
        speaking={reader.status === "playing"}
        onSelectSentence={(index) => reader.jumpTo(index)}
        onKeep={(sentence) => setKeeping(sentence)}
        kept={keptIndices}
        settings={settings}
      />

      {(document.notes ?? []).length > 0 ? (
        <section className="mx-auto mb-8 w-full max-w-3xl space-y-3 rounded-[var(--radius-card)] border border-[var(--color-border-soft)] bg-[var(--color-surface)] p-5">
          <h2 className="text-base font-semibold">
            Kept from this reading ({(document.notes ?? []).length})
          </h2>
          <ul className="space-y-3">
            {(document.notes ?? []).map((note) => (
              <li key={note.id} className="flex items-start gap-3 text-sm">
                <button
                  type="button"
                  onClick={() => reader.jumpTo(note.sentenceIndex)}
                  className="min-w-0 flex-1 rounded-lg px-2 py-1 text-left transition hover:bg-[var(--color-surface-muted)]"
                >
                  <span className="block border-l-2 border-[var(--color-accent)] pl-2 text-[var(--color-ink-muted)]">
                    {note.quote}
                  </span>
                  {note.comment ? <span className="mt-1 block">{note.comment}</span> : null}
                </button>
                <button
                  type="button"
                  aria-label={`Remove note: ${note.quote.slice(0, 40)}`}
                  onClick={() =>
                    updateDocument(document.id, {
                      notes: (document.notes ?? []).filter((item) => item.id !== note.id),
                    })
                  }
                  className="shrink-0 rounded-lg px-2 py-1 text-xs text-[var(--color-ink-muted)] transition hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-ink)]"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <KeepNoteDialog
        open={keeping !== null}
        sentence={keeping}
        onClose={() => setKeeping(null)}
        onSave={(comment) => {
          if (!keeping) return;
          const note: DocumentNote = {
            id: createId(),
            sentenceIndex: keeping.index,
            quote: keeping.text,
            comment,
            createdAt: new Date().toISOString(),
          };
          updateDocument(document.id, { notes: [...(document.notes ?? []), note] });
          setKeeping(null);
        }}
      />
    </div>
  );
}
