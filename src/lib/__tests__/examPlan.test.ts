import assert from "node:assert/strict";
import { test } from "node:test";
import { looksLikeAnExam, revisionDays, revisionSteps } from "@/lib/examPlan";
import type { Course, Task } from "@/types";

const EXAM = "2026-10-25";
const TODAY = "2026-10-01";

const course: Course = {
  id: "c1",
  name: "Engineering Project Management",
  code: "ENGR 502",
  instructor: "",
  meetingInfo: "",
  color: "sage",
  icon: "book",
  termStart: "2026-08-24",
  termEnd: "2026-12-11",
  // Tuesday evenings.
  meetingPattern: { days: [2], startTime: "17:15", endTime: "20:00", location: "" },
  createdAt: "",
  updatedAt: "",
};

function task(title: string, dueAt: string | null = EXAM): Task {
  return {
    id: title,
    courseId: "c1",
    title,
    notes: "",
    dueAt,
    status: "todo",
    subtasks: [],
    pomodorosCompleted: 0,
    createdAt: "",
    updatedAt: "",
  };
}

test("recognises the things that want a run-up", () => {
  assert.equal(looksLikeAnExam(task("Midterm Exam")), true);
  assert.equal(looksLikeAnExam(task("Final Exam")), true);
  assert.equal(looksLikeAnExam(task("Quiz 7")), true);
  assert.equal(looksLikeAnExam(task("Discussion Board 4")), false);
  assert.equal(looksLikeAnExam(task("Project Assignment 2")), false);
});

test("wants a date before it will plan anything", () => {
  assert.equal(looksLikeAnExam(task("Final Exam", null)), false);
  assert.deepEqual(revisionSteps(task("Final Exam", null), { sessions: 3, from: TODAY }), []);
});

test("counts backwards from the exam, in order, never on the day itself", () => {
  const days = revisionDays(EXAM, { sessions: 4, from: TODAY });
  assert.deepEqual(days, ["2026-10-18", "2026-10-21", "2026-10-23", "2026-10-24"]);
  assert.ok(days.every((day) => day < EXAM));
});

test("never plans a sitting on a day already gone", () => {
  // Four days out: only three of the six offsets are still in the future.
  const days = revisionDays(EXAM, { sessions: 6, from: "2026-10-21" });
  assert.ok(days.every((day) => day >= "2026-10-21"));
  assert.deepEqual(days, ["2026-10-21", "2026-10-23", "2026-10-24"]);
});

test("plans nothing when the exam is today or behind", () => {
  assert.deepEqual(revisionDays(EXAM, { sessions: 4, from: EXAM }), []);
  assert.deepEqual(revisionDays(EXAM, { sessions: 4, from: "2026-11-01" }), []);
});

test("prefers a free evening over a class night", () => {
  // 20 Oct 2026 is a Tuesday, when this course meets.
  const days = revisionDays(EXAM, { sessions: 4, from: TODAY, courses: [course] });
  assert.ok(!days.includes("2026-10-20"));
  assert.equal(days.length, 4);
});

test("takes a class night rather than planning fewer sittings", () => {
  const days = revisionDays(EXAM, { sessions: 6, from: TODAY, courses: [course] });
  assert.equal(days.length, 6);
});

test("names each sitting rather than saying study", () => {
  let n = 0;
  const steps = revisionSteps(task("Midterm Exam"), { sessions: 3, from: TODAY }, () => `s${n++}`);
  assert.equal(steps.length, 3);
  assert.match(steps[0].title, /First pass/);
  assert.match(steps[2].title, /Last look/);
  assert.ok(steps.every((step) => step.title.length > 10));
});

test("gives every sitting its own id and its own day", () => {
  let n = 0;
  const steps = revisionSteps(task("Final Exam"), { sessions: 4, from: TODAY }, () => `s${n++}`);
  assert.equal(new Set(steps.map((s) => s.id)).size, 4);
  assert.equal(new Set(steps.map((s) => s.plannedFor)).size, 4);
});
