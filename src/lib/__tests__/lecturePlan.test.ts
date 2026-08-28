import assert from "node:assert/strict";
import { test } from "node:test";
import { lectureTaskDrafts, lectureWeeks, plannedLectureWeeks } from "@/lib/lecturePlan";
import type { Course, Task, Weekday } from "@/types";

function course(overrides: Partial<Course> = {}): Course {
  return {
    id: "c1",
    name: "Cognitive Psychology",
    code: "PSY 310",
    instructor: "",
    meetingInfo: "",
    color: "sage",
    icon: "book",
    termStart: "2026-09-07", // a Monday
    termEnd: "2026-09-25",
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

const mwf = {
  days: [1, 3, 5] as Weekday[],
  startTime: "09:30",
  endTime: "10:45",
  location: "Kemeny 007",
};

test("numbers weeks from the one the term starts in", () => {
  const weeks = lectureWeeks(course({ meetingPattern: mwf }));
  assert.deepEqual(
    weeks.map((week) => week.weekNumber),
    [1, 2, 3],
  );
  assert.deepEqual(weeks[0].sessions, ["2026-09-07", "2026-09-09", "2026-09-11"]);
  assert.equal(weeks[0].weekStart, "2026-09-06");
});

test("clips the first and last weeks to the term", () => {
  // Term starts on a Wednesday and ends on a Tuesday, so the weeks either
  // end are partial.
  const weeks = lectureWeeks(
    course({ termStart: "2026-09-09", termEnd: "2026-09-22", meetingPattern: mwf }),
  );
  assert.deepEqual(weeks[0].sessions, ["2026-09-09", "2026-09-11"]);
  assert.deepEqual(weeks.at(-1)?.sessions, ["2026-09-21"]);
});

test("skips weeks the class does not meet in", () => {
  const weeks = lectureWeeks(
    course({
      termStart: "2026-09-07",
      termEnd: "2026-09-25",
      meetingPattern: { ...mwf, days: [2] as Weekday[] },
    }),
  );
  assert.equal(weeks.length, 3);
  assert.deepEqual(weeks.map((week) => week.sessions.length), [1, 1, 1]);
});

test("still plans a week for a course with no meeting days", () => {
  const weeks = lectureWeeks(course({ meetingPattern: null }));
  assert.equal(weeks.length, 3);
  // One a week, on the Monday.
  assert.deepEqual(weeks[0].sessions, ["2026-09-07"]);
});

test("plans nothing without a term start", () => {
  assert.deepEqual(lectureWeeks(course({ termStart: null })), []);
});

test("assumes a term length when only the start is known", () => {
  const weeks = lectureWeeks(course({ termEnd: null, meetingPattern: mwf }));
  // Four months of a Monday/Wednesday/Friday class, not an endless one.
  assert.ok(weeks.length > 14 && weeks.length < 20, `got ${weeks.length} weeks`);
});

test("builds one task a week, with a step for each class", () => {
  const drafts = lectureTaskDrafts(course({ meetingPattern: mwf }));
  assert.equal(drafts.length, 3);

  const first = drafts[0];
  assert.equal(first.title, "Week 1 lectures");
  assert.equal(first.courseId, "c1");
  assert.equal(first.notes, "In Kemeny 007.");
  assert.deepEqual(
    first.subtasks.map((step) => step.title),
    // Which lecture, not which weekday: for a course whose lectures are
    // watched as recordings, the day it was given is not the day you watch it.
    ["Lecture 1 of 3", "Lecture 2 of 3", "Lecture 3 of 3"],
  );
  assert.deepEqual(
    first.subtasks.map((step) => step.plannedFor),
    ["2026-09-07", "2026-09-09", "2026-09-11"],
  );
  // Every step is 75 minutes, from the 9:30–10:45 slot.
  assert.deepEqual(first.subtasks.map((step) => step.estimatedMinutes), [75, 75, 75]);
});

test("gives every step an id of its own", () => {
  // A step is addressed by id when it is ticked off. Sharing one — or having
  // none — means ticking a lecture marks a different one done.
  const drafts = lectureTaskDrafts(course({ meetingPattern: mwf }));
  const ids = drafts.flatMap((draft) => draft.subtasks.map((step) => step.id));
  assert.equal(ids.length, 9);
  assert.ok(
    ids.every((id) => typeof id === "string" && id.length > 0),
    "every step needs an id",
  );
  assert.equal(new Set(ids).size, ids.length, "ids must be distinct");
});

test("falls due on the last class of the week", () => {
  const [first] = lectureTaskDrafts(course({ meetingPattern: mwf }));
  assert.equal(first.dueAt, new Date("2026-09-11T00:00:00").toISOString());
});

test("names the step for what it is when the class does not meet", () => {
  const [first] = lectureTaskDrafts(course({ meetingPattern: null }));
  assert.deepEqual(first.subtasks.map((step) => step.title), ["Watch this week's lectures"]);
});

test("tags each task with the week it covers", () => {
  const drafts = lectureTaskDrafts(course({ meetingPattern: mwf }));
  assert.deepEqual(
    drafts.map((draft) => draft.source),
    [
      { kind: "lectures", weekStart: "2026-09-06" },
      { kind: "lectures", weekStart: "2026-09-13" },
      { kind: "lectures", weekStart: "2026-09-20" },
    ],
  );
});

test("reports which weeks a course already has", () => {
  const tasks: Task[] = [
    {
      id: "t1",
      courseId: "c1",
      title: "Week 1 lectures",
      notes: "",
      dueAt: null,
      status: "todo",
      subtasks: [],
      pomodorosCompleted: 0,
      source: { kind: "lectures", weekStart: "2026-09-06" },
      createdAt: "",
      updatedAt: "",
    },
    {
      id: "t2",
      courseId: "c2",
      title: "Week 1 lectures",
      notes: "",
      dueAt: null,
      status: "todo",
      subtasks: [],
      pomodorosCompleted: 0,
      source: { kind: "lectures", weekStart: "2026-09-13" },
      createdAt: "",
      updatedAt: "",
    },
  ];
  assert.deepEqual([...plannedLectureWeeks(tasks, "c1")], ["2026-09-06"]);
});
