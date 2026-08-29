"use client";

import { useMemo, useState } from "react";
import { useAppData } from "@/lib/appData";
import { revisionSteps } from "@/lib/examPlan";
import { toDayKey } from "@/lib/schedule";
import { Button } from "@/components/ui/Button";
import { ChoiceGroup } from "@/components/ui/ChoiceGroup";
import { Dialog } from "@/components/ui/Dialog";
import { cn } from "@/lib/utils";
import type { Task } from "@/types";

const SESSION_CHOICES = ["2", "3", "4", "5"];

/**
 * Sittings before an exam, on days that have not happened yet.
 *
 * Shown before anything is written, like every other import in this app: a
 * plan you did not agree to is a plan you will ignore.
 */
export function RevisionDialog({
  open,
  task,
  onClose,
}: {
  open: boolean;
  task: Task | null;
  onClose(): void;
}) {
  const { data, setSubtasks } = useAppData();
  const [sessions, setSessions] = useState("3");

  const today = toDayKey(new Date());
  const steps = useMemo(
    () =>
      task === null
        ? []
        : revisionSteps(task, {
            sessions: Number(sessions),
            from: today,
            courses: data.courses,
          }),
    [task, sessions, today, data.courses],
  );

  if (task === null) return null;

  return (
    <Dialog
      open={open}
      title={`Plan the run-up to ${task.title}`}
      description="Nothing is handed in for an exam, so nothing makes the work happen early. These are the evenings it happens on."
      onClose={onClose}
    >
      <div className="space-y-6">
        <ChoiceGroup
          label="How many sittings"
          choices={SESSION_CHOICES.map((value) => ({ value, label: value }))}
          value={sessions}
          onSelect={setSessions}
          className="flex flex-wrap gap-1"
          optionClassName={(selected) =>
            cn(
              "min-h-9 w-11 rounded-lg text-sm font-medium tabular-nums transition",
              selected
                ? "bg-[var(--color-accent)] text-[var(--color-on-accent)]"
                : "text-[var(--color-ink-muted)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-ink)]",
            )
          }
        />

        {steps.length === 0 ? (
          <p className="text-sm text-[var(--color-ink-muted)]">
            There are no days left before this one. A run-up needs somewhere to
            run up from — if the exam has moved, change its date first.
          </p>
        ) : (
          <ul className="space-y-2">
            {steps.map((step) => (
              <li
                key={step.id}
                className="flex flex-wrap items-baseline justify-between gap-x-3 rounded-xl bg-[var(--color-surface-muted)] px-3 py-2 text-sm"
              >
                <span>{step.title}</span>
                <span className="text-[var(--color-ink-muted)]">
                  {new Date(`${step.plannedFor}T00:00:00`).toLocaleDateString(undefined, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              </li>
            ))}
          </ul>
        )}

        <p className="text-sm text-[var(--color-ink-muted)]">
          Class nights are avoided while there are other evenings to use.
          {task.subtasks.length > 0
            ? " These are added to the steps this task already has."
            : ""}
        </p>

        <div className="flex flex-wrap gap-3">
          <Button
            variant="primary"
            disabled={steps.length === 0}
            onClick={() => {
              setSubtasks(task.id, [...task.subtasks, ...steps]);
              onClose();
            }}
          >
            Add {steps.length} {steps.length === 1 ? "sitting" : "sittings"}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Not now
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
