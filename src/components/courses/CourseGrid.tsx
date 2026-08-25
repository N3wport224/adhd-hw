"use client";

import { useMemo, useState } from "react";
import { useAppData } from "@/lib/appData";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { CourseCard } from "@/components/courses/CourseCard";
import { CourseFormDialog } from "@/components/courses/CourseFormDialog";
import type { Course, CourseDraft } from "@/types";

export function CourseGrid() {
  const { data, ready, addCourse, updateCourse, removeCourse } = useAppData();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Course | null>(null);

  const openTaskCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const task of data.tasks) {
      if (!task.courseId || task.status === "done") continue;
      counts.set(task.courseId, (counts.get(task.courseId) ?? 0) + 1);
    }
    return counts;
  }, [data.tasks]);

  function openAdd() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(course: Course) {
    setEditing(course);
    setDialogOpen(true);
  }

  function handleSubmit(draft: CourseDraft) {
    if (editing) {
      updateCourse(editing.id, draft);
    } else {
      addCourse(draft);
    }
    setDialogOpen(false);
  }

  function handleDelete() {
    if (!editing) return;
    removeCourse(editing.id);
    setDialogOpen(false);
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Your courses</h2>
          <p className="text-sm text-[var(--color-ink-muted)]">
            {ready
              ? `${data.courses.length} ${data.courses.length === 1 ? "course" : "courses"} this term`
              : "Loading…"}
          </p>
        </div>
        <Button variant="primary" onClick={openAdd}>
          <span aria-hidden="true">+</span> Add course
        </Button>
      </div>

      {!ready ? (
        <div
          aria-hidden="true"
          className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
        >
          {[0, 1, 2].map((index) => (
            <div
              key={index}
              className="h-48 animate-pulse rounded-[var(--radius-card)] bg-[var(--color-surface-muted)]"
            />
          ))}
        </div>
      ) : data.courses.length === 0 ? (
        <EmptyState
          title="No courses yet"
          body="Add one class to start. You can fill in the details later — a name is enough for now."
          action={
            <Button variant="primary" size="lg" onClick={openAdd}>
              Add your first course
            </Button>
          }
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {data.courses.map((course) => (
            <li key={course.id}>
              <CourseCard
                course={course}
                openTaskCount={openTaskCounts.get(course.id) ?? 0}
                onEdit={openEdit}
              />
            </li>
          ))}
        </ul>
      )}

      <CourseFormDialog
        open={dialogOpen}
        course={editing}
        onClose={() => setDialogOpen(false)}
        onSubmit={handleSubmit}
        onDelete={editing ? handleDelete : undefined}
      />
    </section>
  );
}
