"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLatestRef } from "@/lib/useLatestRef";

export type PomodoroPhase = "focus" | "break" | "longBreak";

export const PHASE_SECONDS: Record<PomodoroPhase, number> = {
  focus: 25 * 60,
  break: 5 * 60,
  longBreak: 15 * 60,
};

export const PHASE_LABELS: Record<PomodoroPhase, string> = {
  focus: "Focus",
  break: "Short break",
  longBreak: "Long break",
};

/** Focus blocks before the longer break. */
const BLOCKS_PER_CYCLE = 4;

export interface Pomodoro {
  phase: PomodoroPhase;
  secondsLeft: number;
  running: boolean;
  /** Completed focus blocks in this sitting. */
  completedBlocks: number;
  /** 0–1, for the ring. */
  progress: number;
  start(): void;
  pause(): void;
  reset(): void;
  skip(): void;
}

interface UsePomodoroOptions {
  /** Fires when a focus block runs to completion, never on a manual skip. */
  onFocusComplete?(): void;
}

export function usePomodoro({ onFocusComplete }: UsePomodoroOptions = {}): Pomodoro {
  const [phase, setPhase] = useState<PomodoroPhase>("focus");
  const [secondsLeft, setSecondsLeft] = useState(PHASE_SECONDS.focus);
  const [running, setRunning] = useState(false);
  const [completedBlocks, setCompletedBlocks] = useState(0);

  // Timers are derived from a wall-clock deadline rather than counted down.
  // Background tabs get their intervals throttled to once a minute or worse,
  // and a decrementing counter would quietly drift into being wrong.
  const deadline = useRef<number | null>(null);
  const onFocusCompleteRef = useLatestRef(onFocusComplete);

  const advancePhase = useCallback(
    (completed: boolean) => {
      setPhase((current) => {
        if (current !== "focus") {
          setSecondsLeft(PHASE_SECONDS.focus);
          return "focus";
        }

        const blocks = completed ? completedBlocks + 1 : completedBlocks;
        if (completed) {
          setCompletedBlocks(blocks);
          onFocusCompleteRef.current?.();
        }
        const next: PomodoroPhase =
          blocks > 0 && blocks % BLOCKS_PER_CYCLE === 0 ? "longBreak" : "break";
        setSecondsLeft(PHASE_SECONDS[next]);
        return next;
      });
      deadline.current = null;
      setRunning(false);
    },
    [completedBlocks, onFocusCompleteRef],
  );

  useEffect(() => {
    if (!running) return;

    const tick = () => {
      if (deadline.current === null) return;
      const remaining = Math.max(0, Math.round((deadline.current - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (remaining === 0) advancePhase(true);
    };

    const timer = window.setInterval(tick, 250);
    tick();
    return () => window.clearInterval(timer);
  }, [running, advancePhase]);

  const start = useCallback(() => {
    setSecondsLeft((remaining) => {
      deadline.current = Date.now() + remaining * 1000;
      return remaining;
    });
    setRunning(true);
  }, []);

  const pause = useCallback(() => {
    if (deadline.current !== null) {
      setSecondsLeft(Math.max(0, Math.round((deadline.current - Date.now()) / 1000)));
    }
    deadline.current = null;
    setRunning(false);
  }, []);

  const reset = useCallback(() => {
    deadline.current = null;
    setRunning(false);
    setSecondsLeft(PHASE_SECONDS[phase]);
  }, [phase]);

  const skip = useCallback(() => advancePhase(false), [advancePhase]);

  return {
    phase,
    secondsLeft,
    running,
    completedBlocks,
    progress: 1 - secondsLeft / PHASE_SECONDS[phase],
    start,
    pause,
    reset,
    skip,
  };
}
