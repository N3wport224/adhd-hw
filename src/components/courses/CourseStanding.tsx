"use client";

import { useState } from "react";
import { useAppData } from "@/lib/appData";
import { courseStanding, neededForTarget } from "@/lib/grades";
import { categoryOf } from "@/lib/taskWeight";
import { ScoreField } from "@/components/tasks/ScoreField";
import { toDayKey } from "@/lib/schedule";
import { controlClass } from "@/components/ui/Field";
import { Card, CardTitle } from "@/components/ui/Card";
import type { Course } from "@/types";

/**
 * Where you actually stand, once anything has been marked.
 *
 * With nothing to check against, "am I failing?" is answered by whatever mood
 * is asking, and one bad quiz becomes the whole term. The number is usually
 * kinder than the guess; when it is not, it is at least something you can act
 * on rather than dread.
 */
export function CourseStanding({ course }: { course: Course }) {
  const { data } = useAppData();
  const [target, setTarget] = useState(90);

  const standing = courseStanding(course, data.tasks);
  const needed = neededForTarget(standing, target);
  const marked = standing.categories.reduce((sum, item) => sum + item.gradedCount, 0);

  /*
   * Everything that could plausibly have a mark back: handed in, or past its
   * date, or already scored.
   *
   * Entering marks belongs here rather than only on the task. A mark arrives
   * days after the work was finished, by which time the task has moved into a
   * collapsed "done" list — so the one moment you have something to type is
   * the moment it is hardest to find. This is the screen you are on when you
   * ask the question anyway.
   */
  const today = toDayKey(new Date());
  const markable = data.tasks
    .filter(
      (task) =>
        task.courseId === course.id &&
        categoryOf(task, course) !== null &&
        (task.status === "done" || task.score != null || (task.dueAt !== null && task.dueAt < today)),
    )
    .sort((a, b) => (b.dueAt ?? "").localeCompare(a.dueAt ?? ""));

  if ((course.gradingWeights ?? []).length === 0) return null;

  return (
    <section className="space-y-4">
      <CardTitle>Where you stand</CardTitle>
      <Card className="space-y-5">
        {marked === 0 ? (
          <p className="text-sm text-[var(--color-ink-muted)]">
            Nothing is marked yet. Put a score on a task as it comes back and this
            works out where the term is going — the number is almost always kinder
            than the guess you would make instead.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <p className="text-3xl font-semibold tabular-nums">
                {Math.round(standing.standing ?? 0)}%
              </p>
              <p className="text-sm text-[var(--color-ink-muted)]">
                across the {Math.round(standing.settled)}% of the grade already decided.
                {" "}
                {Math.round(standing.remaining)}% is still to play for.
              </p>
            </div>

            <ul className="space-y-2">
              {standing.categories
                .filter((item) => item.totalCount > 0)
                .map((item) => (
                  <li
                    key={item.label}
                    className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm"
                  >
                    <span>{item.label}</span>
                    <span className="text-[var(--color-ink-muted)]">
                      {item.average === null
                        ? `nothing back of ${item.totalCount}`
                        : `${Math.round(item.average)}% over ${item.gradedCount} of ${item.totalCount}`}
                      {" · worth "}
                      {item.weight}%
                    </span>
                  </li>
                ))}
            </ul>

            {/* No letter grades. Every school cuts them differently and a
                confidently wrong B+ is worse than no letter at all. */}
            <div className="space-y-2 border-t border-[var(--color-border-soft)] pt-4">
              <label htmlFor={`target-${course.id}`} className="block text-sm font-medium">
                If you are aiming for
              </label>
              <div className="flex flex-wrap items-center gap-3">
                <input
                  id={`target-${course.id}`}
                  type="number"
                  min={0}
                  max={100}
                  value={target}
                  onChange={(event) => setTarget(Number(event.target.value))}
                  className={`w-24 ${controlClass("sm")}`}
                />
                <p className="flex-1 text-sm text-[var(--color-ink-muted)]">
                  {needed === null
                    ? "Everything is marked — this is the final number."
                    : needed.alreadyThere
                      ? "Already yours, whatever happens on the rest."
                      : needed.outOfReach
                        ? "Not reachable now, even at full marks on everything left. Pick a number you can chase."
                        : `You need ${Math.round(needed.average)}% on average across everything left.`}
                </p>
              </div>
            </div>
          </>
        )}

        {markable.length > 0 ? (
          <div className="space-y-2 border-t border-[var(--color-border-soft)] pt-4">
            <p className="text-sm font-medium">What came back</p>
            <ul className="space-y-1">
              {markable.map((task) => (
                <li
                  key={task.id}
                  className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm"
                >
                  <span className="min-w-0 flex-1 truncate">{task.title}</span>
                  <ScoreField task={task} />
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Card>
    </section>
  );
}
