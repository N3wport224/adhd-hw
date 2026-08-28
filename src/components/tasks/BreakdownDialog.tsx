"use client";

import { useState } from "react";
import { useAppData } from "@/lib/appData";
import { BREAKDOWN_TEMPLATES, suggestSteps, templateForTitle } from "@/lib/taskBreakdown";
import { createId, cn } from "@/lib/utils";
import { Dialog } from "@/components/ui/Dialog";
import {
  DEFAULT_PLAN,
  PlanAcrossDays,
  planDaysFor,
  type PlanSettings,
} from "@/components/tasks/PlanAcrossDays";
import { dayKeyOf } from "@/lib/schedule";
import { controlClass } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import type { Task } from "@/types";

interface BreakdownDialogProps {
  open: boolean;
  task: Task | null;
  onClose(): void;
}

export function BreakdownDialog({ open, task, onClose }: BreakdownDialogProps) {
  return (
    <Dialog
      open={open && task !== null}
      title="Break this into steps"
      description="A starting point, not a plan. Uncheck what does not apply and edit the rest."
      onClose={onClose}
    >
      {task ? <BreakdownForm key={task.id} task={task} onClose={onClose} /> : null}
    </Dialog>
  );
}

function BreakdownForm({ task, onClose }: { task: Task; onClose(): void }) {
  const { setSubtasks } = useAppData();
  const matched = templateForTitle(task.title);
  const [templateId, setTemplateId] = useState(matched?.id ?? "");
  const [steps, setSteps] = useState<string[]>(() => suggestSteps(task.title));
  const [chosen, setChosen] = useState<boolean[]>(() => suggestSteps(task.title).map(() => true));
  // The settings live here, and the days are worked out from them at the
  // moment the steps are written — so nothing has to be reported upward.
  const [plan, setPlan] = useState<PlanSettings>(DEFAULT_PLAN);

  function applyTemplate(id: string) {
    setTemplateId(id);
    const next = id
      ? (BREAKDOWN_TEMPLATES.find((template) => template.id === id)?.steps ?? [])
      : suggestSteps(task.title);
    setSteps(next);
    setChosen(next.map(() => true));
  }

  function handleApply() {
    const titles = steps
      .map((title, position) => ({ title: title.trim(), keep: chosen[position] }))
      .filter((step) => step.keep && step.title.length > 0);

    const plannedDays = planDaysFor(titles.length, task.dueAt ? dayKeyOf(task.dueAt) : null, plan);

    const kept = titles
      .map((step, position) => ({
        id: createId(),
        title: step.title,
        done: false,
        estimatedMinutes: null,
        plannedFor: plannedDays?.[position] ?? null,
      }));

    // Added to whatever is already there — someone who has half a plan
    // written should not lose it by asking for suggestions.
    setSubtasks(task.id, [...task.subtasks, ...kept]);
    onClose();
  }

  const keptCount = chosen.filter(Boolean).length;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <label htmlFor="breakdown-template" className="block text-sm font-medium">
          Kind of assignment
        </label>
        <select
          id="breakdown-template"
          value={templateId}
          onChange={(event) => applyTemplate(event.target.value)}
          className={cn("w-full", controlClass())}
        >
          <option value="">General</option>
          {BREAKDOWN_TEMPLATES.map((template) => (
            <option key={template.id} value={template.id}>
              {template.label}
            </option>
          ))}
        </select>
        {matched ? (
          <p className="text-sm text-[var(--color-ink-muted)]">
            Matched “{matched.label}” from the title. Change it if that is wrong.
          </p>
        ) : null}
      </div>

      <ul className="space-y-2">
        {steps.map((step, position) => (
          <li key={position} className="flex items-start gap-3">
            <input
              type="checkbox"
              id={`step-${position}`}
              checked={chosen[position]}
              onChange={() =>
                setChosen((current) =>
                  current.map((value, i) => (i === position ? !value : value)),
                )
              }
              className="mt-3 size-5 shrink-0 accent-[var(--color-accent)]"
            />
            <label htmlFor={`step-${position}`} className="sr-only">
              Include step {position + 1}
            </label>
            <input
              value={step}
              onChange={(event) =>
                setSteps((current) =>
                  current.map((value, i) => (i === position ? event.target.value : value)),
                )
              }
              aria-label={`Step ${position + 1}`}
              className={cn(
                "min-h-11 flex-1 rounded-xl border border-[var(--color-border-soft)] px-3 text-sm transition",
                chosen[position]
                  ? "bg-[var(--color-surface)]"
                  : "bg-[var(--color-surface-muted)] text-[var(--color-ink-muted)] line-through",
              )}
            />
          </li>
        ))}
      </ul>

      {keptCount > 0 ? (
        <PlanAcrossDays
          stepCount={keptCount}
          due={task.dueAt ? dayKeyOf(task.dueAt) : null}
          settings={plan}
          onChange={setPlan}
        />
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button variant="primary" onClick={handleApply} disabled={keptCount === 0}>
          Add {keptCount} {keptCount === 1 ? "step" : "steps"}
        </Button>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
