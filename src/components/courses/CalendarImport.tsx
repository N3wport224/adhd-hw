"use client";

import { useRef, useState } from "react";
import { useAppData } from "@/lib/appData";
import { FeedError, parseCalendarFeed, type FeedEvent } from "@/lib/calendarFeed";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { Dialog } from "@/components/ui/Dialog";
import { cn } from "@/lib/utils";
import type { Course } from "@/types";

interface CalendarImportProps {
  course: Course;
}

/**
 * Assignments from the course's own calendar feed.
 *
 * The syllabus parser reads a document written before the term began, and it
 * is pattern matching either way. This is what the courseware currently
 * believes, with a stable identifier on every item — so re-importing after a
 * deadline moves updates it instead of duplicating it.
 *
 * A downloaded file rather than a URL: the feed address is a secret link to
 * everything you are enrolled in, and nothing here needs to hold one.
 */
export function CalendarImport({ course }: CalendarImportProps) {
  const { data, importTasks } = useAppData();
  const input = useRef<HTMLInputElement>(null);

  const [events, setEvents] = useState<FeedEvent[] | null>(null);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [problem, setProblem] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);

  const known = new Set(
    data.tasks
      .filter((task) => task.source?.kind === "calendar")
      .map((task) => (task.source?.kind === "calendar" ? task.source.uid : "")),
  );

  async function read(file: File) {
    setProblem(null);
    setSummary(null);
    try {
      const found = parseCalendarFeed(await file.text());
      if (found.length === 0) {
        setProblem("That calendar has no dated items in it.");
        return;
      }
      setEvents(found);
      // Anything already imported starts unticked, so confirming again is
      // about what is new rather than about everything.
      setChosen(new Set(found.filter((e) => !known.has(e.uid)).map((e) => e.uid)));
    } catch (error) {
      setProblem(
        error instanceof FeedError ? error.message : "That file could not be read as a calendar.",
      );
    }
  }

  function handleImport() {
    if (!events) return;
    const picked = events.filter((event) => chosen.has(event.uid));
    const result = importTasks(
      picked.map((event) => ({
        courseId: course.id,
        title: event.title,
        notes: "",
        dueAt: new Date(`${event.dueDay}T00:00:00`).toISOString(),
        status: "todo" as const,
        subtasks: [],
        source: { kind: "calendar" as const, uid: event.uid },
      })),
    );
    setEvents(null);
    setSummary(
      result.added === 0
        ? "Nothing new — everything picked was already on your list."
        : `Added ${result.added} ${result.added === 1 ? "assignment" : "assignments"}` +
            (result.skipped > 0 ? `, skipped ${result.skipped} already there` : "") +
            ".",
    );
  }

  const newCount = events?.filter((event) => !known.has(event.uid)).length ?? 0;

  return (
    <section className="space-y-4">
      <CardTitle>Import from your course calendar</CardTitle>
      <Card className="space-y-4">
        <p className="text-sm text-[var(--color-ink-muted)]">
          Canvas, Blackboard and Moodle all publish a calendar file of every
          assignment and its real due date. In Canvas it is under{" "}
          <span className="font-medium">Calendar → Calendar Feed</span> — save
          that <code className="text-[0.95em]">.ics</code> file and drop it here.
          It is more reliable than reading the syllabus, and importing again
          after a deadline moves updates what is already here.
        </p>

        <div>
          <label htmlFor={`calendar-${course.id}`} className="sr-only">
            Choose a calendar file for {course.name}
          </label>
          <input
            ref={input}
            id={`calendar-${course.id}`}
            type="file"
            accept=".ics,text/calendar"
            tabIndex={-1}
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void read(file);
              event.target.value = "";
            }}
          />
          <Button variant="secondary" onClick={() => input.current?.click()}>
            Choose a calendar file
          </Button>
        </div>

        {problem ? (
          <p role="alert" className="text-sm text-[#a8503f] dark:text-[#e29b8b]">
            {problem}
          </p>
        ) : null}

        {summary ? (
          <p role="status" className="animate-rise-fade text-sm text-[var(--color-ink-muted)]">
            {summary}
          </p>
        ) : null}
      </Card>

      <Dialog
        open={events !== null}
        title="What the calendar has"
        description="Everything already on your list starts unticked, so this is about what is new."
        size="wide"
        onClose={() => setEvents(null)}
      >
        <div className="space-y-4">
          <p className="text-sm text-[var(--color-ink-muted)]">
            {events?.length ?? 0} dated {events?.length === 1 ? "item" : "items"},{" "}
            {newCount} not on your list yet.
          </p>

          <ul className="max-h-[50vh] space-y-1 overflow-y-auto">
            {events?.map((event) => {
              const already = known.has(event.uid);
              return (
                <li key={event.uid}>
                  <label
                    className={cn(
                      "flex items-start gap-3 rounded-xl px-3 py-2 text-sm",
                      already && "text-[var(--color-ink-muted)]",
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={chosen.has(event.uid)}
                      onChange={() =>
                        setChosen((current) => {
                          const next = new Set(current);
                          if (next.has(event.uid)) next.delete(event.uid);
                          else next.add(event.uid);
                          return next;
                        })
                      }
                      className="mt-0.5 size-4 shrink-0 accent-[var(--color-accent)]"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block">{event.title}</span>
                      <span className="block text-xs text-[var(--color-ink-muted)]">
                        {new Date(`${event.dueDay}T00:00:00`).toLocaleDateString(undefined, {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                        {already ? " · already on your list" : ""}
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>

          <div className="flex flex-wrap items-center gap-3 border-t border-[var(--color-border-soft)] pt-4">
            <Button variant="primary" onClick={handleImport} disabled={chosen.size === 0}>
              {chosen.size === 0
                ? "Nothing new to add"
                : `Add ${chosen.size} ${chosen.size === 1 ? "assignment" : "assignments"}`}
            </Button>
            <Button variant="ghost" onClick={() => setEvents(null)}>
              Not now
            </Button>
          </div>
        </div>
      </Dialog>
    </section>
  );
}
