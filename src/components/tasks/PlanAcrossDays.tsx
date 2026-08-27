"use client";

import { useMemo, useState } from "react";
import { describePlan, planStepDays } from "@/lib/stepPlanner";
import { toDayKey } from "@/lib/schedule";
import { cn } from "@/lib/utils";

interface PlanAcrossDaysProps {
  /** How many steps are being planned. */
  stepCount: number;
  /** The task's deadline as a local day, or null. */
  due: string | null;
  /** Called whenever the plan changes, with one day per step, or null when off. */
  onChange(days: string[] | null): void;
  /** Start switched on — true where a deadline makes a plan obviously useful. */
  defaultOn?: boolean;
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
export function PlanAcrossDays({
  stepCount,
  due,
  onChange,
  defaultOn = true,
}: PlanAcrossDaysProps) {
  const [enabled, setEnabled] = useState(defaultOn);
  const [perDay, setPerDay] = useState(2);
  const [skipWeekends, setSkipWeekends] = useState(false);

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

  // Reported during render rather than from an effect: the parent only needs
  // the current answer at submit time, and an effect here would fire on every
  // keystroke in the step list above.
  const days = enabled ? summary.days : null;
  const [reported, setReported] = useState<string[] | null | undefined>(undefined);
  if (reported === undefined || JSON.stringify(reported) !== JSON.stringify(days)) {
    setReported(days);
    onChange(days);
  }

  const lastDay = summary.days.at(-1);

  return (
    <div className="space-y-3 rounded-xl bg-[var(--color-surface-muted)] p-4">
      <label className="flex items-start gap-3 text-sm font-medium">
        <input
          type="checkbox"
          checked={enabled}
          onChange={() => setEnabled((value) => !value)}
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
            {PACES.map((pace) => (
              <button
                key={pace}
                type="button"
                onClick={() => setPerDay(pace)}
                aria-pressed={perDay === pace}
                className={cn(
                  "min-h-9 rounded-lg px-3 text-sm font-medium transition",
                  perDay === pace
                    ? "bg-[var(--color-accent)] text-[var(--color-on-accent)]"
                    : "text-[var(--color-ink-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-ink)]",
                )}
              >
                {pace}
              </button>
            ))}
            <span className="text-sm text-[var(--color-ink-muted)]">a day</span>

            <label className="ml-auto flex items-center gap-2 text-sm text-[var(--color-ink-muted)]">
              <input
                type="checkbox"
                checked={skipWeekends}
                onChange={() => setSkipWeekends((value) => !value)}
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
