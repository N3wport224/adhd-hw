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

const DAY_WORDS: Array<{ pattern: RegExp; day: Weekday }> = [
  { pattern: /^sun(day)?$/i, day: 0 },
  { pattern: /^mon(day)?$/i, day: 1 },
  { pattern: /^tues?(day)?$/i, day: 2 },
  { pattern: /^wed(nes)?(day)?$/i, day: 3 },
  { pattern: /^thur?s?(day)?$/i, day: 4 },
  { pattern: /^fri(day)?$/i, day: 5 },
  { pattern: /^sat(ur)?(day)?$/i, day: 6 },
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
 * The weekdays named in a fragment. Handles spelled-out lists
 * ("Tuesday and Thursday"), separated abbreviations ("Tue/Thu") and
 * compressed timetable codes ("MWF", "TuTh").
 */
export function parseWeekdays(text: string): Weekday[] {
  const found = new Set<Weekday>();

  for (const token of text.split(/[\s,/&+]+|\band\b/i)) {
    const word = token.replace(/[.:;]+$/, "").trim();
    if (!word) continue;

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

function parseLocation(text: string) {
  const match = LOCATION.exec(text);
  return (match?.[1] ?? match?.[2] ?? "").trim();
}

const MEETING_LINE =
  /\b(meets?|meeting|class|lecture|section|seminar|when)\b.{0,40}?\b(time|day|hour)?/i;

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

function parseInstructor(text: string) {
  const match = INSTRUCTOR_LINE.exec(text);
  if (!match) return null;
  // The sentence boundary is already handled by the shared splitter, and the
  // name pattern stops on its own at a comma or a lower-case word — so there
  // is nothing left to trim off the end here.
  const name = NAME_PATTERN.exec(match[2].trim())?.[0]?.trim().replace(/[.,;]+$/, "");
  return name && name.length > 2 ? name : null;
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

      if (!instructor) instructor = parseInstructor(text);

      if (OFFICE_HOURS_LINE.test(text)) {
        if (!officeHours) {
          officeHours = text
            .replace(/^.*?\boffice\s+hours?\b\s*(are|:|is)?\s*/i, "")
            .replace(/[.\s]+$/, "")
            .trim() || null;
        }
        // Office hours are also days and times; without this they would be
        // mistaken for when the class itself meets.
        continue;
      }

      if (meetingPattern) continue;
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
