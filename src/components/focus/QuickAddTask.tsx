"use client";

import { useState } from "react";
import { useAppData } from "@/lib/appData";
import { Button } from "@/components/ui/Button";
import { controlClass } from "@/components/ui/Field";
import { cn } from "@/lib/utils";

/**
 * One line, one Enter. Capturing a task should cost as little attention as
 * possible — the details can be filled in later on the Tasks screen.
 */
export function QuickAddTask({ defaultCourseId }: { defaultCourseId?: string }) {
  const { data, addTask } = useAppData();
  const [title, setTitle] = useState("");
  const [courseId, setCourseId] = useState(defaultCourseId ?? "");
  const [dueAt, setDueAt] = useState("");

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;

    addTask({
      title: trimmed,
      courseId: courseId || null,
      notes: "",
      // <input type="date"> gives a local calendar day; anchor it to local
      // midnight so "due today" means the day the student picked.
      dueAt: dueAt ? new Date(`${dueAt}T00:00:00`).toISOString() : null,
      status: "todo",
      subtasks: [],
    });

    setTitle("");
    setDueAt("");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <label htmlFor="quick-add-title" className="sr-only">
        What needs doing?
      </label>
      <input
        id="quick-add-title"
        className={cn("w-full", controlClass())}
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="What needs doing?"
        autoComplete="off"
      />

      <div className="flex flex-wrap gap-3">
        <label htmlFor="quick-add-course" className="sr-only">
          Course
        </label>
        <select
          id="quick-add-course"
          className={cn("min-w-40 flex-1", controlClass())}
          value={courseId}
          onChange={(event) => setCourseId(event.target.value)}
        >
          <option value="">No course</option>
          {data.courses.map((course) => (
            <option key={course.id} value={course.id}>
              {course.code || course.name}
            </option>
          ))}
        </select>

        <label htmlFor="quick-add-due" className="sr-only">
          Due date
        </label>
        <input
          id="quick-add-due"
          type="date"
          className={cn("min-w-40 flex-1", controlClass())}
          value={dueAt}
          onChange={(event) => setDueAt(event.target.value)}
        />

        <Button type="submit" variant="primary" disabled={!title.trim()}>
          Add
        </Button>
      </div>
    </form>
  );
}
