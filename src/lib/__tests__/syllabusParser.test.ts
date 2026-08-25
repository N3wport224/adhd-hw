import assert from "node:assert/strict";
import { test } from "node:test";
import { parseSyllabus } from "../syllabusParser.ts";

const TERM = { termStart: "2026-08-24" };

const parse = (paragraphs: string[]) => parseSyllabus(paragraphs, TERM);
const titles = (paragraphs: string[]) => parse(paragraphs).assignments.map((a) => a.title);

test("pairs a deliverable with its date", () => {
  const [assignment] = parse(["Midterm exam on October 12."]).assignments;
  assert.equal(assignment.title, "Midterm exam");
  assert.equal(assignment.dueAt, "2026-10-12");
  assert.equal(assignment.kind, "exam");
  assert.equal(assignment.rawDate, "October 12");
});

test("keeps the date out of the title", () => {
  assert.deepEqual(titles(["Final paper due December 12"]), ["Final paper"]);
  assert.deepEqual(titles(["10/12 — Problem set 3 due"]), ["Problem set 3"]);
});

test("strips week and weekday prefixes from titles", () => {
  assert.deepEqual(
    titles(["Week 3: Problem set 1 due Sept 7"]),
    ["Problem set 1"],
  );
  assert.deepEqual(
    titles(["Tuesday, Oct 12 — Midterm exam"]),
    ["Midterm exam"],
  );
});

test("drops a trailing weekday once the date is resolved", () => {
  assert.deepEqual(titles(["Week 3: problem set 2 due Friday."]), ["Week 3 — Problem set 2"]);
});

test("reads a grading label that contains a number", () => {
  const result = parse(["Grading", "Midterm 1 ...... 20%", "Midterm 2 ...... 20%"]);
  assert.deepEqual(result.gradingWeights, [
    { label: "Midterm 1", percent: 20 },
    { label: "Midterm 2", percent: 20 },
  ]);
});

test("names an assignment from what precedes the date, not what follows it", () => {
  assert.deepEqual(titles(["Midterm 1 will be held on 10/07 in the usual room."]), ["Midterm 1"]);
  assert.deepEqual(titles(["The final exam is scheduled for 2026-12-11."]), ["The final exam"]);
});

test("prefers a written date over a week number in the same line", () => {
  const [assignment] = parse(["Week 3: Problem set 1 due Sept 7"]).assignments;
  assert.equal(assignment.dueAt, "2026-09-07");
  assert.equal(assignment.confidence, "high");
});

test("labels week-derived rows with their week, so they stay distinguishable", () => {
  const result = parse([
    "Week 1: read the assigned chapter and submit the problem set.",
    "Week 2: read the assigned chapter and submit the problem set.",
  ]);
  assert.deepEqual(result.assignments.map((a) => a.title), [
    "Week 1 — Read the assigned chapter and submit the problem set",
    "Week 2 — Read the assigned chapter and submit the problem set",
  ]);
  assert.deepEqual(result.assignments.map((a) => a.dueAt), ["2026-08-24", "2026-08-31"]);
});

test("takes only the sentence carrying the date, not the whole paragraph", () => {
  const [assignment] = parse([
    "The final paper is due on December 12. It should be roughly 3.5 thousand words and cite at least eight peer-reviewed sources.",
  ]).assignments;
  assert.equal(assignment.title, "The final paper");
  assert.match(assignment.excerpt, /peer-reviewed sources/);
});

test("ignores a date with nothing to make it an assignment", () => {
  assert.deepEqual(parse(["No class on Nov 26 for the holiday."]).assignments, []);
  assert.deepEqual(parse(["The 3rd edition was published in 2019."]).assignments, []);
});

test("keeps a dated line that says due even without a keyword it knows", () => {
  const [assignment] = parse(["Reflection journal due Oct 5"]).assignments;
  assert.equal(assignment.dueAt, "2026-10-05");
});

test("splits a line that lists several dated items", () => {
  const result = parse(["Midterm Oct 12, final exam Dec 14"]);
  assert.deepEqual(result.assignments.map((a) => [a.title, a.dueAt]), [
    ["Midterm", "2026-10-12"],
    ["Final exam", "2026-12-14"],
  ]);
});

test("does not split a single-date line at its commas", () => {
  assert.deepEqual(
    titles(["The final paper, worth 30% of your grade, is due December 12"]),
    ["The final paper, worth 30% of your grade"],
  );
});

