"use client";

import { useState } from "react";
import { useAppData } from "@/lib/appData";
import { controlClass } from "@/components/ui/Field";
import type { Task } from "@/types";

/**
 * What it came back marked.
 *
 * Two numbers rather than a percentage, because that is what a marked paper
 * actually says — and because "17 out of 20" survives a rubric changing its
 * total in a way "85%" does not.
 *
 * Only offered on finished work. Asking for a score on something not handed
 * in yet is a field that sits there empty being a small reproach.
 */
export function ScoreField({ task }: { task: Task }) {
  const { updateTask } = useAppData();
  const [open, setOpen] = useState(false);

  const score = task.score ?? null;

  if (score && !open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md bg-[var(--color-accent-wash)] px-2 py-0.5 text-xs font-medium tabular-nums transition hover:brightness-95"
      >
        {score.earned}/{score.outOf}
        {score.outOf > 0 ? ` · ${Math.round((score.earned / score.outOf) * 100)}%` : ""}
      </button>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-[var(--color-ink-muted)] underline underline-offset-4 transition hover:text-[var(--color-ink)]"
      >
        Add a score
      </button>
    );
  }

  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const earned = Number(form.get("earned"));
        const outOf = Number(form.get("outOf"));
        updateTask(task.id, {
          score: Number.isFinite(earned) && outOf > 0 ? { earned, outOf } : null,
        });
        setOpen(false);
      }}
    >
      <label htmlFor={`earned-${task.id}`} className="sr-only">
        Marks earned on {task.title}
      </label>
      <input
        id={`earned-${task.id}`}
        name="earned"
        type="number"
        step="any"
        min={0}
        autoFocus
        defaultValue={score?.earned ?? ""}
        placeholder="17"
        className={`w-20 ${controlClass("sm")}`}
      />
      <span aria-hidden="true" className="text-sm text-[var(--color-ink-muted)]">
        out of
      </span>
      <label htmlFor={`outof-${task.id}`} className="sr-only">
        Marks available on {task.title}
      </label>
      <input
        id={`outof-${task.id}`}
        name="outOf"
        type="number"
        step="any"
        min={0}
        defaultValue={score?.outOf ?? ""}
        placeholder="20"
        className={`w-20 ${controlClass("sm")}`}
      />
      <button
        type="submit"
        className="min-h-9 rounded-lg bg-[var(--color-accent-wash)] px-3 text-sm font-medium text-[var(--color-accent)] transition hover:brightness-95"
      >
        Save
      </button>
      {score ? (
        <button
          type="button"
          onClick={() => {
            updateTask(task.id, { score: null });
            setOpen(false);
          }}
          className="min-h-9 rounded-lg px-2 text-sm text-[var(--color-ink-muted)] transition hover:bg-[var(--color-surface-muted)]"
        >
          Clear
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="min-h-9 rounded-lg px-2 text-sm text-[var(--color-ink-muted)] transition hover:bg-[var(--color-surface-muted)]"
        >
          Cancel
        </button>
      )}
    </form>
  );
}
