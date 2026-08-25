"use client";

import { useState } from "react";
import { useAppData } from "@/lib/appData";
import { createId, cn } from "@/lib/utils";
import type { Task } from "@/types";

export function SubtaskList({ task }: { task: Task }) {
  const { toggleSubtask, setSubtasks } = useAppData();
  const [newStep, setNewStep] = useState("");
  const [justCompleted, setJustCompleted] = useState<string | null>(null);

  const doneCount = task.subtasks.filter((step) => step.done).length;
  // The first unfinished step is the only one that needs emphasis; the rest
  // are context. This is the whole idea of the app in miniature.
  const nextStepId = task.subtasks.find((step) => !step.done)?.id ?? null;

  function handleToggle(id: string, done: boolean) {
    if (!done) {
      setJustCompleted(id);
      window.setTimeout(() => setJustCompleted(null), 400);
    }
    toggleSubtask(task.id, id);
  }

  function handleAdd(event: React.FormEvent) {
    event.preventDefault();
    const title = newStep.trim();
    if (!title) return;
    setSubtasks(task.id, [
      ...task.subtasks,
      { id: createId(), title, done: false, estimatedMinutes: null },
    ]);
    setNewStep("");
  }

  return (
    <div className="space-y-4">
      {task.subtasks.length > 0 ? (
        <>
          <div className="flex items-center gap-3">
            <div
              role="progressbar"
              aria-label={`${doneCount} of ${task.subtasks.length} steps done`}
              aria-valuemin={0}
              aria-valuemax={task.subtasks.length}
              aria-valuenow={doneCount}
              className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--color-surface-muted)]"
            >
              <div
                className="h-full rounded-full bg-[var(--color-accent)] transition-[width] duration-300"
                style={{ width: `${(doneCount / task.subtasks.length) * 100}%` }}
              />
            </div>
            <span className="text-sm text-[var(--color-ink-muted)]">
              {doneCount}/{task.subtasks.length}
            </span>
          </div>

          <ul className="space-y-1">
            {task.subtasks.map((step) => (
              <li key={step.id}>
                <div
                  className={cn(
                    "flex items-start gap-3 rounded-xl px-3 py-2 transition",
                    step.id === nextStepId && "bg-[var(--color-accent-wash)]",
                  )}
                >
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={step.done}
                    onClick={() => handleToggle(step.id, step.done)}
                    className={cn(
                      "mt-0.5 grid size-6 shrink-0 place-items-center rounded-md border-2 transition",
                      step.done
                        ? "border-[var(--color-accent)] bg-[var(--color-accent)] text-white"
                        : "border-[var(--color-border-soft)] hover:border-[var(--color-focus)]",
                    )}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={3.5}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                      className={cn(
                        "size-3.5 transition-opacity",
                        step.done ? "opacity-100" : "opacity-0",
                        justCompleted === step.id && "animate-check-pop",
                      )}
                    >
                      <path d="m5 12.5 4.5 4.5L19 7" />
                    </svg>
                    <span className="sr-only">
                      {step.done ? "Mark step as not done" : "Mark step as done"}: {step.title}
                    </span>
                  </button>

                  <span
                    className={cn(
                      "flex-1 text-sm",
                      step.done && "text-[var(--color-ink-muted)] line-through",
                      step.id === nextStepId && "font-medium",
                    )}
                  >
                    {step.title}
                  </span>

                  <button
                    type="button"
                    onClick={() =>
                      setSubtasks(
                        task.id,
                        task.subtasks.filter((item) => item.id !== step.id),
                      )
                    }
                    aria-label={`Remove step: ${step.title}`}
                    className="grid size-7 shrink-0 place-items-center rounded-md text-[var(--color-ink-muted)] opacity-50 transition hover:bg-[var(--color-surface-muted)] hover:opacity-100 focus-visible:opacity-100"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.8}
                      strokeLinecap="round"
                      aria-hidden="true"
                      className="size-3.5"
                    >
                      <path d="m6 6 12 12M18 6 6 18" />
                    </svg>
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      <form onSubmit={handleAdd} className="flex gap-2">
        <label htmlFor={`add-step-${task.id}`} className="sr-only">
          Add a step to {task.title}
        </label>
        <input
          id={`add-step-${task.id}`}
          value={newStep}
          onChange={(event) => setNewStep(event.target.value)}
          placeholder="Add a step…"
          autoComplete="off"
          className="min-h-10 flex-1 rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-surface)] px-3 text-sm placeholder:text-[var(--color-ink-muted)]"
        />
        <button
          type="submit"
          disabled={!newStep.trim()}
          className="min-h-10 rounded-xl px-3 text-sm font-medium text-[var(--color-accent)] transition hover:bg-[var(--color-surface-muted)] disabled:opacity-40"
        >
          Add
        </button>
      </form>
    </div>
  );
}