test("sorts assignments by date, undated last", () => {
  const result = parse([
    "Final exam Dec 14",
    "Quiz 1 due Sept 7",
    "Midterm exam Oct 12",
  ]);
  assert.deepEqual(result.assignments.map((a) => a.dueAt), [
    "2026-09-07",
    "2026-10-12",
    "2026-12-14",
  ]);
});

test("drops a duplicate that appears in both a table and prose", () => {
  const result = parse(["Midterm exam Oct 12", "Midterm exam Oct 12"]);
  assert.equal(result.assignments.length, 1);
});

test("scores confidence by how much the line supports it", () => {
  const strongAndDue = parse(["Final paper due December 12"]).assignments[0];
  const strongOnly = parse(["Midterm exam October 12"]).assignments[0];
  const weekBased = parse(["Week 4: read Chapter 4"]).assignments[0];
  assert.equal(strongAndDue.confidence, "high");
  assert.equal(strongOnly.confidence, "medium");
  assert.equal(weekBased.confidence, "low");
});

test("reads a grading breakdown written as a sentence", () => {
  const result = parse([
    "Grading breakdown: participation 10%, two midterms 40%, final paper 30%, weekly problem sets 20%.",
  ]);
  assert.deepEqual(result.gradingWeights, [
    { label: "Participation", percent: 10 },
    { label: "Two midterms", percent: 40 },
    { label: "Final paper", percent: 30 },
    { label: "Weekly problem sets", percent: 20 },
  ]);
  assert.deepEqual(result.warnings, []);
});

test("reads a grading breakdown written as a list under a heading", () => {
  const result = parse([
    "Grading",
    "Participation: 10%",
    "Midterms: 40%",
    "Final paper: 30%",
    "Problem sets: 20%",
  ]);
  assert.deepEqual(
    result.gradingWeights.map((w) => [w.label, w.percent]),
    [["Participation", 10], ["Midterms", 40], ["Final paper", 30], ["Problem sets", 20]],
  );
});

test("reads dot-leader and percent-first shapes", () => {
  const dots = parse(["Grading", "Midterm ............ 25%"]).gradingWeights;
  assert.deepEqual(dots, [{ label: "Midterm", percent: 25 }]);

  const first = parse(["Grading", "25% midterm exam"]).gradingWeights;
  assert.deepEqual(first, [{ label: "Midterm exam", percent: 25 }]);
});

test("ignores percentages that are rules rather than grade shares", () => {
  const result = parse([
    "Grading: midterm 50%, final 50%.",
    "Late work loses 5% per day, up to 3 days.",
  ]);
  assert.deepEqual(result.gradingWeights.map((w) => w.percent), [50, 50]);
});

test("warns when the weights do not add up", () => {
  const result = parse(["Grading: midterm 40%, final 30%."]);
  assert.equal(result.warnings.length, 1);
  assert.match(result.warnings[0], /70%/);
});

test("recognises a syllabus, and declines to call a reading one", () => {
  assert.equal(parse(["Course syllabus", "Office hours by appointment."]).looksLikeSyllabus, true);
  assert.equal(parse(["Grading: midterm 50%, final 50%."]).looksLikeSyllabus, true);
  assert.equal(
    parse(["Attention is the process by which the mind selects among inputs."]).looksLikeSyllabus,
    false,
  );
});

test("returns an empty result for an empty document", () => {
  const result = parse([]);
  assert.deepEqual(result.assignments, []);
  assert.deepEqual(result.gradingWeights, []);
  assert.equal(result.looksLikeSyllabus, false);
  assert.deepEqual(result.warnings, []);
});

test("resolves dates against the term start it was given", () => {
  const fall = parseSyllabus(["Final paper due Jan 20"], { termStart: "2026-08-24" });
  const spring = parseSyllabus(["Final paper due Jan 20"], { termStart: "2026-01-12" });
  assert.equal(fall.assignments[0].dueAt, "2027-01-20");
  assert.equal(spring.assignments[0].dueAt, "2026-01-20");
});

test("truncates a runaway title instead of storing a paragraph", () => {
  const long = `Read the assigned chapter ${"and take careful notes ".repeat(10)} due Oct 12`;
  const [assignment] = parse([long]).assignments;
  assert.ok(assignment.title.length <= 81, `title was ${assignment.title.length} chars`);
  assert.ok(assignment.title.endsWith("…"));
});
