import assert from "node:assert/strict";
import { test } from "node:test";
import { FeedError, dayOf, parseCalendarFeed } from "@/lib/calendarFeed";

const wrap = (body: string) =>
  ["BEGIN:VCALENDAR", "VERSION:2.0", body, "END:VCALENDAR"].join("\r\n");

test("reads an assignment out of a course feed", () => {
  const events = parseCalendarFeed(
    wrap(
      [
        "BEGIN:VEVENT",
        "UID:event-assignment-9182734@colostate.instructure.com",
        "SUMMARY:Project Assignment 3 [ENGR 502]",
        "DTSTART:20260913T055900Z",
        "END:VEVENT",
      ].join("\r\n"),
    ),
  );

  assert.equal(events.length, 1);
  assert.equal(events[0].uid, "event-assignment-9182734@colostate.instructure.com");
  // The course the feed names is stripped from the title and kept separately.
  assert.equal(events[0].title, "Project Assignment 3");
  assert.equal(events[0].courseHint, "ENGR 502");
});

test("joins a title the format wrapped across lines", () => {
  const events = parseCalendarFeed(
    wrap(
      [
        "BEGIN:VEVENT",
        "UID:a",
        // Folding breaks at a byte count, not at a word: unfolding drops the
        // CRLF and exactly one leading space, rejoining the halves as they were.
        "SUMMARY:Project Management Plan and Final Presentation for the whole te",
        " rm [ENGR 502]",
        "DTSTART;VALUE=DATE:20261213",
        "END:VEVENT",
      ].join("\r\n"),
    ),
  );
  assert.equal(
    events[0].title,
    "Project Management Plan and Final Presentation for the whole term",
  );
});

test("unescapes what the format escapes", () => {
  const events = parseCalendarFeed(
    wrap(
      [
        "BEGIN:VEVENT",
        "UID:a",
        "SUMMARY:Read chapters 2\\, 3 and 4\; then post",
        "DTSTART;VALUE=DATE:20260913",
        "END:VEVENT",
      ].join("\r\n"),
    ),
  );
  assert.equal(events[0].title, "Read chapters 2, 3 and 4; then post");
});

test("keeps an all-day date on its own day", () => {
  // A date is a calendar day already. Treating it as midnight UTC and
  // converting would move it a day west of Greenwich.
  assert.equal(dayOf("20261213", "VALUE=DATE"), "2026-12-13");
  assert.equal(dayOf("20261213", ""), "2026-12-13");
});

/** The local day of an instant, worked out the way the reader would see it. */
function localDayOf(instant: number) {
  const date = new Date(instant);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

test("resolves a zoned wall clock through its own zone", () => {
  // 23:59 in Denver is 05:59 UTC the next morning. The expected day is
  // computed from that instant rather than written down, so the test says the
  // same thing wherever it runs.
  assert.equal(
    dayOf("20260913T235900", "TZID=America/Denver"),
    localDayOf(Date.UTC(2026, 8, 14, 5, 59)),
  );
});

test("follows the zone across a daylight-saving change", () => {
  // Denver is six hours behind in September and seven in January. Getting
  // this wrong moves a midnight deadline by a day for half the term.
  assert.equal(
    dayOf("20260115T235900", "TZID=America/Denver"),
    localDayOf(Date.UTC(2026, 0, 16, 6, 59)),
  );
});

test("drops an event with no date rather than guessing one", () => {
  const events = parseCalendarFeed(
    wrap(["BEGIN:VEVENT", "UID:a", "SUMMARY:Someday", "END:VEVENT"].join("\r\n")),
  );
  assert.deepEqual(events, []);
});

test("identifies an event with no UID by its title and day", () => {
  const events = parseCalendarFeed(
    wrap(
      ["BEGIN:VEVENT", "SUMMARY:Quiz 4", "DTSTART;VALUE=DATE:20261005", "END:VEVENT"].join("\r\n"),
    ),
  );
  assert.equal(events[0].uid, "Quiz 4|2026-10-05");
});

test("sorts by the day it is due", () => {
  const events = parseCalendarFeed(
    wrap(
      [
        "BEGIN:VEVENT",
        "UID:b",
        "SUMMARY:Later",
        "DTSTART;VALUE=DATE:20261005",
        "END:VEVENT",
        "BEGIN:VEVENT",
        "UID:a",
        "SUMMARY:Sooner",
        "DTSTART;VALUE=DATE:20260901",
        "END:VEVENT",
      ].join("\r\n"),
    ),
  );
  assert.deepEqual(
    events.map((event) => event.title),
    ["Sooner", "Later"],
  );
});

test("refuses a file that is not a calendar", () => {
  assert.throws(() => parseCalendarFeed("Instructor Information\nDr. Marzolf"), FeedError);
});
