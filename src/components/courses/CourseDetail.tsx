"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAppData, useCourse } from "@/lib/appData";
import { COURSE_COLORS } from "@/lib/courseStyles";
import { cn } from "@/lib/utils";
import { Card, CardTitle } from "@/components/ui/Card";
import { Button, LinkButton } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { CourseIcon } from "@/components/courses/CourseIcon";
import { CourseFormDialog } from "@/components/courses/CourseFormDialog";
import { TaskRow } from "@/components/focus/TaskRow";
import { QuickAddTask } from "@/components/focus/QuickAddTask";
import type { CourseDraft } from "@/types";

export function CourseDetail({ courseId }: { courseId: string }) {
  const { data, ready, updateCourse, removeCourse, updateTask } = useAppData();
  const course = useCourse(courseId);
  const router = useRouter();
  const [editing, setEditing] = useState(false);

  const tasks = useMemo(
    () => data.tasks.filter((task) => task.courseId === courseId),
    [data.tasks, courseId],
  );
  const openTasks = tasks.filter((task) => task.status !== "done");

  if (!ready) {
    return (
      <div
        aria-hidden="true"
        className="h-64 animate-pulse rounded-[var(--radius-card)] bg-[var(--color-surface-muted)]"
      />
    );
  }

  if (!course) {
    return (
      <EmptyState
        title="That course is not here"
        body="It may have been deleted. Your tasks and documents from it are still safe — they are just unfiled."
        action={<LinkButton href="/courses" variant="primary">Back to courses</LinkButton>}
      />
    );
  }

  const palette = COURSE_COLORS[course.color];

  function handleSubmit(draft: CourseDraft) {
    updateCourse(courseId, draft);
    setEditing(false);
  }

  return (
    <div className="space-y-10">
      <nav aria-label="Breadcrumb" className="text-sm text-[var(--color-ink-muted)]">
        <Link href="/courses" className="underline underline-offset-4">
          Courses
        </Link>
        <span aria-hidden="true"> / </span>
        <span>{course.name}</span>
      </nav>

      <header className="flex flex-wrap items-start gap-5">
        <span
          aria-hidden="true"
          className={cn("grid size-14 shrink-0 place-items-center rounded-2xl", palette.chip)}
        >
          <CourseIcon icon={course.icon} className="size-7" />
        </span>

        <div className="min-w-0 flex-1">
          <h2 className="text-2xl font-semibold tracking-tight">{course.name}</h2>
          <p className="text-[var(--color-ink-muted)]">
            {[course.code, course.instructor, course.meetingInfo]
              .filter(Boolean)
              .join(" · ") || "No details yet"}
          </p>
        </div>

        <Button onClick={() => setEditing(true)}>Edit course</Button>
      </header>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle>Tasks</CardTitle>
          <p className="text-sm text-[var(--color-ink-muted)]">
            {openTasks.length} open of {tasks.length}
          </p>
        </div>

        {tasks.length === 0 ? (
          <EmptyState
            title="No tasks for this course yet"
            body="Add the next thing you actually have to do. One line is enough."
          />
        ) : (
          <Card className="divide-y divide-[var(--color-border-soft)]">
            {tasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                onToggle={(done) => updateTask(task.id, { status: done ? "done" : "todo" })}
              />
            ))}
          </Card>
        )}

        <Card>
          <QuickAddTask defaultCourseId={courseId} />
        </Card>
      </section>

      <section className="space-y-4">
        <CardTitle>Syllabus &amp; documents</CardTitle>
        <EmptyState
          title="Uploading comes next"
          body="This is where the syllabus drop zone and the course document library will live, feeding the schedule and the read-aloud reader."
        />
      </section>

      <CourseFormDialog
        open={editing}
        course={course}
        onClose={() => setEditing(false)}
        onSubmit={handleSubmit}
        onDelete={() => {
          removeCourse(courseId);
          setEditing(false);
          router.push("/courses");
        }}
      />
    </div>
  );
}
