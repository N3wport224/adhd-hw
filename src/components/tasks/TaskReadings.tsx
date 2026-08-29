"use client";

import { useState } from "react";
import Link from "next/link";
import { useAppData } from "@/lib/appData";
import type { Task } from "@/types";

/**
 * The readings this task actually needs.
 *
 * "Read Chapter 4" and Chapter 4 were strangers: getting from one to the
 * other meant leaving the task, going to the library, finding the file and
 * remembering what you were doing. Every hop is somewhere to fall off, and
 * falling off at the last one — with the work in front of you — is the most
 * expensive place to do it.
 */
export function TaskReadings({ task }: { task: Task }) {
  const { data, updateTask } = useAppData();
  const [picking, setPicking] = useState(false);

  const attached = (task.documentIds ?? [])
    .map((id) => data.documents.find((document) => document.id === id))
    .filter((document) => document !== undefined);

  // Only what belongs to this course, or is unfiled. Offering the whole
  // library makes choosing the work.
  const offerable = data.documents.filter(
    (document) =>
      !(task.documentIds ?? []).includes(document.id) &&
      (document.courseId === task.courseId || document.courseId === null),
  );

  function attach(id: string) {
    updateTask(task.id, { documentIds: [...(task.documentIds ?? []), id] });
    setPicking(false);
  }

  if (attached.length === 0 && !picking) {
    return offerable.length === 0 ? null : (
      <button
        type="button"
        onClick={() => setPicking(true)}
        className="text-sm text-[var(--color-ink-muted)] underline underline-offset-4 transition hover:text-[var(--color-ink)]"
      >
        Attach a reading
      </button>
    );
  }

  return (
    <div className="space-y-2">
      {attached.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {attached.map((document) => (
            <li key={document.id} className="flex items-center">
              <Link
                href={`/reader/${document.id}`}
                className="min-h-9 rounded-l-lg bg-[var(--color-surface-muted)] px-3 py-1.5 text-sm transition hover:brightness-95"
              >
                {document.title}
              </Link>
              <button
                type="button"
                onClick={() =>
                  updateTask(task.id, {
                    documentIds: (task.documentIds ?? []).filter((id) => id !== document.id),
                  })
                }
                aria-label={`Detach ${document.title} from ${task.title}`}
                className="min-h-9 rounded-r-lg bg-[var(--color-surface-muted)] px-2 py-1.5 text-sm text-[var(--color-ink-muted)] transition hover:text-[var(--color-ink)] hover:brightness-95"
              >
                <span aria-hidden="true">×</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {picking ? (
        <div className="space-y-1">
          <p className="text-sm text-[var(--color-ink-muted)]">Which reading?</p>
          <ul className="flex flex-wrap gap-2">
            {offerable.map((document) => (
              <li key={document.id}>
                <button
                  type="button"
                  onClick={() => attach(document.id)}
                  className="min-h-9 rounded-lg border border-[var(--color-border-soft)] px-3 text-sm transition hover:bg-[var(--color-surface-muted)]"
                >
                  {document.title}
                </button>
              </li>
            ))}
            <li>
              <button
                type="button"
                onClick={() => setPicking(false)}
                className="min-h-9 rounded-lg px-3 text-sm text-[var(--color-ink-muted)] transition hover:bg-[var(--color-surface-muted)]"
              >
                Never mind
              </button>
            </li>
          </ul>
        </div>
      ) : offerable.length > 0 ? (
        <button
          type="button"
          onClick={() => setPicking(true)}
          className="text-sm text-[var(--color-ink-muted)] underline underline-offset-4 transition hover:text-[var(--color-ink)]"
        >
          Attach another
        </button>
      ) : null}
    </div>
  );
}
