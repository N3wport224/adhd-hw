"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAppData } from "@/lib/appData";
import { COURSE_COLORS } from "@/lib/courseStyles";
import { useFocusTrap } from "@/lib/useFocusTrap";
import { useLatestRef } from "@/lib/useLatestRef";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { PomodoroTimer } from "@/components/focus/PomodoroTimer";
import type { FocusMinutes } from "@/lib/pomodoro";
import type { Task } from "@/types";

interface FocusModeProps {
  task: Task;
  onExit(): void;
  /** Opening block length, and whether to start it without being asked again. */
  startMinutes?: FocusMinutes;
  autoStart?: boolean;
}

/**
 * One task, one step, one timer, and nothing else on screen — not the
 * sidebar, not the rest of the list, not the count of what is left.
 *
 * This covers the whole viewport rather than being a section of the page.
 * Everything still visible at the edges is something to look at instead of
 * the work, which is the exact failure this view exists to prevent.
 */
export function FocusMode({ task, onExit, startMinutes, autoStart }: FocusModeProps) {
  const { data, addTask, updateTask, toggleSubtask } = useAppData();
  const course = data.courses.find((item) => item.id === task.courseId) ?? null;
  const nextStep = task.subtasks.find((step) => !step.done) ?? null;
  const doneSteps = task.subtasks.filter((step) => step.done).length;

  // An intrusive thought mid-session — "email the TA" — costs the session if
  // acting on it means leaving this screen. One key puts it somewhere safe
  // without the timer or the page moving.
  const [capturing, setCapturing] = useState(false);
  const [caught, setCaught] = useState<string | null>(null);
  const captureField = useRef<HTMLInputElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  // Read by the Escape handler, which must not become a dependency of the
  // trap — re-registering it on every keystroke would be silly.
  const capturingRef = useLatestRef(capturing);

  // Escape backs out of the capture field first and only then out of the
  // session — leaving a whole sitting because you changed your mind about a
  // note would be a rotten trade.
  const escape = useCallback(() => {
    if (capturingRef.current) {
      setCapturing(false);
      return;
    }
    onExit();
  }, [onExit, capturingRef]);

  // The same trap the dialogs use: Tab stays inside, and focus goes back to
  // whatever opened the session rather than being dropped on the page.
  useFocusTrap(true, panel, escape);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      // Not while something is already being typed into.
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (event.key === "c" && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        setCapturing(true);
        window.setTimeout(() => captureField.current?.focus(), 0);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div
      ref={panel}
      role="dialog"
      aria-modal="true"
      aria-label={`Focus mode: ${task.title}`}
      className="fixed inset-0 z-50 overflow-y-auto bg-[var(--color-canvas)]"
    >
      <div className="mx-auto flex min-h-dvh max-w-2xl flex-col items-center justify-center gap-8 px-6 py-12 text-center">
        <div className="space-y-3">
          {course ? (
            <span
              className={cn(
                "inline-block rounded-md px-2 py-0.5 text-xs font-medium",
                COURSE_COLORS[course.color].chip,
              )}
            >
              {course.code || course.name}
            </span>
          ) : null}
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">{task.title}</h2>
        </div>

        {nextStep ? (
          <div className="w-full max-w-md space-y-4 rounded-[var(--radius-card)] border border-[var(--color-border-soft)] bg-[var(--color-surface)] p-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-muted)]">
              This step only
            </p>
            <p className="text-lg">{nextStep.title}</p>
            <Button variant="secondary" onClick={() => toggleSubtask(task.id, nextStep.id)}>
              Step done
            </Button>
            {task.subtasks.length > 1 ? (
              <p className="text-sm text-[var(--color-ink-muted)]">
                {doneSteps} of {task.subtasks.length} steps done
              </p>
            ) : null}
          </div>
        ) : null}

        <PomodoroTimer
          taskTitle={nextStep ? undefined : task.title}
          completedTotal={task.pomodorosCompleted}
          initialMinutes={startMinutes}
          autoStart={autoStart}
          onFocusComplete={(minutes) =>
            updateTask(task.id, {
              pomodorosCompleted: task.pomodorosCompleted + 1,
              // Minutes, not blocks: a block is no longer a fixed length, and
              // minutes are what a later estimate is made of.
              focusMinutes: (task.focusMinutes ?? 0) + minutes,
            })
          }
        />

        {capturing ? (
          <form
            className="flex w-full max-w-md items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              const title = captureField.current?.value.trim() ?? "";
              if (title) {
                addTask({
                  courseId: task.courseId,
                  title,
                  notes: "",
                  dueAt: null,
                  status: "todo",
                  subtasks: [],
                });
                setCaught(title);
              }
              setCapturing(false);
            }}
          >
            <label htmlFor="focus-capture" className="sr-only">
              Something to deal with later
            </label>
            <input
              ref={captureField}
              id="focus-capture"
              placeholder="Park it and carry on…"
              autoComplete="off"
              // Only when focus actually leaves the form. Blur fires before
              // click, so closing on any blur meant the button next to it
              // unmounted before its own submit could run — and the typed
              // thought was lost by the one gesture meant to save it.
              onBlur={(event) => {
                if (!event.currentTarget.form?.contains(event.relatedTarget)) {
                  setCapturing(false);
                }
              }}
              className="min-h-11 flex-1 rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-surface)] px-3 text-sm"
            />
            <Button type="submit" variant="secondary">
              Park it
            </Button>
          </form>
        ) : (
          <p className="text-sm text-[var(--color-ink-muted)]">
            {caught ? (
              <span role="status" className="animate-rise-fade">
                Parked “{caught}” for later. Back to it.
              </span>
            ) : (
              <>
                Press <kbd className="rounded border border-[var(--color-border-soft)] px-1.5 py-0.5 font-mono text-xs">C</kbd>{" "}
                to park a stray thought without leaving this.
              </>
            )}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button
            variant="secondary"
            onClick={() => {
              updateTask(task.id, { status: "done" });
              onExit();
            }}
          >
            Whole task done
          </Button>
          <Button variant="ghost" onClick={onExit}>
            Leave focus mode
          </Button>
        </div>

        <p className="text-sm text-[var(--color-ink-muted)]">Press Escape to leave.</p>
      </div>
    </div>
  );
}
