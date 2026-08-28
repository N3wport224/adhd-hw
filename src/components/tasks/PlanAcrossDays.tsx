"use client";

import { useMemo } from "react";
import { describePlan, planStepDays } from "@/lib/stepPlanner";
import { toDayKey } from "@/lib/schedule";
import { ChoiceGroup } from "@/components/ui/ChoiceGroup";
import { cn } from "@/lib/utils";

/** What the student has chosen; the days themselves are derived from it. */
export interface PlanSettings {
  on: boolean;
  perDay: number;
  skipWeekends: boolean;
}

/** Switched on by default — a deadline makes a plan obviously useful. */
export const DEFAULT_PLAN: PlanSettings = { on: true, perDay: 2, skipWeekends: false };

/**
 * One day per step, or null when the plan is switched off.
 *
 * Exported so the form that submits the steps works out the days itself at
 * the moment it needs them. The control below used to report them upward as
 * it rendered, which meant a child setting state on its parent mid-render —
 * React warns about exactly that, because the update can be dropped.
 */
export function planDaysFor(
  stepCount: number,
  due: string | null,
  settings: PlanSettings,
): string[] | null {
  if (!settings.on) return null;
  return planStepDays(stepCount, {
    from: toDayKey(new Date()),
    due,
    perDay: settings.perDay,
    skipWeekends: settings.skipWeekends,
  }).days;
}

interface PlanAcrossDaysProps {
  /** How many steps are being planned. */
  stepCount: number;
  /** The task's deadline as a local day, or null. */
  due: string | null;
  settings: PlanSettings;
  onChange(next: PlanSettings): void;
}

const PACES = [1, 2, 3] as const;

/**
 * Spreads steps over the days before a deadline.
 *
 * A deadline says when work is due and nothing about when to start, which is
 * exactly how a week of runway becomes one bad Thursday night. This is the
 * control that turns "four chapters by Friday" into something that shows up
 * on a Tuesday.
 */
export function PlanAcrossDays({ stepCount, due, settings, onChange }: PlanAcrossDaysProps) {
  const { on: enabled, perDay, skipWeekends } = settings;

  const summary = useMemo(
    () =>
      planStepDays(stepCount, {
        from: toDayKey(new Date()),
        due,
        perDay,
        skipWeekends,
      }),
    [stepCount, due, perDay, skipWeekends],
  );

  const lastDay = summary.days.at(-1);

  return (
    <div className="space-y-3 rounded-xl bg-[var(--color-surface-muted)] p-4">
      <label className="flex items-start gap-3 text-sm font-medium">
        <input
          type="checkbox"
          checked={enabled}
          onChange={() => onChange({ ...settings, on: !enabled })}
          className="mt-0.5 size-4 accent-[var(--color-accent)]"
        />
        <span>
          Spread these across the days{due ? " before it is due" : " ahead"}
          <span className="block font-normal text-[var(--color-ink-muted)]">
            Each step gets its own day, so a little of it lands on today.
          </span>
        </span>
      </label>

      {enabled ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-[var(--color-ink-muted)]">About</span>
            <ChoiceGroup
              label="Steps a day"
              choices={PACES.map((pace) => ({ value: String(pace), label: String(pace) }))}
              value={String(perDay)}
              onSelect={(next) => onChange({ ...settings, perDay: Number(next) })}
              className="flex gap-2"
              optionClassName={(selected) =>
                cn(
                  "min-h-9 rounded-lg px-3 text-sm font-medium transition",
                  selected
                    ? "bg-[var(--color-accent)] text-[var(--color-on-accent)]"
                    : "text-[var(--color-ink-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-ink)]",
                )
              }
            />
            <span className="text-sm text-[var(--color-ink-muted)]">a day</span>

            <label className="ml-auto flex items-center gap-2 text-sm text-[var(--color-ink-muted)]">
              <input
                type="checkbox"
                checked={skipWeekends}
                onChange={() => onChange({ ...settings, skipWeekends: !skipWeekends })}
                className="size-4 accent-[var(--color-accent)]"
              />
              Skip weekends
            </label>
          </div>

          <p className="text-sm text-[var(--color-ink-muted)]">
            {describePlan(summary)}
            {lastDay ? (
              <>
                {" "}
                Last one on{" "}
                {new Date(`${lastDay}T00:00:00`).toLocaleDateString(undefined, {
                  weekday: "long",
                  month: "short",
                  day: "numeric",
                })}
                .
              </>
            ) : null}
          </p>

          {summary.crowded ? (
            <p className="text-sm text-[#6b5626] dark:text-[#e3d0a2]">
              That is more per day than you asked for — there are not enough days
              left to go slower.
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
