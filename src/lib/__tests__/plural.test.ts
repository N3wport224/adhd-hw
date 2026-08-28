import assert from "node:assert/strict";
import { test } from "node:test";
import { plural } from "@/lib/utils";

test("pluralises the words a syllabus actually counts", () => {
  // A naive "+ s" produced "5 × Quizs" on a real import.
  assert.equal(plural("Quiz", 5), "Quizzes");
  assert.equal(plural("Quiz", 1), "Quiz");
  assert.equal(plural("Project Assignment", 13), "Project Assignments");
  assert.equal(plural("Midterm Exam", 2), "Midterm Exams");
  assert.equal(plural("Essay", 3), "Essays");
  assert.equal(plural("Case Study", 3), "Case Studies");
});

test("leaves a word that is already plural alone", () => {
  assert.equal(plural("Discussion Boards", 14), "Discussion Boards");
  assert.equal(plural("Quizzes", 13), "Quizzes");
});
