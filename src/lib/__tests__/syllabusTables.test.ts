import assert from "node:assert/strict";
import { test } from "node:test";
import { scheduleRows, weightRows } from "@/lib/syllabusTables";
import { DEFAULT_TERM_MONTHS } from "@/lib/syllabusDates";

const term = { start: "2026-08-24", months: DEFAULT_TERM_MONTHS };

/**
 * The lines below are how real syllabi arrive once a table has been
 * flattened — one cell per line, the date no longer beside the work.
 */

test("files a week's cells under the end of the week", () => {
  // A column too narrow for the range splits it across two lines.
  const rows = scheduleRows(
    [
      "DATE/WEEK TOPIC/SUB-TOPIC READINGS ASSIGNMENT/ ASSESSMENT(S)",
      "August 24 –",
      "August 30",
      "Project Management",
      "Introduction",
      "PM Chapter 1 • Discussion Board 1",
      "Project Assignment 1",
      "Quiz 1",
      "August 31 –",
      "September 6",
      "The Organizational",
      "Context: Strategy,",
      "PM Chapter 2 • Discussion Board 2",
    ],
    term,
  );

  assert.equal(rows.length, 2);
  assert.equal(rows[0].date.iso, "2026-08-30");
  assert.equal(rows[0].raw, "August 24 – August 30");
  assert.deepEqual(rows[0].lines.slice(-3), [
    "PM Chapter 1 • Discussion Board 1",
    "Project Assignment 1",
    "Quiz 1",
  ]);
  assert.equal(rows[1].date.iso, "2026-09-06");
});

test("keeps a single-date row on its own day", () => {
  const rows = scheduleRows(
    ["Lesson 1", "Aug 24", "Introductions", "Assignments:", "Lesson 2", "Aug 31", "Guest Speaker"],
    term,
  );
  assert.deepEqual(
    rows.map((row) => row.date.iso),
    ["2026-08-24", "2026-08-31"],
  );
});

test("stops at prose, which is not a table", () => {
  const rows = scheduleRows(
    [
      "Aug 24",
      "Quiz 1",
      "Each week this semester will have its own learning module that you will need to complete. Simply select the Modules link in the course menu and you will be taken to the page where you can access them, which is where everything for the week lives.",
      "Discussion Board 9",
    ],
    term,
  );
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0].lines, ["Quiz 1"]);
});

test("does not treat a sentence that mentions a date as a row heading", () => {
  const rows = scheduleRows(
    ["There will be a midterm exam on October 19 in the usual room.", "Quiz 4"],
    term,
  );
  assert.deepEqual(rows, []);
});

test("puts a breakdown row back together from one cell per line", () => {
  assert.deepEqual(
    weightRows(["Item", "Points", "Weightage", "Homework", "75", "15%", "Project 1", "150", "30%"]),
    ["Homework 75 15%", "Project 1 150 30%"],
  );
});

test("rejoins a label the column wrapped", () => {
  assert.deepEqual(
    weightRows(["Project Management Plan", "(PMP) & Presentation", "10 10%"]),
    ["Project Management Plan (PMP) & Presentation 10 10%"],
  );
});

test("leaves a sentence that merely mentions a percentage alone", () => {
  assert.deepEqual(weightRows(["Lecture: Prof. Marzolf – Chapters 3 & 12 (100% Virtual)"]), []);
});
