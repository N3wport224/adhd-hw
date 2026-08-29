"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppData } from "@/lib/appData";
import { KIND_LABELS, searchApp } from "@/lib/search";
import { registerPalette } from "@/lib/palette";
import { useFocusTrap } from "@/lib/useFocusTrap";
import { useLatestRef } from "@/lib/useLatestRef";
import { cn } from "@/lib/utils";

type Mode = "search" | "capture";

/**
 * One overlay, two jobs: find anything, or park a thought.
 *
 * Both were missing for the same reason — everything the app could do
 * required already being in the right place. Search meant remembering where a
 * thing lives; capture existed only inside a focus session, which is the one
 * place a stray thought is least likely to arrive.
 *
 * Capture writes an unfiled task with no due date on purpose. Asking which
 * course and when it is due, at the moment someone is trying to get a thought
 * out of their head before it goes, is how the thought gets lost.
 */
export function CommandPalette() {
  const { data, addTask } = useAppData();
  const router = useRouter();

  const [mode, setMode] = useState<Mode | null>(null);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [caught, setCaught] = useState<string | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLInputElement>(null);

  const results = useMemo(
    () => (mode === "search" ? searchApp(data, query) : []),
    [data, query, mode],
  );
  const resultsRef = useLatestRef(results);
  const activeRef = useLatestRef(active);

  const close = useCallback(() => {
    setMode(null);
    setQuery("");
    setActive(0);
  }, []);

  useFocusTrap(mode !== null, panel, close);

  const open = useCallback((next: Mode) => {
    setMode(next);
    setQuery("");
    setActive(0);
    setCaught(null);
    window.setTimeout(() => field.current?.focus(), 0);
  }, []);

  useEffect(() => registerPalette(open), [open]);

  // Keep the highlighted result on screen. With a dozen results, arrowing to
  // the last one otherwise moved a highlight nobody could see.
  useEffect(() => {
    const chosen = results[active];
    if (!chosen) return;
    document
      .getElementById(`result-${chosen.id}`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active, results]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing = !!target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName);

      // Never on top of another overlay: two focus traps fighting over Tab
      // is worse than having to close the first one.
      const overlaid = !!document.querySelector('[role="dialog"]');
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        if (overlaid) return;
        event.preventDefault();
        open("search");
        return;
      }
      // Bare C, and only when nothing else has a claim on it: not mid-typing,
      // and not while a session or dialog is open, where C already parks a
      // thought against the task in front of you.
      if (
        event.key === "c" &&
        !typing &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        !overlaid
      ) {
        event.preventDefault();
        open("capture");
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  // Arrow keys move the highlight; Enter takes it. Registered on the field so
  // it never competes with the page underneath.
  const onFieldKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (mode !== "search") return;
      const list = resultsRef.current;
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActive((current) => (list.length === 0 ? 0 : (current + 1) % list.length));
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setActive((current) => (list.length === 0 ? 0 : (current - 1 + list.length) % list.length));
      } else if (event.key === "Enter") {
        const chosen = list[activeRef.current];
        if (chosen) {
          event.preventDefault();
          router.push(chosen.href);
          close();
        }
      }
    },
    [mode, resultsRef, activeRef, router, close],
  );

  if (mode === null) {
    return caught ? (
      <p
        role="status"
        className="animate-rise-fade fixed bottom-4 left-1/2 z-40 -translate-x-1/2 rounded-xl bg-[var(--color-accent-wash)] px-4 py-3 text-sm shadow-lg"
      >
        Parked “{caught}” on Tasks. Back to it.
      </p>
    ) : null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[12vh]">
      <button
        type="button"
        tabIndex={-1}
        aria-label="Close"
        onClick={close}
        className="absolute inset-0 bg-black/35 backdrop-blur-[2px]"
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={mode === "search" ? "Search everything" : "Park a thought"}
        className="animate-rise-fade relative w-full max-w-xl overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border-soft)] bg-[var(--color-surface)] shadow-2xl"
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (mode !== "capture") return;
            const title = query.trim();
            if (title) {
              addTask({
                courseId: null,
                title,
                notes: "",
                dueAt: null,
                status: "todo",
                subtasks: [],
              });
              setCaught(title);
            }
            close();
          }}
        >
          <label htmlFor="palette-field" className="sr-only">
            {mode === "search" ? "Search courses, tasks, steps and readings" : "Something to deal with later"}
          </label>
          <input
            ref={field}
            id="palette-field"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(0);
            }}
            onKeyDown={onFieldKeyDown}
            autoComplete="off"
            // The standard combobox pattern: focus never leaves the field, and
            // the highlighted result is announced through aria-activedescendant.
            // Making each result its own tab stop meant Tab wandered through
            // twelve of them to reach anything else.
            {...(mode === "search"
              ? {
                  role: "combobox" as const,
                  "aria-expanded": results.length > 0,
                  "aria-controls": "palette-results",
                  "aria-autocomplete": "list" as const,
                  "aria-activedescendant": results[active] ? `result-${results[active].id}` : undefined,
                }
              : {})}
            placeholder={
              mode === "search" ? "Search everything…" : "Park it and carry on…"
            }
            // A visible ring even here: the app's rule is that every focus
            // stop shows one, and "the caret is enough" stops being true the
            // moment the field is empty.
            className="min-h-14 w-full border-b border-[var(--color-border-soft)] bg-transparent px-5 text-base outline-none focus:border-[var(--color-focus)] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-focus-ring)]"
          />
        </form>

        {mode === "capture" ? (
          <p className="px-5 py-4 text-sm text-[var(--color-ink-muted)]">
            Enter files it on Tasks with no course and no date. Sorting it out is a
            later job than getting it out of your head.
          </p>
        ) : query.trim() === "" ? (
          <p className="px-5 py-4 text-sm text-[var(--color-ink-muted)]">
            Courses, assignments, single steps and readings. Arrows to move, Enter
            to go.
          </p>
        ) : results.length === 0 ? (
          <p className="px-5 py-4 text-sm text-[var(--color-ink-muted)]">
            Nothing matches “{query.trim()}”.
          </p>
        ) : (
          <div
            role="listbox"
            id="palette-results"
            aria-label="Results"
            className="max-h-[45vh] overflow-y-auto py-2"
          >
            {results.map((result, index) => (
              <button
                key={result.id}
                id={`result-${result.id}`}
                type="button"
                role="option"
                aria-selected={index === active}
                // Not a tab stop: the field keeps focus and drives this with
                // the arrow keys, which is what aria-activedescendant is for.
                tabIndex={-1}
                onPointerEnter={() => setActive(index)}
                onClick={() => {
                  router.push(result.href);
                  close();
                }}
                className={cn(
                  "flex w-full items-baseline gap-3 px-5 py-2.5 text-left transition",
                  index === active && "bg-[var(--color-accent-wash)]",
                )}
              >
                <span className="min-w-0 flex-1 truncate">{result.title}</span>
                {result.context ? (
                  <span className="shrink-0 truncate text-sm text-[var(--color-ink-muted)]">
                    {result.context}
                  </span>
                ) : null}
                <span className="shrink-0 text-xs uppercase tracking-wider text-[var(--color-ink-muted)]">
                  {KIND_LABELS[result.kind]}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
