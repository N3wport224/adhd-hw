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
import { QuickAddTask } from "@/components/focus/QuickAddTask";
import { TaskCard } from "@/components/tasks/TaskCard";
import { BreakdownDialog } from "@/components/tasks/BreakdownDialog";
import { DocumentDropzone } from "@/components/documents/DocumentDropzone";
import { DocumentRow } from "@/components/documents/DocumentRow";
import type { CourseDraft, Task } from "@/types";

export function CourseDetail({ courseId }: { courseId: string }) {
  const { data, ready, updateCourse, removeCourse } = useAppData();
  const course = useCourse(courseId);
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [breakdownTask, setBreakdownTask] = useState<Task | null>(null);

  const tasks = useMemo(
    () => data.tasks.filter((task) => task.courseId === courseId),
    [data.tasks, courseId],
  );
  const documents = useMemo(
    () =>
      data.documents
        .filter((document) => document.courseId === courseId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [data.documents, courseId],
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
          <ul className="space-y-3">
            {tasks.map((task) => (
              <li key={task.id}>
                <TaskCard task={task} onBreakDown={setBreakdownTask} />
              </li>
            ))}
          </ul>
        )}

        <Card>
          <QuickAddTask defaultCourseId={courseId} />
        </Card>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle>Syllabus &amp; readings</CardTitle>
          <p className="text-sm text-[var(--color-ink-muted)]">
            {documents.length} {documents.length === 1 ? "document" : "documents"}
          </p>
        </div>

        {/* Bound to this course by id at the point of upload, so a file dropped
            here can never end up filed under the wrong class. */}
        <DocumentDropzone courseId={courseId} courseName={course.name} />

        {documents.length > 0 ? (
          <Card padded={false} className="divide-y divide-[var(--color-border-soft)] px-6">
            {documents.map((document) => (
              <DocumentRow key={document.id} document={document} showCourse={false} />
            ))}
          </Card>
        ) : null}
      </section>

      <BreakdownDialog
        open={breakdownTask !== null}
        task={breakdownTask}
        onClose={() => setBreakdownTask(null)}
      />

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
