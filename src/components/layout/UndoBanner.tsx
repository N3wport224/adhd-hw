"use client";

import { useAppData } from "@/lib/appData";

/**
 * One step back from whatever was just deleted.
 *
 * Deleting takes two taps and that is still not enough: two taps is a
 * question, and a question asked at the wrong moment gets answered yes. The
 * offer stays until the next change rather than fading after five seconds,
 * because the mistake is usually noticed at twenty — and since any other
 * change clears it, a stale offer cannot swallow newer work.
 */
export function UndoBanner() {
  const { undoable, undo, dismissUndo } = useAppData();
  if (!undoable) return null;

  return (
    <div
      role="status"
      className="animate-rise-fade flex flex-wrap items-center gap-3 border-b border-[var(--color-border-soft)] bg-[var(--color-accent-wash)] px-5 py-3 text-sm lg:px-10"
    >
      <span className="flex-1">{undoable.label}.</span>
      <button
        type="button"
        onClick={undo}
        className="min-h-9 rounded-lg bg-[var(--color-accent)] px-3 font-medium text-[var(--color-on-accent)] transition hover:brightness-95"
      >
        Undo
      </button>
      <button
        type="button"
        onClick={dismissUndo}
        className="min-h-9 rounded-lg px-3 text-[var(--color-ink-muted)] transition hover:bg-[var(--color-surface)] hover:text-[var(--color-ink)]"
      >
        Dismiss
      </button>
    </div>
  );
}
