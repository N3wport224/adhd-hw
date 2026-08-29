"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useAppData } from "@/lib/appData";
import { cn, daysUntil } from "@/lib/utils";
import { CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { controlClass } from "@/components/ui/Field";
import { QuickAddTask } from "@/components/focus/QuickAddTask";
import { TaskCard } from "@/components/tasks/TaskCard";
import { BreakdownDialog } from "@/components/tasks/BreakdownDialog";
import { RevisionDialog } from "@/components/tasks/RevisionDialog";
import { EditTaskDialog } from "@/components/tasks/EditTaskDialog";
import type { Task } from "@/types";

type Bucket = "overdue" | "today" | "week" | "later" | "someday";

const BUCKET_LABELS: Record<Bucket, string> = {
  overdue: "Overdue",
  today: "Today",
  week: "This week",
  later: "Later",
  someday: "No date yet",
};

const BUCKET_ORDER: Bucket[] = ["overdue", "today", "week", "later", "someday"];

function bucketFor(task: Task): Bucket {
  if (task.dueAt === null) return "someday";
  const days = daysUntil(task.dueAt);
  if (days < 0) return "overdue";
  if (days === 0) return "today";
  if (days <= 7) return "week";
  return "later";
}

/**
 * Everything past this week starts collapsed. The full list has to exist —
 * a tool you cannot see the whole of is not trustworthy — but it should not
 * be the first thing that greets you.
 */
const COLLAPSED_BY_DEFAULT: Bucket[] = ["later", "someday"];

export function TasksView() {
  const { data, ready } = useAppData();
  const [courseFilter, setCourseFilter] = useState("all");
  const [showDone, setShowDone] = useState(false);
  const [breakdownTask, setBreakdownTask] = useState<Task | null>(null);
  const [revisionTask, setRevisionTask] = useState<Task | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [collapsed, setCollapsed] = useState<Bucket[]>(COLLAPSED_BY_DEFAULT);

  const { buckets, doneTasks } = useMemo(() => {
    const filtered = data.tasks.filter((task) => {
      if (courseFilter === "all") return true;
      if (courseFilter === "unfiled") return task.courseId === null;
      return task.courseId === courseFilter;
    });

    const open = filtered
      .filter((task) => task.status !== "done")
      .sort((a, b) => {
        if (a.dueAt && b.dueAt) return a.dueAt.localeCompare(b.dueAt);
        if (a.dueAt) return -1;
        if (b.dueAt) return 1;
        return a.createdAt.localeCompare(b.createdAt);
      });

    const grouped = new Map<Bucket, Task[]>();
    for (const task of open) {
      const bucket = bucketFor(task);
      const existing = grouped.get(bucket);
      if (existing) existing.push(task);
      else grouped.set(bucket, [task]);
    }

    return {
      buckets: BUCKET_ORDER.filter((bucket) => grouped.has(bucket)).map((bucket) => ({
        bucket,
        tasks: grouped.get(bucket) ?? [],
      })),
      doneTasks: filtered
        .filter((task) => task.status === "done")
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    };
  }, [data.tasks, courseFilter]);

  const openCount = buckets.reduce((total, group) => total + group.tasks.length, 0);

  function toggleBucket(bucket: Bucket) {
    setCollapsed((current) =>
      current.includes(bucket)
        ? current.filter((item) => item !== bucket)
        : [...current, bucket],
    );
  }

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">Everything</h2>
        <p className="max-w-prose text-[var(--color-ink-muted)]">
          The whole list, grouped by when it is due. If this feels like a lot,{" "}
          <Link href="/" className="underline underline-offset-4">
            Focus
          </Link>{" "}
          shows one thing at a time.
        </p>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <label htmlFor="tasks-course" className="sr-only">
            Filter by course
          </label>
          <select
            id="tasks-course"
            value={courseFilter}
            onChange={(event) => setCourseFilter(event.target.value)}
            className={controlClass("sm")}
          >
            <option value="all">All courses</option>
            {data.courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.code || course.name}
              </option>
            ))}
            <option value="unfiled">No course</option>
          </select>
          <p className="text-sm text-[var(--color-ink-muted)]">
            {ready ? `${openCount} open` : "Loading…"}
          </p>
        </div>

        {doneTasks.length > 0 ? (
          <button
            type="button"
            onClick={() => setShowDone((current) => !current)}
            aria-expanded={showDone}
            className="min-h-9 rounded-lg px-3 text-sm text-[var(--color-ink-muted)] transition hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-ink)]"
          >
            {showDone ? "Hide" : "Show"} {doneTasks.length} done
          </button>
        ) : null}
      </div>

      {ready && openCount === 0 && doneTasks.length === 0 ? (
        <EmptyState
          title="Nothing on the list"
          body="Add an assignment below. You can break it into steps once it is here."
        />
      ) : null}

      {buckets.map(({ bucket, tasks }) => {
        const isCollapsed = collapsed.includes(bucket);
        return (
          <section key={bucket} className="space-y-3">
            <button
              type="button"
              onClick={() => toggleBucket(bucket)}
              aria-expanded={!isCollapsed}
              className="flex w-full items-center gap-2 rounded-lg py-1 text-left"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                className={cn(
                  "size-4 text-[var(--color-ink-muted)] transition-transform",
                  isCollapsed ? "-rotate-90" : "rotate-0",
                )}
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
              <CardTitle
                className={cn(
                  bucket === "overdue" && "text-[#a8503f] dark:text-[#e29b8b]",
                )}
              >
                {BUCKET_LABELS[bucket]}
              </CardTitle>
              <span className="text-sm text-[var(--color-ink-muted)]">{tasks.length}</span>
            </button>

            {!isCollapsed ? (
              <ul className="space-y-3">
                {tasks.map((task, position) => (
                  <li key={task.id}>
                    <TaskCard
                      task={task}
                      onBreakDown={setBreakdownTask}
                      onPlanRevision={setRevisionTask}
                onEdit={setEditingTask}
                      defaultExpanded={position === 0 && bucket !== "later" && bucket !== "someday"}
                    />
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        );
      })}

      {showDone && doneTasks.length > 0 ? (
        <section className="space-y-3">
          <CardTitle>Done</CardTitle>
          <ul className="space-y-3">
            {doneTasks.map((task) => (
              <li key={task.id}>
                <TaskCard task={task} onBreakDown={setBreakdownTask} onPlanRevision={setRevisionTask}
                onEdit={setEditingTask} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="space-y-3">
        <CardTitle>Add an assignment</CardTitle>
        <div className="rounded-[var(--radius-card)] border border-[var(--color-border-soft)] bg-[var(--color-surface)] p-6">
          <QuickAddTask />
        </div>
      </section>

      <EditTaskDialog
        open={editingTask !== null}
        task={editingTask}
        onClose={() => setEditingTask(null)}
      />

      <RevisionDialog
        open={revisionTask !== null}
        task={revisionTask}
        onClose={() => setRevisionTask(null)}
      />

      <BreakdownDialog
        open={breakdownTask !== null}
        task={breakdownTask}
        onClose={() => setBreakdownTask(null)}
      />
    </div>
  );
}
