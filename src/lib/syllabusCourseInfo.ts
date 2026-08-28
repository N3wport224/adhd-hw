import { toSentences } from "@/lib/documents/sentences";
import type { MeetingPattern, Weekday } from "@/types";

/**
 * Reads the front matter of a syllabus: who teaches the class, when it meets,
 * and when office hours are.
 *
 * Kept separate from the assignment parser because it answers a different
 * question. Assignments are scattered through a document; this information is
 * almost always in the first page, written as labelled lines.
 */

export interface CourseDetails {
  instructor: string | null;
  meetingPattern: MeetingPattern | null;
  officeHours: string | null;
}

/** Plural too: a syllabus says "Wednesdays" as readily as "Wednesday". */
const DAY_WORDS: Array<{ pattern: RegExp; day: Weekday }> = [
  { pattern: /^sun(day)?s?$/i, day: 0 },
  { pattern: /^mon(day)?s?$/i, day: 1 },
  { pattern: /^tues?(day)?s?$/i, day: 2 },
  { pattern: /^wed(nes)?(day)?s?$/i, day: 3 },
  { pattern: /^thur?s?(day)?s?$/i, day: 4 },
  { pattern: /^fri(day)?s?$/i, day: 5 },
  { pattern: /^sat(ur)?(day)?s?$/i, day: 6 },
];

/**
 * The compressed notation a timetable uses. Order matters: two-letter codes
 * are tried first so "Th" is Thursday rather than Tuesday followed by a
 * stray H, and "Tu" is Tuesday rather than a bare T.
 */
const COMPRESSED: Array<[string, Weekday]> = [
  ["su", 0], ["tu", 2], ["th", 4], ["sa", 6],
  ["m", 1], ["w", 3], ["f", 5], ["t", 2], ["r", 4], ["u", 0],
];

function fromCompressed(token: string): Weekday[] | null {
  // Only worth trying on a run of letters that could plausibly be a day code.
  if (!/^[mtwrfsuh]+$/i.test(token) || token.length > 8) return null;

  const days: Weekday[] = [];
  let rest = token.toLowerCase();
  while (rest.length > 0) {
    const match = COMPRESSED.find(([code]) => rest.startsWith(code));
    if (!match) return null;
    days.push(match[1]);
    rest = rest.slice(match[0].length);
  }
  return days.length > 0 ? days : null;
}

/**
 * Time zones, which are letters a timetable code could otherwise be made of.
 * "Meeting Times: Tuesdays 5:15 – 8:00 PM MT" reads MT as Monday and Tuesday
 * and puts a class on the calendar that does not exist.
 */
const TIMEZONE = /^(?:UTC|GMT|[MCEP][SD]?T)$/i;

/**
 * The weekdays named in a fragment. Handles spelled-out lists
 * ("Tuesday and Thursday"), separated abbreviations ("Tue/Thu") and
 * compressed timetable codes ("MWF", "TuTh").
 */
export function parseWeekdays(text: string): Weekday[] {
  const found = new Set<Weekday>();

  for (const token of text.split(/[\s,/&+]+|\band\b/i)) {
    const word = token.replace(/[.:;]+$/, "").trim();
    if (!word) continue;

    if (TIMEZONE.test(word)) continue;

    const named = DAY_WORDS.find((entry) => entry.pattern.test(word));
    if (named) {
      found.add(named.day);
      continue;
    }
    // Only treat a token as compressed if it is not a word in its own right.
    if (word.length <= 8 && !/[aeiou]{2}|day/i.test(word)) {
      for (const day of fromCompressed(word) ?? []) found.add(day);
    }
  }

  return [...found].sort((a, b) => a - b);
}

