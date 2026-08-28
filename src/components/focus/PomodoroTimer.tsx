"use client";

import { useEffect, useRef, useState } from "react";
import {
  DEFAULT_FOCUS_MINUTES,
  FOCUS_MINUTES,
  PHASE_LABELS,
  phaseSeconds,
  usePomodoro,
  type FocusMinutes,
} from "@/lib/pomodoro";
import { useLatestRef } from "@/lib/useLatestRef";
import { cn, formatClock } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { ChoiceGroup } from "@/components/ui/ChoiceGroup";

interface PomodoroTimerProps {
  /** Name of what the timer is for, so the block has a subject. */
  taskTitle?: string;
  /** Called when a focus block completes, with the minutes it ran for. */
  onFocusComplete?(minutes: number): void;
  /** Focus blocks already recorded against this task, across sittings. */
  completedTotal?: number;
  /** Block length to open on, for an on-ramp that asks for very little. */
  initialMinutes?: FocusMinutes;
  /**
   * Arm the clock rather than run it: it starts on the first thing you
   * actually do. Auto-running assumed you were ready the instant you clicked,
   * and the clock ate the time it took to open the reading.
   */
  autoStart?: boolean;
}

const RADIUS = 52;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function PomodoroTimer({
  taskTitle,
  onFocusComplete,
  completedTotal,
  initialMinutes = DEFAULT_FOCUS_MINUTES,
  autoStart = false,
}: PomodoroTimerProps) {
  const [minutes, setMinutes] = useState<FocusMinutes>(initialMinutes);
  const pomodoro = usePomodoro({ onFocusComplete, focusMinutes: minutes });
  const started = useRef(false);
  const startRef = useLatestRef(pomodoro.start);
  const root = useRef<HTMLDivElement>(null);

  // Any real move — a key, a click, a scroll — is the moment the session
  // actually began. Once only, and never from the click that opened it.
  useEffect(() => {
    if (!autoStart) return;
    const begin = (event: Event) => {
      if (started.current) return;
      // Not the timer's own controls. Setting the block length before you
      // begin is not beginning, and starting on that touch made the length
      // picker vanish under the finger choosing with it — the buttons here
      // already say what they do.
      const target = event.target;
      if (target instanceof Node && root.current?.contains(target)) return;
      started.current = true;
      startRef.current();
    };
    const events = ["keydown", "pointerdown", "wheel"] as const;
    for (const name of events) window.addEventListener(name, begin);
    return () => {
      for (const name of events) window.removeEventListener(name, begin);
    };
  }, [autoStart, startRef]);
  const focusing = pomodoro.phase === "focus";
  const atStart = pomodoro.secondsLeft === phaseSeconds(pomodoro.phase, minutes);

  return (
    <div ref={root} className="flex flex-col items-center gap-5">
      <div className="relative grid place-items-center">
        <svg viewBox="0 0 120 120" aria-hidden="true" className="size-40 -rotate-90">
          <circle
            cx="60"
            cy="60"
            r={RADIUS}
            fill="none"
            strokeWidth="8"
            className="stroke-[var(--color-surface-muted)]"
          />
          <circle
            cx="60"
            cy="60"
            r={RADIUS}
            fill="none"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            // A ring that empties as time passes: the amount left is readable
            // at a glance without doing arithmetic on a number.
            strokeDashoffset={CIRCUMFERENCE * pomodoro.progress}
            className={cn(
              "transition-[stroke-dashoffset] duration-500",
              focusing ? "stroke-[var(--color-accent)]" : "stroke-[#b58a70]",
            )}
          />
        </svg>

        <div className="absolute flex flex-col items-center">
          <span
            role="timer"
            aria-live="off"
            className="font-mono text-3xl font-semibold tabular-nums"
          >
            {formatClock(pomodoro.secondsLeft)}
          </span>
          <span className="text-sm text-[var(--color-ink-muted)]">
            {PHASE_LABELS[pomodoro.phase]}
          </span>
        </div>
      </div>

      {taskTitle ? (
        <p className="max-w-xs text-center text-sm text-[var(--color-ink-muted)]">
          {focusing ? "Working on" : "Next up"}: <span className="text-[var(--color-ink)]">{taskTitle}</span>
        </p>
      ) : null}

      {pomodoro.asking ? (
        <div
          role="status"
          className="animate-rise-fade flex flex-col items-center gap-3 rounded-[var(--radius-card)] bg-[var(--color-accent-wash)] px-5 py-4"
        >
          <p className="text-sm font-medium">
            That is {minutes} minutes done. Keep going, or take a break?
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button variant="primary" onClick={pomodoro.keepGoing}>
              Keep going
            </Button>
            <Button variant="secondary" onClick={pomodoro.takeBreak}>
              Take the break
            </Button>
          </div>
        </div>
      ) : null}

      {focusing && !pomodoro.running && atStart ? (
        <div className="flex flex-wrap items-center justify-center gap-2">
          <span aria-hidden="true" className="text-sm text-[var(--color-ink-muted)]">
            Block
          </span>
          <ChoiceGroup
            label="How long a focus block runs"
            choices={FOCUS_MINUTES.map((option) => ({
              value: String(option),
              label: `${option}m`,
            }))}
            value={String(minutes)}
            onSelect={(next) => setMinutes(Number(next) as FocusMinutes)}
            className="flex flex-wrap gap-1"
            optionClassName={(selected) =>
              cn(
                "min-h-9 rounded-lg px-3 text-sm font-medium transition",
                selected
                  ? "bg-[var(--color-accent)] text-[var(--color-on-accent)]"
                  : "text-[var(--color-ink-muted)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-ink)]",
              )
            }
          />
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button
          variant="primary"
          onClick={pomodoro.running ? pomodoro.pause : pomodoro.start}
        >
          {pomodoro.running ? "Pause" : atStart ? "Start" : "Resume"}
        </Button>
        <Button variant="ghost" onClick={pomodoro.reset}>
          Reset
        </Button>
        <Button variant="ghost" onClick={pomodoro.skip}>
          {focusing ? "Skip to break" : "Back to focus"}
        </Button>
      </div>

      {(completedTotal ?? 0) + pomodoro.completedBlocks > 0 ? (
        <p className="text-sm text-[var(--color-ink-muted)]">
          {(completedTotal ?? 0) + pomodoro.completedBlocks} focus{" "}
          {(completedTotal ?? 0) + pomodoro.completedBlocks === 1 ? "block" : "blocks"} on this
          task.
        </p>
      ) : null}
    </div>
  );
}
