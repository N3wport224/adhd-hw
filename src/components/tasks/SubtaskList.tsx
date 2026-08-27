"use client";

import { useState } from "react";
import { useAppData } from "@/lib/appData";
import { dayKeyOf, toDayKey } from "@/lib/schedule";
import { describePlan, planStepDays } from "@/lib/stepPlanner";
import { createId, cn } from "@/lib/utils";
import type { Task } from "@/types";

function describeDay(day: string) {
  const today = toDayKey(new Date());
  if (day === today) return "Today";
  const date = new Date(`${day}T00:00:00`);
  const diff = Math.round(
    (date.getTime() - new Date(`${today}T00:00:00`).getTime()) / 86_400_000,
  );
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  if (diff < 0) return `${Math.abs(diff)} days ago`;
  if (diff <= 6) return date.toLocaleDateString(undefined, { weekday: "long" });
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function SubtaskList({ task }: { task: Task }) {
  const { toggleSubtask, setSubtasks, setSubtaskDay } = useAppData();
  const [newStep, setNewStep] = useState("");
  const [justCompleted, setJustCompleted] = useState<string | null>(null);
  const [editingDay, setEditingDay] = useState<string | null>(null);

  const today = toDayKey(new Date());
  const unplanned = task.subtasks.filter((step) => !step.done && !step.plannedFor);

  /**
   * Spreads the steps that have no day across the days that are left. Offered
   * on tasks broken down before planning existed, and after adding a step by
   * hand — a step with no day never reaches the calendar.
   */
  function planRemaining() {
    const open = task.subtasks.filter((step) => !step.done);
    const summary = planStepDays(open.length, {
      from: today,
      due: task.dueAt ? dayKeyOf(task.dueAt) : null,
      perDay: 2,
    });
    let position = 0;
    setSubtasks(
      task.id,
      task.subtasks.map((step) =>
        step.done ? step : { ...step, plannedFor: summary.days[position++] ?? null },
      ),
    );
  }

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
      { id: createId(), title, done: false, estimatedMinutes: null, plannedFor: null },
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
                        ? "border-[var(--color-accent)] bg-[var(--color-accent)] text-[var(--color-on-accent)]"
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

                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        "block text-sm",
                        step.done && "text-[var(--color-ink-muted)] line-through",
                        step.id === nextStepId && "font-medium",
                      )}
                    >
                      {step.title}
                    </span>

                    {editingDay === step.id ? (
                      <input
                        type="date"
                        autoFocus
                        value={step.plannedFor ?? ""}
                        onChange={(event) =>
                          setSubtaskDay(task.id, step.id, event.target.value || null)
                        }
                        onBlur={() => setEditingDay(null)}
                        aria-label={`Day for ${step.title}`}
                        className="mt-1 rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-surface)] px-2 py-1 text-xs"
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => setEditingDay(step.id)}
                        className={cn(
                          "mt-0.5 rounded px-1 text-xs transition hover:bg-[var(--color-surface-muted)]",
                          step.done
                            ? "text-[var(--color-ink-muted)]"
                            : step.plannedFor === today
                              ? "font-medium text-[var(--color-accent)]"
                              : step.plannedFor && step.plannedFor < today
                                ? "text-[#a8503f] dark:text-[#e29b8b]"
                                : "text-[var(--color-ink-muted)]",
                        )}
                      >
                        {step.plannedFor ? describeDay(step.plannedFor) : "No day yet"}
                      </button>
                    )}
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

      {unplanned.length > 0 ? (
        <button
          type="button"
          onClick={planRemaining}
          className="w-full rounded-xl bg-[var(--color-accent-wash)] px-3 py-2 text-left text-sm font-medium text-[var(--color-accent)] transition hover:brightness-95"
        >
          Spread the {unplanned.length === task.subtasks.filter((s) => !s.done).length ? "" : "rest "}
          across days —{" "}
          <span className="font-normal">
            {describePlan(
              planStepDays(task.subtasks.filter((step) => !step.done).length, {
                from: today,
                due: task.dueAt ? dayKeyOf(task.dueAt) : null,
                perDay: 2,
              }),
            ).toLowerCase()}
          </span>
        </button>
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
