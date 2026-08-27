"use client";

import { useMemo, useState } from "react";
import { useAppData } from "@/lib/appData";
import { lectureTaskDrafts, plannedLectureWeeks } from "@/lib/lecturePlan";
import { describeMeetingPattern } from "@/lib/syllabusCourseInfo";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import type { Course } from "@/types";

interface LecturePlannerProps {
  course: Course;
  /** Opens the course form, where the term dates live. */
  onEditCourse(): void;
}

/**
 * Turns a term into a lecture to attend each week.
 *
 * Lectures are the work that never appears on a to-do list, because nothing
 * about them is written down as a deadline — and so they are the first thing
 * to quietly slide. A term is a rule ("Mondays and Wednesdays until December"),
 * so this expands it into tasks you can actually tick off.
 *
 * Kept as a deliberate step rather than something that happens on its own:
 * this writes a term's worth of tasks, and that is not a thing to do to
 * someone's list without asking.
 */
export function LecturePlanner({ course, onEditCourse }: LecturePlannerProps) {
  const { data, importTasks } = useAppData();
  const [added, setAdded] = useState<number | null>(null);

  const drafts = useMemo(() => lectureTaskDrafts(course), [course]);
  const already = plannedLectureWeeks(data.tasks, course.id);
  const missing = drafts.filter(
    (draft) => draft.source?.kind === "lectures" && !already.has(draft.source.weekStart),
  );

  const pattern = course.meetingPattern;
  const synchronous = (pattern?.days.length ?? 0) > 0;

  function handleAdd() {
    const summary = importTasks(drafts);
    setAdded(summary.added);
  }

  return (
    <section className="space-y-4">
      <CardTitle>Weekly lectures</CardTitle>
      <Card className="space-y-4">
        {!course.termStart ? (
          <>
            <p className="text-sm text-[var(--color-ink-muted)]">
              Set the term dates and every week of it gets a lectures task —
              something to tick off for going, or for watching the recording.
            </p>
            <Button variant="secondary" onClick={onEditCourse}>
              Add term dates
            </Button>
          </>
        ) : (
          <>
            <p className="text-sm text-[var(--color-ink-muted)]">
              {drafts.length} {drafts.length === 1 ? "week" : "weeks"} of term
              {synchronous && pattern
                ? `, ${describeMeetingPattern(pattern)}.`
                : ". No class days are set, so each week gets one step for watching the lectures."}{" "}
              {already.size > 0
                ? `${already.size} ${already.size === 1 ? "week is" : "weeks are"} on your list.`
                : "Nothing is on your list yet."}
            </p>

            {missing.length > 0 ? (
              <Button variant="primary" onClick={handleAdd}>
                Add {missing.length} {missing.length === 1 ? "week" : "weeks"} of lectures
              </Button>
            ) : (
              <p className="text-sm">Every week of term is covered.</p>
            )}

            {added !== null ? (
              <p role="status" className="animate-rise-fade text-sm text-[var(--color-ink-muted)]">
                {added === 0
                  ? "Nothing new to add."
                  : `Added ${added} ${added === 1 ? "week" : "weeks"}. Each lecture lands on the day it happens.`}
              </p>
            ) : null}
          </>
        )}
      </Card>
    </section>
  );
}
