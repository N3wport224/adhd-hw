"use client";

import { useState } from "react";
import { useAppData } from "@/lib/appData";
import { dayKeyOf, toDayKey } from "@/lib/schedule";
import { describePlan, planStepDays, replanOpenSteps } from "@/lib/stepPlanner";
import { cn } from "@/lib/utils";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { controlClass } from "@/components/ui/Field";
import type { Task } from "@/types";

interface EditTaskDialogProps {
  open: boolean;
  task: Task | null;
  onClose(): void;
}

export function EditTaskDialog({ open, task, onClose }: EditTaskDialogProps) {
  return (
    <Dialog
      open={open && task !== null}
      title="Edit assignment"
      description="Change what it says, when it is due, or which course it belongs to."
      onClose={onClose}
    >
      {/* Keyed on the task so switching between two never shows the first
          one's half-edited values. */}
      {task ? <EditForm key={task.id} task={task} onClose={onClose} /> : null}
    </Dialog>
  );
}

function EditForm({ task, onClose }: { task: Task; onClose(): void }) {
  const { data, updateTask, setSubtasks } = useAppData();

  const originalDay = task.dueAt ? dayKeyOf(task.dueAt) : "";
  const [title, setTitle] = useState(task.title);
  const [courseId, setCourseId] = useState(task.courseId ?? "");
  const [dueDay, setDueDay] = useState(originalDay);
  const [notes, setNotes] = useState(task.notes);

  const openSteps = task.subtasks.filter((step) => step.done === false);
  const dueChanged = dueDay !== originalDay;
  // Only worth offering when there is a plan that the new date invalidates.
  const canReplan = dueChanged && openSteps.some((step) => step.plannedFor);
  const [replan, setReplan] = useState(true);

  const today = toDayKey(new Date());
  const preview = canReplan
    ? planStepDays(openSteps.length, { from: today, due: dueDay || null, perDay: 2 })
    : null;

  function handleSave() {
    const trimmed = title.trim();
    if (!trimmed) return;

    updateTask(task.id, {
      title: trimmed,
      courseId: courseId || null,
      notes,
      dueAt: dueDay ? new Date(`${dueDay}T00:00:00`).toISOString() : null,
    });

    if (canReplan && replan) {
      setSubtasks(
        task.id,
        replanOpenSteps(task.subtasks, { from: today, due: dueDay || null, perDay: 2 }),
      );
    }

    onClose();
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        handleSave();
      }}
      className="space-y-5"
    >
      <div className="space-y-2">
        <label htmlFor="edit-title" className="block text-sm font-medium">
          What needs doing
        </label>
        <input
          id="edit-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          autoComplete="off"
          className={cn("w-full", controlClass())}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="edit-course" className="block text-sm font-medium">
            Course
          </label>
          <select
            id="edit-course"
            value={courseId}
            onChange={(event) => setCourseId(event.target.value)}
            className={cn("w-full", controlClass())}
          >
            <option value="">No course</option>
            {data.courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.code || course.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label htmlFor="edit-due" className="block text-sm font-medium">
            Due
          </label>
          <input
            id="edit-due"
            type="date"
            value={dueDay}
            onChange={(event) => setDueDay(event.target.value)}
            className={cn("w-full", controlClass())}
          />
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="edit-notes" className="block text-sm font-medium">
          Notes
        </label>
        <textarea
          id="edit-notes"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={2}
          placeholder="Anything you want to remember about it."
          className={cn("w-full resize-y", controlClass())}
        />
      </div>

      {canReplan && preview ? (
        <label className="flex items-start gap-3 rounded-xl bg-[var(--color-surface-muted)] p-4 text-sm">
          <input
            type="checkbox"
            checked={replan}
            onChange={() => setReplan((value) => !value)}
            className="mt-0.5 size-4 accent-[var(--color-accent)]"
          />
          <span>
            <span className="font-medium">Spread the remaining steps again</span>
            <span className="block text-[var(--color-ink-muted)]">
              The date moved, so the days its steps sit on no longer fit.{" "}
              {describePlan(preview)}
            </span>
          </span>
        </label>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="primary" disabled={!title.trim()}>
          Save changes
        </Button>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
