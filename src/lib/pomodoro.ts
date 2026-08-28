"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLatestRef } from "@/lib/useLatestRef";

export type PomodoroPhase = "focus" | "break" | "longBreak";

/**
 * Block lengths anyone can pick from.
 *
 * Twenty-five minutes is a convention, not a finding. On a bad day it is too
 * much to agree to before starting, and in the middle of a good one it is an
 * interruption — so the length is a choice, and the short options exist to
 * make starting cheap rather than to be optimal.
 */
export const FOCUS_MINUTES = [5, 10, 15, 25, 45, 50] as const;
export type FocusMinutes = (typeof FOCUS_MINUTES)[number];
export const DEFAULT_FOCUS_MINUTES: FocusMinutes = 25;

export function phaseSeconds(phase: PomodoroPhase, focusMinutes: number): number {
  if (phase === "focus") return focusMinutes * 60;
  // The break scales with the work, roughly the classic fifth of it, and
  // never so short that it is not a break.
  if (phase === "break") return Math.max(3, Math.round(focusMinutes / 5)) * 60;
  return Math.max(10, Math.round(focusMinutes * 0.6)) * 60;
}

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
  /** The block just ended and the timer is waiting to be told what happens next. */
  asking: boolean;
  start(): void;
  pause(): void;
  reset(): void;
  skip(): void;
  keepGoing(): void;
  takeBreak(): void;
}

interface UsePomodoroOptions {
  /** Fires when a focus block runs to completion, with the minutes it ran for. */
  onFocusComplete?(minutes: number): void;
  focusMinutes?: number;
}

export function usePomodoro({
  onFocusComplete,
  focusMinutes = DEFAULT_FOCUS_MINUTES,
}: UsePomodoroOptions = {}): Pomodoro {
  const [phase, setPhase] = useState<PomodoroPhase>("focus");
  const [secondsLeft, setSecondsLeft] = useState(() => phaseSeconds("focus", focusMinutes));
  const [running, setRunning] = useState(false);
  const [completedBlocks, setCompletedBlocks] = useState(0);
  // The bell asks rather than announces: stopping someone who is finally
  // working is the opposite of the point.
  const [asking, setAsking] = useState(false);
  const lengthRef = useLatestRef(focusMinutes);

  // Timers are derived from a wall-clock deadline rather than counted down.
  // Background tabs get their intervals throttled to once a minute or worse,
  // and a decrementing counter would quietly drift into being wrong.
  const deadline = useRef<number | null>(null);
  const onFocusCompleteRef = useLatestRef(onFocusComplete);

  // Picking a different block length while the clock is idle should move the
  // clock. Without this the picker changed the next block but not the face,
  // which read as the choice having been ignored.
  const [lastLength, setLastLength] = useState(focusMinutes);
  if (lastLength !== focusMinutes) {
    setLastLength(focusMinutes);
    // Only a clock nobody has started yet: a block already part-run keeps its
    // remaining time, because moving it would lose the work already done.
    if (!running && secondsLeft === phaseSeconds(phase, lastLength)) {
      setSecondsLeft(phaseSeconds(phase, focusMinutes));
    }
  }

  const advancePhase = useCallback(
    (completed: boolean) => {
      setAsking(false);
      setPhase((current) => {
        if (current !== "focus") {
          setSecondsLeft(phaseSeconds("focus", lengthRef.current));
          return "focus";
        }

        const blocks = completed ? completedBlocks + 1 : completedBlocks;
        if (completed) {
          setCompletedBlocks(blocks);
          onFocusCompleteRef.current?.(lengthRef.current);
        }
        const next: PomodoroPhase =
          blocks > 0 && blocks % BLOCKS_PER_CYCLE === 0 ? "longBreak" : "break";
        setSecondsLeft(phaseSeconds(next, lengthRef.current));
        return next;
      });
      deadline.current = null;
      setRunning(false);
    },
    [completedBlocks, onFocusCompleteRef, lengthRef],
  );

  useEffect(() => {
    if (!running) return;

    const tick = () => {
      if (deadline.current === null) return;
      const remaining = Math.max(0, Math.round((deadline.current - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (remaining === 0) {
        // The block is banked either way; what happens next is a question.
        setCompletedBlocks((blocks) => blocks + 1);
        onFocusCompleteRef.current?.(lengthRef.current);
        deadline.current = null;
        setRunning(false);
        setAsking(true);
      }
    };

    const timer = window.setInterval(tick, 250);
    tick();
    return () => window.clearInterval(timer);
  }, [running, advancePhase, lengthRef, onFocusCompleteRef]);

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
    setAsking(false);
    setSecondsLeft(phaseSeconds(phase, lengthRef.current));
  }, [phase, lengthRef]);

  const skip = useCallback(() => advancePhase(false), [advancePhase]);

  /** Answering "keep going" at the bell: another block, straight away. */
  const keepGoing = useCallback(() => {
    setAsking(false);
    const seconds = phaseSeconds("focus", lengthRef.current);
    setSecondsLeft(seconds);
    deadline.current = Date.now() + seconds * 1000;
    setRunning(true);
  }, [lengthRef]);

  /** Answering "take the break": what the timer used to do on its own. */
  const takeBreak = useCallback(() => {
    setAsking(false);
    setPhase(completedBlocks > 0 && completedBlocks % BLOCKS_PER_CYCLE === 0 ? "longBreak" : "break");
    setSecondsLeft(
      phaseSeconds(
        completedBlocks > 0 && completedBlocks % BLOCKS_PER_CYCLE === 0 ? "longBreak" : "break",
        lengthRef.current,
      ),
    );
  }, [completedBlocks, lengthRef]);

  const total = phaseSeconds(phase, focusMinutes);

  return {
    phase,
    secondsLeft,
    running,
    asking,
    completedBlocks,
    progress: total === 0 ? 0 : 1 - secondsLeft / total,
    start,
    pause,
    reset,
    skip,
    keepGoing,
    takeBreak,
  };
}
