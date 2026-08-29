import assert from "node:assert/strict";
import { test } from "node:test";
import { courseStanding, describeStanding, neededForTarget } from "@/lib/grades";
import type { Course, Task, TaskScore } from "@/types";

const course: Course = {
  id: "c1",
  name: "Engineering Project Management",
  code: "ENGR 502",
  instructor: "",
  meetingInfo: "",
  color: "sage",
  icon: "book",
  gradingWeights: [
    { label: "Quizzes", percent: 20 },
    { label: "Midterm Exam", percent: 30 },
    { label: "Final Exam", percent: 50 },
  ],
  createdAt: "",
  updatedAt: "",
};

function task(title: string, score?: TaskScore): Task {
  return {
    id: title,
    courseId: "c1",
    title,
    notes: "",
    dueAt: null,
    status: "todo",
    subtasks: [],
    pomodorosCompleted: 0,
    score: score ?? null,
    createdAt: "",
    updatedAt: "",
  };
}

test("splits a category's weight by how much of it has been handed back", () => {
  // Two of four quizzes marked settles half the quiz weight, not all of it.
  const tasks = [
    task("Quiz 1", { earned: 8, outOf: 10 }),
    task("Quiz 2", { earned: 9, outOf: 10 }),
    task("Quiz 3"),
    task("Quiz 4"),
  ];
  const standing = courseStanding(course, tasks);
  const quizzes = standing.categories.find((item) => item.label === "Quizzes")!;
  assert.equal(quizzes.settled, 10);
  assert.equal(quizzes.average, 85);
  assert.equal(quizzes.banked, 8.5);
});

test("averages across points rather than across papers", () => {
  // A twenty-point quiz counts twice as much as a ten-point one.
  const tasks = [
    task("Quiz 1", { earned: 10, outOf: 10 }),
    task("Quiz 2", { earned: 10, outOf: 20 }),
  ];
  const quizzes = courseStanding(course, tasks).categories.find(
    (item) => item.label === "Quizzes",
  )!;
  assert.equal(quizzes.average, (20 / 30) * 100);
});

test("says nothing at all before anything is marked", () => {
  const standing = courseStanding(course, [task("Quiz 1"), task("Midterm Exam")]);
  assert.equal(standing.standing, null);
  assert.equal(standing.banked, 0);
  assert.equal(standing.settled, 0);
  assert.equal(describeStanding(standing), null);
});

test("one bad quiz is not the whole grade", () => {
  const tasks = [
    task("Quiz 1", { earned: 4, outOf: 10 }),
    task("Quiz 2"),
    task("Quiz 3"),
    task("Quiz 4"),
    task("Midterm Exam"),
    task("Final Exam"),
  ];
  const standing = courseStanding(course, tasks);
  // 40% of a quarter of the quiz weight: two points banked of five decided.
  assert.equal(standing.settled, 5);
  assert.equal(standing.banked, 2);
  assert.equal(standing.standing, 40);
  assert.equal(standing.remaining, 95);
});

test("says what the rest of the term has to average", () => {
  const tasks = [
    task("Quiz 1", { earned: 5, outOf: 10 }),
    task("Quiz 2"),
    task("Midterm Exam"),
    task("Final Exam"),
  ];
  const standing = courseStanding(course, tasks);
  // 5 points banked of 10 settled, 90 left to play for.
  const needed = neededForTarget(standing, 85)!;
  assert.equal(standing.banked, 5);
  assert.equal(standing.remaining, 90);
  assert.equal(Math.round(needed.average), 89);
  assert.equal(needed.outOfReach, false);
  assert.equal(needed.alreadyThere, false);
});

test("says plainly when a target can no longer be reached", () => {
  const tasks = [
    task("Quiz 1", { earned: 0, outOf: 10 }),
    task("Midterm Exam", { earned: 10, outOf: 100 }),
    task("Final Exam"),
  ];
  const standing = courseStanding(course, tasks);
  assert.equal(neededForTarget(standing, 90)!.outOfReach, true);
});

test("says plainly when a target is already secured", () => {
  const tasks = [
    task("Quiz 1", { earned: 10, outOf: 10 }),
    task("Midterm Exam", { earned: 100, outOf: 100 }),
    task("Final Exam"),
  ];
  const standing = courseStanding(course, tasks);
  assert.equal(neededForTarget(standing, 40)!.alreadyThere, true);
});

test("answers nothing about the rest when there is no rest", () => {
  const tasks = [
    task("Quiz 1", { earned: 9, outOf: 10 }),
    task("Midterm Exam", { earned: 80, outOf: 100 }),
    task("Final Exam", { earned: 90, outOf: 100 }),
  ];
  const standing = courseStanding(course, tasks);
  assert.equal(standing.remaining, 0);
  assert.equal(neededForTarget(standing, 90), null);
});

test("measures against the syllabus's own total, not a flat hundred", () => {
  // A breakdown that adds to 98 is a rounding artefact, not two free points.
  const rounded: Course = {
    ...course,
    gradingWeights: [
      { label: "Quizzes", percent: 33 },
      { label: "Midterm Exam", percent: 33 },
      { label: "Final Exam", percent: 32 },
    ],
  };
  const standing = courseStanding(rounded, [
    task("Quiz 1", { earned: 10, outOf: 10 }),
    task("Midterm Exam"),
    task("Final Exam"),
  ]);
  assert.equal(standing.settled, 33);
  assert.equal(standing.remaining, 65);
});

test("ignores a mark out of nothing rather than dividing by zero", () => {
  const standing = courseStanding(course, [task("Quiz 1", { earned: 0, outOf: 0 })]);
  assert.equal(standing.standing, null);
  assert.equal(standing.settled, 0);
});

test("a category with nothing in it stays entirely to play for", () => {
  const standing = courseStanding(course, [task("Quiz 1", { earned: 10, outOf: 10 })]);
  const final = standing.categories.find((item) => item.label === "Final Exam")!;
  assert.equal(final.totalCount, 0);
  assert.equal(final.settled, 0);
});
