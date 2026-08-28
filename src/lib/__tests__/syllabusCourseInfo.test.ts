import assert from "node:assert/strict";
import { test } from "node:test";
import {
  describeMeetingPattern,
  formatClockTime,
  formatTimeRange,
  parseCourseDetails,
  parseTimeRange,
  parseWeekdays,
} from "@/lib/syllabusCourseInfo";

test("reads spelled-out and abbreviated weekday lists", () => {
  assert.deepEqual(parseWeekdays("Tuesday and Thursday"), [2, 4]);
  assert.deepEqual(parseWeekdays("Tue, Thu"), [2, 4]);
  assert.deepEqual(parseWeekdays("Mon / Wed / Fri"), [1, 3, 5]);
  assert.deepEqual(parseWeekdays("Monday, Wednesday & Friday"), [1, 3, 5]);
});

test("reads compressed timetable codes", () => {
  assert.deepEqual(parseWeekdays("MWF"), [1, 3, 5]);
  assert.deepEqual(parseWeekdays("TuTh"), [2, 4]);
  assert.deepEqual(parseWeekdays("MW"), [1, 3]);
  // Th must win over T-then-H.
  assert.deepEqual(parseWeekdays("Th"), [4]);
});

test("does not read ordinary words as day codes", () => {
  assert.deepEqual(parseWeekdays("meets in the usual room"), []);
  assert.deepEqual(parseWeekdays("Attendance is required"), []);
});

test("returns days once, in week order", () => {
  assert.deepEqual(parseWeekdays("Friday, Monday, Friday"), [1, 5]);
});

test("reads a time range with a meridiem on both ends", () => {
  assert.deepEqual(parseTimeRange("9:30am - 10:45am"), {
    startTime: "09:30",
    endTime: "10:45",
  });
});

test("borrows a meridiem written only once", () => {
  assert.deepEqual(parseTimeRange("2-4pm"), { startTime: "14:00", endTime: "16:00" });
  assert.deepEqual(parseTimeRange("9:30 - 10:45 a.m."), {
    startTime: "09:30",
    endTime: "10:45",
  });
});

test("carries a morning start into an afternoon end", () => {
  // "11:00am to 1:00pm" — the end is explicitly pm.
  assert.deepEqual(parseTimeRange("11:00am to 1:00pm"), {
    startTime: "11:00",
    endTime: "13:00",
  });
  // "11:00 to 1:00" with one meridiem cannot mean going backwards.
  assert.deepEqual(parseTimeRange("11:00 to 1:00 pm"), {
    startTime: "11:00",
    endTime: "13:00",
  });
});

test("reads a 24-hour range", () => {
  assert.deepEqual(parseTimeRange("14:00–15:15"), { startTime: "14:00", endTime: "15:15" });
});

test("reads a lone start time", () => {
  assert.deepEqual(parseTimeRange("class begins at 9:30am"), {
    startTime: "09:30",
    endTime: null,
  });
});

test("finds no time where there is none", () => {
  assert.equal(parseTimeRange("meets Tuesday and Thursday"), null);
});

test("pulls instructor, meeting pattern and office hours off a syllabus", () => {
  const details = parseCourseDetails([
    "PSY 310 — Cognitive Psychology",
    "Instructor: Dr. Okonkwo. Office hours are Tue and Thu, 11:00am to 1:00pm, in Ross Hall 214.",
    "Class meets Monday, Wednesday and Friday, 9:30am - 10:45am in Kemeny 007.",
  ]);
  assert.equal(details.instructor, "Dr. Okonkwo");
  assert.deepEqual(details.meetingPattern, {
    days: [1, 3, 5],
    startTime: "09:30",
    endTime: "10:45",
    location: "Kemeny 007",
  });
  assert.match(details.officeHours ?? "", /Tue and Thu/);
});

test("reads the labels a timetable actually uses", () => {
  // Every one of these lost its class times before: the plural labels did not
  // match, and "Wednesdays" was not a weekday.
  const cases: Array<[string, number[], string]> = [
    ["Lectures: Mon, Wed, Fri 10:00-11:15, Moore 110", [1, 3, 5], "Moore 110"],
    ["Seminars: Wednesdays 3:00-5:00pm, Haldeman 41", [3], "Haldeman 41"],
    ["Classes: Tue/Thu 11:00-12:15", [2, 4], ""],
    ["Lectures MWF 9-9:50am Rockefeller 3", [1, 3, 5], "Rockefeller 3"],
    ["Meeting times: TuTh 2-3:15pm, Baker 23", [2, 4], "Baker 23"],
  ];

  for (const [line, days, location] of cases) {
    const pattern = parseCourseDetails([line]).meetingPattern;
    assert.deepEqual(pattern?.days, days, line);
    assert.equal(pattern?.location, location, line);
  }
});

test("finds the room when extraction ran the next line into the meeting line", () => {
  // A syllabus that writes its headings in bold at body size gives one
  // paragraph, not two, so the room is mid-line rather than at the end.
  const pattern = parseCourseDetails([
    "Lectures: Mon, Wed, Fri 10:00-11:15, Moore 110 Course description This course surveys attention.",
  ]).meetingPattern;
  assert.equal(pattern?.location, "Moore 110");
});

test("does not read whatever followed the time as a room", () => {
  for (const line of [
    "Lectures: Mon, Wed, Fri 10:00-11:15 Week 6 begins here",
    "Class meets Tue 2-4pm and covers Chapter 3 of the text",
  ]) {
    assert.equal(parseCourseDetails([line]).meetingPattern?.location, "", line);
  }
});

