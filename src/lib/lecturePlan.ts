import { addDays, startOfWeek, termBounds, toDayKey } from "@/lib/schedule";
import type { Course, SubTask, Task, TaskDraft, Weekday } from "@/types";

/** One week of term, and the days this course actually meets inside it. */
export interface LectureWeek {
  /** 1 for the week the term starts in. */
  weekNumber: number;
  /** Sunday of that week, as a local day key — the identity of the week. */
  weekStart: string;
  /** Days the class meets, already clipped to the term. */
  sessions: string[];
}

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

/** Where a week's lecture lands when the course has no meeting days on file. */
const ASYNC_WEEKDAY = 1;

/** A guess at how long a lecture takes when the syllabus gave no times. */
const DEFAULT_LECTURE_MINUTES = 60;

function minutesBetween(startTime: string | null, endTime: string | null) {
  if (!startTime || !endTime) return DEFAULT_LECTURE_MINUTES;
  const [startHour, startMinute] = startTime.split(":").map(Number);
  const [endHour, endMinute] = endTime.split(":").map(Number);
  const span = endHour * 60 + endMinute - (startHour * 60 + startMinute);
  return span > 0 ? span : DEFAULT_LECTURE_MINUTES;
}

/**
 * Every week of a course's term, with the class meetings in each.
 *
 * Weeks run Sunday to Saturday like the rest of the app, and are numbered
 * from the week the term starts in — so "week 3" here means what a syllabus
 * means by it.
 *
 * A course with no meeting days still gets a week each: plenty of courses
 * post recordings instead of meeting, and "watch this week's lectures" is
 * exactly the thing that slides when nothing on a calendar says to.
 */
export function lectureWeeks(course: Course): LectureWeek[] {
  const bounds = termBounds(course);
  if (!bounds) return [];

  const days = course.meetingPattern?.days ?? [];
  const meets = days.length > 0 ? days : [ASYNC_WEEKDAY as Weekday];

  const weeks: LectureWeek[] = [];
  let cursor = startOfWeek(new Date(`${bounds.start}T00:00:00`));
  let weekNumber = 1;

  while (toDayKey(cursor) <= bounds.end) {
    const sessions: string[] = [];
    for (let offset = 0; offset < 7; offset += 1) {
      const day = addDays(cursor, offset);
      if (!meets.includes(day.getDay() as Weekday)) continue;
      const key = toDayKey(day);
      // The first and last weeks of term are usually partial.
      if (key < bounds.start || key > bounds.end) continue;
      sessions.push(key);
    }

    if (sessions.length > 0) {
      weeks.push({ weekNumber, weekStart: toDayKey(cursor), sessions });
    }
    cursor = addDays(cursor, 7);
    weekNumber += 1;
  }

  return weeks;
}

/**
 * "Monday's lecture" — the weekday and nothing else.
 *
 * The time is deliberately left out. It is already on the class block sitting
 * directly above the step in the week view, and on the course header; adding
 * it here only pushed the title past what a calendar chip can show, so every
 * lecture read as "Monday's lecture, 10:0…". The weekday is what tells the
 * three steps of a week apart.
 */
function sessionTitle(dayKey: string, synchronous: boolean) {
  if (!synchronous) return "Watch this week's lectures";
  return `${DAY_NAMES[new Date(`${dayKey}T00:00:00`).getDay()]}'s lecture`;
}

/**
 * A task per week of term: "Week 3 lectures", with a step for each class.
 *
 * One task a week rather than one a class. Three sessions across five
 * courses is fifteen separate things in a list, which is the wall of items
 * this app exists to avoid — but a week is too coarse to act on, so the
 * sessions live on as steps, each already carrying the day it belongs to.
 * That is the same machinery assignments use, so a lecture shows up in
 * Focus on the day it happens and strikes through when it is done.
 */
export function lectureTaskDrafts(course: Course): TaskDraft[] {
  const synchronous = (course.meetingPattern?.days.length ?? 0) > 0;
  const estimatedMinutes = synchronous
    ? minutesBetween(
        course.meetingPattern?.startTime ?? null,
        course.meetingPattern?.endTime ?? null,
      )
    : DEFAULT_LECTURE_MINUTES;

  const location = course.meetingPattern?.location ?? "";

  return lectureWeeks(course).map((week) => {
    const subtasks: Omit<SubTask, "id">[] = week.sessions.map((dayKey) => ({
      title: sessionTitle(dayKey, synchronous),
      done: false,
      estimatedMinutes,
      plannedFor: dayKey,
    }));

    // Due on the last class of the week, so a week's lectures stop being
    // "coming up" the moment the last one has been and gone.
    const lastSession = week.sessions[week.sessions.length - 1];

    return {
      courseId: course.id,
      title: `Week ${week.weekNumber} lectures`,
      notes: location ? `In ${location}.` : "",
      dueAt: new Date(`${lastSession}T00:00:00`).toISOString(),
      status: "todo" as const,
      // Ids are assigned by the store on the way in.
      subtasks: subtasks as SubTask[],
      source: { kind: "lectures" as const, weekStart: week.weekStart },
    };
  });
}

/** Weeks a course already has a lecture task for. */
export function plannedLectureWeeks(tasks: Task[], courseId: string) {
  return new Set(
    tasks
      .filter((task) => task.courseId === courseId && task.source?.kind === "lectures")
      .map((task) => (task.source?.kind === "lectures" ? task.source.weekStart : "")),
  );
}
