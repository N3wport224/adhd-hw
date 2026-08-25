"use client";

import { PHASE_LABELS, PHASE_SECONDS, usePomodoro } from "@/lib/pomodoro";
import { cn, formatClock } from "@/lib/utils";
import { Button } from "@/components/ui/Button";

interface PomodoroTimerProps {
  /** Name of what the timer is for, so the block has a subject. */
  taskTitle?: string;
  /** Called when a focus block completes, to count it against the task. */
  onFocusComplete?(): void;
  /** Focus blocks already recorded against this task, across sittings. */
  completedTotal?: number;
}

const RADIUS = 52;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function PomodoroTimer({
  taskTitle,
  onFocusComplete,
  completedTotal,
}: PomodoroTimerProps) {
  const pomodoro = usePomodoro({ onFocusComplete });
  const focusing = pomodoro.phase === "focus";

  return (
    <div className="flex flex-col items-center gap-5">
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

      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button
          variant="primary"
          onClick={pomodoro.running ? pomodoro.pause : pomodoro.start}
        >
          {pomodoro.running ? "Pause" : pomodoro.secondsLeft === PHASE_SECONDS[pomodoro.phase] ? "Start" : "Resume"}
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