test("does not read a weekday at the end of a line as a room", () => {
  const pattern = parseCourseDetails(["Lectures: 10:00-11:15 Monday"]).meetingPattern;
  assert.equal(pattern?.location, "");
});

test("does not mistake office hours for when the class meets", () => {
  const details = parseCourseDetails([
    "Office hours: Wednesday 2-4pm, Kemeny 318.",
  ]);
  assert.equal(details.meetingPattern, null);
  assert.match(details.officeHours ?? "", /Wednesday 2-4pm/);
});

test("fills in what it can when the syllabus is partial", () => {
  const daysOnly = parseCourseDetails(["Lecture meets TuTh."]);
  assert.deepEqual(daysOnly.meetingPattern?.days, [2, 4]);
  assert.equal(daysOnly.meetingPattern?.startTime, null);

  const nameOnly = parseCourseDetails(["Professor Ada Vance"]);
  assert.equal(nameOnly.instructor, "Ada Vance");
  assert.equal(nameOnly.meetingPattern, null);
});

test("returns nothing for a document that is not a syllabus", () => {
  const details = parseCourseDetails([
    "Attention is the process by which the mind selects among competing inputs.",
  ]);
  assert.deepEqual(details, { instructor: null, meetingPattern: null, officeHours: null });
});

test("stops an instructor name before the next fact on the line", () => {
  const details = parseCourseDetails([
    "Instructor: Prof. Ada Vance. Office hours Wed 2-4pm, Kemeny 318.",
  ]);
  assert.equal(details.instructor, "Prof. Ada Vance");
});

test("describes a pattern for display", () => {
  assert.match(
    describeMeetingPattern({ days: [2, 4], startTime: "11:00", endTime: "13:00", location: "Ross Hall 214" }),
    /^Tue, Thu · .+ · Ross Hall 214$/,
  );
  assert.equal(
    describeMeetingPattern({ days: [1], startTime: null, endTime: null, location: "" }),
    "Mon",
  );
});

test("writes a shared meridiem once", () => {
  // The exact strings are locale-dependent; what matters is that a shared
  // suffix appears once and a differing one appears on both ends.
  const sameHalf = formatTimeRange("09:30", "10:45");
  const crossingNoon = formatTimeRange("11:00", "13:00");

  assert.match(sameHalf, /9:30.*10:45/);
  assert.equal(sameHalf.split(/[AP]M/i).length - 1 || 0, sameHalf.match(/[AP]M/gi)?.length ?? 0);
  assert.equal((sameHalf.match(/[AP]M/gi) ?? []).length, 1);
  assert.equal((crossingNoon.match(/[AP]M/gi) ?? []).length, 2);
});

test("a range with no end is just the start", () => {
  assert.equal(formatTimeRange("09:30", null), formatClockTime("09:30"));
});

test("does not read a time zone as a pair of weekdays", () => {
  // "MT" is Mountain Time. Read as a timetable code it is Monday and
  // Tuesday, and it put a class on the calendar that never meets.
  const pattern = parseCourseDetails([
    "Meeting Times: Tuesdays 5:15 – 8:00 PM MT",
  ]).meetingPattern;
  assert.deepEqual(pattern?.days, [2]);
  assert.equal(pattern?.startTime, "17:15");
  assert.equal(pattern?.endTime, "20:00");
});

test("does not read a paragraph about the class as a timetable", () => {
  const details = parseCourseDetails([
    "Grading Scale: Students are evaluated and assessed using homework assignments, projects, written and oral reports, and presentations. This class uses a standard scale, and every component is described in the table below.",
  ]);
  assert.equal(details.meetingPattern, null);
});

test("takes the name from under an Instructor heading", () => {
  // Two real layouts: a bare name on the next line, and a labelled one.
  assert.equal(
    parseCourseDetails(["Instructor Information", "Dr. Gregory Marzolf"]).instructor,
    "Dr. Gregory Marzolf",
  );
  assert.equal(
    parseCourseDetails(["Instructor Information", "Instructor Name: Michael Botyarov"]).instructor,
    "Michael Botyarov",
  );
});

test("never reports the heading itself as the instructor", () => {
  assert.equal(parseCourseDetails(["Instructor Information"]).instructor, null);
});

test("peels stacked office-hours labels down to the answer", () => {
  // Real syllabi name the same thing two or three times before saying
  // anything: cutting at the first label left "Student Hours: Office hours by
  // appointment only" on the course page.
  assert.equal(
    parseCourseDetails(["Office Hours/Student Hours: Office hours by appointment only"]).officeHours,
    "By appointment only",
  );
  assert.equal(
    parseCourseDetails(["Office Hours: By appointment"]).officeHours,
    "By appointment",
  );
});

test("does not mistake a clock time for a label when peeling", () => {
  // "Mon 3:" looks like a label if digits are allowed in one, and the answer
  // would come back as "00-5:00pm".
  assert.equal(
    parseCourseDetails(["Office Hours: Mon 3:00-5:00pm, Kemeny 318"]).officeHours,
    "Mon 3:00-5:00pm, Kemeny 318",
  );
  assert.equal(
    parseCourseDetails(["Office hours are Tuesday and Thursday, 11:00am to 1:00pm"]).officeHours,
    "Tuesday and Thursday, 11:00am to 1:00pm",
  );
});