function toClock(hour: number, minute: number, meridiem: string | null) {
  let hours = hour;
  if (meridiem) {
    const pm = /p/i.test(meridiem);
    if (pm && hours < 12) hours += 12;
    if (!pm && hours === 12) hours = 0;
  }
  if (hours > 23 || minute > 59) return null;
  return `${String(hours).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/**
 * Three shapes, tried in order: a time with a meridiem ("4pm", "10:45 a.m."),
 * a 24-hour or minute-bearing time ("14:00"), and a bare hour that is only
 * accepted when a range separator and another number follow it — which is
 * what makes "2-4pm" readable without also reading "pages 45-72" as a class.
 */
const TIME_RANGE =
  /(\d{1,2})(?::(\d{2}))?\s*([ap])\.?\s?m\.?|(\d{1,2}):(\d{2})|(\d{1,2})(?=\s*(?:[-–—]|to\b)\s*\d)/gi;

/**
 * The first start–end time pair in a fragment.
 *
 * A meridiem written only once applies to both ends, which is how people
 * actually write it: "2-4pm" is the afternoon, not two in the morning.
 */
export function parseTimeRange(text: string): { startTime: string; endTime: string | null } | null {
  TIME_RANGE.lastIndex = 0;
  const hits: Array<{ hour: number; minute: number; meridiem: string | null }> = [];

  let match: RegExpExecArray | null;
  while ((match = TIME_RANGE.exec(text)) !== null) {
    if (match[1] !== undefined) {
      hits.push({ hour: Number(match[1]), minute: Number(match[2] ?? 0), meridiem: match[3] });
    } else if (match[4] !== undefined) {
      hits.push({ hour: Number(match[4]), minute: Number(match[5]), meridiem: null });
    } else {
      hits.push({ hour: Number(match[6]), minute: 0, meridiem: null });
    }
    if (hits.length === 2) break;
  }

  if (hits.length === 0) return null;

  // A single bare number is not a time. "Read pages 45" should never become
  // a quarter to one.
  const bare = (hit: (typeof hits)[number]) => !hit.meridiem && hit.minute === 0;
  if (hits.length === 1 && bare(hits[0]) && !/:/.test(text)) return null;

  let start = toClock(hits[0].hour, hits[0].minute, hits[0].meridiem);
  if (!start) return null;

  if (hits.length === 1) return { startTime: start, endTime: null };

  // A meridiem carries forward, never back: "11:00 to 1:00pm" starts in the
  // morning, and borrowing the pm would move it to eleven at night.
  let end = toClock(hits[1].hour, hits[1].minute, hits[1].meridiem ?? hits[0].meridiem);
  if (!end) return { startTime: start, endTime: null };

  if (end <= start && !hits[1].meridiem) {
    // "11:00 to 1:00" can only mean the range runs through noon.
    end = toClock(hits[1].hour + 12, hits[1].minute, null) ?? end;
  } else if (!hits[0].meridiem && start < "07:00") {
    // "2-4pm": the start had no meridiem of its own, and no class begins at
    // two in the morning. Read it as sharing the end's afternoon.
    const shifted = toClock(hits[0].hour + 12, hits[0].minute, null);
    if (shifted && shifted < end) start = shifted;
  }

  return { startTime: start, endTime: end > start ? end : null };
}

const LOCATION =
  /\b(?:in|at|room|rm\.?|location)\s*:?\s*([A-Z][A-Za-z.]*(?:\s+[A-Z][A-Za-z.]*)*\s+\d{1,4}[A-Za-z]?)\b|\b(?:room|rm\.?)\s*:?\s*(\d{1,4}[A-Za-z]?)\b/;

/**
 * A trailing "Moore 110" on a meeting line, where nothing says "in" or
 * "room". Timetables write the room as the last thing on the line far more
 * often than they label it, and this only ever runs on a line already
 * recognised as a class time.
 */
const TRAILING_ROOM = /(?:^|[\s,·|]+)([A-Z][A-Za-z.]*(?:\s+[A-Z][A-Za-z.]*)*)\s+(\d{1,4}[A-Za-z]?)\s*$/;

/**
 * The same room, when the line did not end there.
 *
 * Extraction merges a short line into whatever follows it when a syllabus
 * writes its headings in bold at body size — so "…, Moore 110" is often in
 * the middle of a paragraph rather than at the end of one. Anchored to the
 * time range so it only ever reads what sits directly after the hours.
 */
const ROOM_AFTER_TIME =
  /\d\s*(?:[ap]\.?m\.?)?[,\s]+([A-Z][A-Za-z.]*(?:\s+[A-Z][A-Za-z.]*)?)\s+(\d{1,4}[A-Za-z]?)\b/;

/**
 * Words that follow a class time often enough to be worth naming, and that
 * are never a building. "Moore 110" is a room; "Week 6" and "Chapter 3"
 * are what the next line of the syllabus was about.
 */
const NOT_A_BUILDING =
  /^(course|week|chapter|page|pages|unit|section|part|module|lecture|reading|fall|spring|winter|summer|term|semester)$/i;

function parseLocation(text: string) {
  const labelled = LOCATION.exec(text);
  if (labelled) return (labelled[1] ?? labelled[2] ?? "").trim();

  const match = TRAILING_ROOM.exec(text) ?? ROOM_AFTER_TIME.exec(text);
  if (!match) return "";

  const name = match[1].trim();
  // A weekday is a day, not a building, however the line ends.
  if (parseWeekdays(name).length > 0) return "";
  if (NOT_A_BUILDING.test(name.split(/\s+/)[0])) return "";
  return `${name} ${match[2]}`.trim();
}

/**
 * The plurals are not decoration. "Lectures:" and "Classes:" are as common a
 * label as the singular, and `\blecture\b` does not match "Lectures" — the
 * boundary it wants is not there. A syllabus that labels its line that way
 * used to lose its class times entirely, and with them the calendar blocks
 * and the per-class lecture steps.
 */
const MEETING_LINE =
  /\b(meets?|meeting|class(?:es)?|lectures?|sections?|seminars?|when)\b.{0,40}?\b(time|day|hour)?/i;

/** Past this a line is a sentence about the class, not a statement of when it meets. */
const MEETING_LINE_LENGTH = 120;

/**
 * A label made only of words — "Student Hours:", "Drop-in:". Digits are
 * excluded deliberately: without that, "Mon 3:00-5:00pm" reads "Mon 3:" as a
 * label and the answer becomes "00-5:00pm".
 */
const WORD_LABEL = /^[A-Za-z][A-Za-z\s-]{0,30}:\s*/;

/** A second "office hours" left over inside the value itself. */
const REPEATED_LABEL = /^office\s+hours?\b\s*(?:are|is|:)?\s*/i;

/**
 * What a line actually says the office hours are.
 *
 * Syllabi stack labels: "Office Hours/Student Hours: Office hours by
 * appointment only" names the same thing three times before saying anything.
 * Cutting at the first one left "Student Hours: Office hours by appointment
 * only" on the course page, so the labels are peeled until words are left.
 */
function officeHoursValue(text: string): string | null {
  let value = text.replace(/^.*?\boffice\s+hours?\b\s*(are|:|is)?\s*/i, "");

  // Bounded: two labels is already unusual, and peeling forever would eat a
  // value that legitimately contains one.
  for (let pass = 0; pass < 2; pass += 1) {
    const before = value;
    value = value.replace(/^[^A-Za-z0-9]+/, "").replace(REPEATED_LABEL, "");
    if (!REPEATED_LABEL.test(before)) value = value.replace(WORD_LABEL, "");
    if (value === before) break;
  }

  value = value.replace(/[.\s]+$/, "").trim();
  if (!value) return null;
  // Reads as a sentence after the "Office hours:" the page puts in front.
  return value.charAt(0).toUpperCase() + value.slice(1);
}

const OFFICE_HOURS_LINE = /\boffice\s+hours?\b/i;

const INSTRUCTOR_LINE =
  /\b(instructor|professor|taught by|lecturer|teacher|prof\.?)\b\s*:?\s*(.+)/i;

/**
 * A name, optionally preceded by a title that belongs to it.
 *
 * The titles are spelled with both cases rather than the pattern carrying an
 * `i` flag: the capital letters after them are what stop the match running on
 * into the rest of the sentence, so the pattern has to stay case-sensitive.
 */
const NAME_PATTERN =
  /^((?:[Dd]r|[Pp]rof(?:essor)?|[Mm]r|[Mm]rs|[Mm]s|[Mm]x)\.?\s+)?[A-Z][A-Za-z'’-]+(?:\s+[A-Z][A-Za-z'’.-]+){0,3}/;

/**
 * Words that follow "Instructor" on a heading rather than naming anybody.
 * "Instructor Information" is a section title, and reading it as a name put
 * "Information" on the course page of every syllabus that has one.
 */
const NOT_A_NAME = /^(information|info|details|contact|name|team|staff)$/i;

/** The label that so often sits between "Instructor" and the actual name. */
const NAME_LABEL = /^(?:name|information|info|details|contact)\b\s*:?\s*/i;

function parseInstructor(text: string) {
  const match = INSTRUCTOR_LINE.exec(text);
  if (!match) return null;
  // The sentence boundary is already handled by the shared splitter, and the
  // name pattern stops on its own at a comma or a lower-case word — so there
  // is nothing left to trim off the end here.
  const rest = match[2].trim().replace(NAME_LABEL, "").trim();
  const name = NAME_PATTERN.exec(rest)?.[0]?.trim().replace(/[.,;]+$/, "");
  return name && name.length > 2 && !NOT_A_NAME.test(name) ? name : null;
}

/** A bare name on a line of its own, as the line under an "Instructor" heading. */
function bareName(text: string) {
  const name = NAME_PATTERN.exec(text.trim())?.[0]?.trim().replace(/[.,;]+$/, "");
  return name && name.length > 2 && name === text.trim().replace(/[.,;]+$/, "") ? name : null;
}

/**
 * Reads instructor, meeting pattern and office hours out of a syllabus.
 *
 * Every field is independently optional — a syllabus that names its
 * instructor but never says where the class meets should still fill in what
 * it does say rather than returning nothing.
 */
export function parseCourseDetails(paragraphs: string[]): CourseDetails {
  let instructor: string | null = null;
  let officeHours: string | null = null;
  let meetingPattern: MeetingPattern | null = null;
  // Set when a line said "Instructor" but named nobody, so the name on the
  // line below it — the common layout — is still found.
  let expectingName = false;

  for (const paragraph of paragraphs) {
    // A paragraph often carries several labelled facts on one line, so each
    // sentence is considered on its own — using the shared splitter, because
    // breaking at every period would cut "Instructor: Dr. Okonkwo" in half at
    // the title.
    const fragments = toSentences([paragraph]).flatMap((sentence) =>
      sentence.text.split(/\s{2,}|\s*\|\s*/),
    );
    for (const fragment of fragments) {
      const text = fragment.trim();
      if (!text) continue;

      if (!instructor) {
        instructor = parseInstructor(text);
        if (instructor) expectingName = false;
        else if (INSTRUCTOR_LINE.test(text)) expectingName = true;
        else if (expectingName) {
          instructor = bareName(text);
          if (instructor) expectingName = false;
        }
      }

      if (OFFICE_HOURS_LINE.test(text)) {
        if (!officeHours) officeHours = officeHoursValue(text);
        // Office hours are also days and times; without this they would be
        // mistaken for when the class itself meets.
        continue;
      }

      if (meetingPattern) continue;
      // A timetable states itself in a few words. A paragraph this long is
      // prose that happens to contain "class", and reading a stray letter in
      // it as a weekday put a phantom lecture on every calendar.
      if (text.length > MEETING_LINE_LENGTH) continue;
      if (!MEETING_LINE.test(text)) continue;

      const days = parseWeekdays(text);
      if (days.length === 0) continue;

      const times = parseTimeRange(text);
      meetingPattern = {
        days,
        startTime: times?.startTime ?? null,
        endTime: times?.endTime ?? null,
        location: parseLocation(text),
      };
    }
  }

  return { instructor, meetingPattern, officeHours };
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "Tue, Thu · 11:00am – 1:00pm · Ross Hall 214" */
export function describeMeetingPattern(pattern: MeetingPattern) {
  const days = pattern.days.map((day) => DAY_LABELS[day]).join(", ");
  const parts = [days];

  if (pattern.startTime) {
    parts.push(formatTimeRange(pattern.startTime, pattern.endTime));
  }
  if (pattern.location) parts.push(pattern.location);
  return parts.join(" · ");
}

/**
 * A time range written the way a timetable writes it — "9:30–10:45 AM"
 * rather than "9:30 AM – 10:45 AM".
 *
 * Repeating a meridiem that both ends share costs six characters, and a
 * calendar column has no room to spare: the long form gets clipped mid-word,
 * which is worse than no time at all.
 */
export function formatTimeRange(startTime: string, endTime: string | null) {
  const start = formatClockTime(startTime);
  if (!endTime) return start;
  const end = formatClockTime(endTime);

  // Whatever the locale appends after the digits, if anything.
  const suffixOf = (text: string) => text.replace(/^[\d:.\s]+/, "").trim();
  const startSuffix = suffixOf(start);

  if (startSuffix && startSuffix === suffixOf(end)) {
    return `${start.slice(0, start.length - startSuffix.length).trim()}–${end}`;
  }
  return `${start}–${end}`;
}

/** "09:30" in the viewer's own clock convention. */
export function formatClockTime(clock: string) {
  const [hour, minute] = clock.split(":").map(Number);
  return new Date(2000, 0, 1, hour, minute).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}
