import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DEFAULT_TERM_MONTHS,
  findDates,
  findFirstDate,
  guessTermStart,
  type TermWindow,
} from "../syllabusDates.ts";

/** A Fall term, so year rollover into January is exercised throughout. */
const FALL: TermWindow = { start: "2026-08-24", months: DEFAULT_TERM_MONTHS };
const SPRING: TermWindow = { start: "2026-01-12", months: DEFAULT_TERM_MONTHS };

const iso = (line: string, term = FALL) => findFirstDate(line, term)?.iso ?? null;

test("reads month-name dates in the usual shapes", () => {
  assert.equal(iso("Midterm on Oct 12"), "2026-10-12");
  assert.equal(iso("Midterm on October 12"), "2026-10-12");
  assert.equal(iso("Midterm on Oct. 12"), "2026-10-12");
  assert.equal(iso("Midterm on October 12th"), "2026-10-12");
  assert.equal(iso("Midterm on Tue, October 12"), "2026-10-12");
  assert.equal(iso("Midterm on Tuesday October 12, 2026"), "2026-10-12");
});

test("reads Sept as September, not as some other month", () => {
  assert.equal(iso("Paper due Sept 3"), "2026-09-03");
  assert.equal(iso("Paper due Sep 3"), "2026-09-03");
  assert.equal(iso("Paper due September 3"), "2026-09-03");
});

test("reads day-first dates", () => {
  assert.equal(iso("Essay due 12 October"), "2026-10-12");
  assert.equal(iso("Essay due 12 October 2026"), "2026-10-12");
});

test("reads slash dates as month/day, with an explicit year when given", () => {
  assert.equal(iso("Quiz 10/12"), "2026-10-12");
  assert.equal(iso("Quiz 10/12/26"), "2026-10-12");
  assert.equal(iso("Quiz 10/12/2026"), "2026-10-12");
});

test("falls back to day/month when the first number cannot be a month", () => {
  // 25 is not a month, so this can only be 25 October.
  assert.equal(iso("Quiz 25/10"), "2026-10-25");
});

test("reads ISO dates without a later pattern stealing part of them", () => {
  const matches = findDates("Final exam 2026-12-14 in the usual room", FALL);
  assert.equal(matches.length, 1);
  assert.equal(matches[0].iso, "2026-12-14");
  assert.equal(matches[0].raw, "2026-12-14");
});

test("rolls a bare date into the next year when the term crosses one", () => {
  // A Fall 2026 syllabus saying "Jan 20" means January 2027.
  assert.equal(iso("Final paper due Jan 20"), "2027-01-20");
  // The same text on a Spring 2026 syllabus means January 2026.
  assert.equal(iso("Final paper due Jan 20", SPRING), "2026-01-20");
});

test("resolves week numbers against the term start", () => {
  assert.equal(iso("Week 1: introduction"), "2026-08-24");
  assert.equal(iso("Week 4: attention"), "2026-09-14");
  assert.equal(findFirstDate("Week 4", FALL)?.kind, "week");
});

test("rejects impossible dates rather than rolling them over", () => {
  assert.equal(iso("Nothing on Feb 30"), null);
  assert.equal(iso("Nothing on 13/45"), null);
});

test("finds several dates in one line, in order", () => {
  const matches = findDates("Midterm Oct 12, final exam Dec 14", FALL);
  assert.deepEqual(matches.map((m) => m.iso), ["2026-10-12", "2026-12-14"]);
});

test("takes the first date of a range", () => {
  assert.equal(iso("Reading week Oct 12-16"), "2026-10-12");
});

test("finds nothing in a line with no date", () => {
  assert.deepEqual(findDates("Office hours by appointment", FALL), []);
  assert.equal(iso("Chapter 4 covers span tasks"), null);
});

test("does not read a decimal or a section number as a date", () => {
  assert.equal(iso("The mean was 3.5 overall"), null);
  assert.equal(iso("See section 2.1 for details"), null);
});

test("guesses a plausible term start either side of the year", () => {
  assert.equal(guessTermStart(new Date("2026-02-10T00:00:00Z")), "2026-01-15");
  assert.equal(guessTermStart(new Date("2026-09-10T00:00:00Z")), "2026-08-25");
});
