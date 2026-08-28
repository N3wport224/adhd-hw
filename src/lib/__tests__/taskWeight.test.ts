import assert from "node:assert/strict";
import { test } from "node:test";
import { describeShare, gradeShareOf, taskShareOf } from "@/lib/taskWeight";
import type { Course, Task } from "@/types";

const course: Course = {
  id: "c1",
  name: "Engineering Project Management",
  code: "ENGR 502",
  instructor: "",
  meetingInfo: "",
  color: "sage",
  icon: "book",
  gradingWeights: [
    { label: "Discussion Boards", percent: 14 },
    { label: "Project Assignments", percent: 13 },
    { label: "Quizzes", percent: 13 },
    { label: "Midterm Exam", percent: 25 },
    { label: "Final Exam", percent: 25 },
  ],
  createdAt: "",
  updatedAt: "",
};

function task(title: string): Task {
  return {
    id: title,
    courseId: "c1",
    title,
    notes: "",
    dueAt: null,
    status: "todo",
    subtasks: [],
    pomodorosCompleted: 0,
    createdAt: "",
    updatedAt: "",
  };
}

test("matches a task to its grading category through the plural", () => {
  assert.equal(gradeShareOf(task("Quiz 7"), course), 13);
  assert.equal(gradeShareOf(task("Project Assignment 3"), course), 13);
  assert.equal(gradeShareOf(task("Discussion Board 12"), course), 14);
  assert.equal(gradeShareOf(task("Midterm Exam"), course), 25);
});

test("claims nothing when the words do not match", () => {
  assert.equal(gradeShareOf(task("Read Chapter 4"), course), null);
  assert.equal(gradeShareOf(task("Quiz 1"), null), null);
});

test("splits a category across the work inside it", () => {
  // Thirteen quizzes worth thirteen percent are one percent each. Calling a
  // single quiz "13%" would be a lie in the direction that causes panic.
  const quizzes = Array.from({ length: 13 }, (_, i) => task(`Quiz ${i + 1}`));
  assert.equal(taskShareOf(quizzes[0], course, quizzes), 1);

  // A final sits alone in its category and keeps all of it.
  const final = task("Final Exam");
  assert.equal(taskShareOf(final, course, [...quizzes, final]), 25);
});

test("only says it when it is big enough to change a decision", () => {
  assert.equal(describeShare(25), "worth 25% of the grade");
  assert.equal(describeShare(1), null);
  assert.equal(describeShare(null), null);
});
