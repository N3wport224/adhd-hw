/**
 * Reading a course calendar feed.
 *
 * A syllabus is a document about the term written before it started; a
 * calendar feed is what the courseware currently believes. The parser in
 * `syllabusParser` is heuristics over prose and will always be guessing —
 * this is not guessing, and it stays right when a deadline moves.
 *
 * Canvas, Blackboard and Moodle all publish the same thing: an iCalendar
 * file, one VEVENT per assignment, with a stable UID.
 */

export interface FeedEvent {
  /** The feed's own identifier, which is what makes re-importing safe. */
  uid: string;
  title: string;
  /** Local calendar day the item is due, YYYY-MM-DD. */
  dueDay: string;
  /** The course name the feed put in brackets, where it did. */
  courseHint: string | null;
}

export class FeedError extends Error {}

/**
 * Unfolds the line wrapping iCalendar mandates.
 *
 * A long value is split at 75 octets and continued on the next line behind a
 * single space or tab. Parsing without joining them first splits assignment
 * names in half.
 */
function unfold(text: string): string[] {
  const lines: string[] = [];
  for (const raw of text.split(/\r\n|\n|\r/)) {
    if (/^[ \t]/.test(raw) && lines.length > 0) lines[lines.length - 1] += raw.slice(1);
    else lines.push(raw);
  }
  return lines;
}

/** Escapes the format defines: a literal comma, semicolon, backslash or newline. */
function unescape(value: string) {
  return value
    .replace(/\\n/gi, " ")
    .replace(/\\([,;\\])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * How far the named zone is from UTC at a given instant.
 *
 * Formatting an instant in the zone and reading the fields back as if they
 * were UTC gives the offset — which is the only way to do this correctly
 * across a daylight-saving boundary without shipping a timezone database.
 */
function zoneOffsetMinutes(timeZone: string, instant: number): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(instant));

  const field = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? "0");
  // "24" is how some engines report midnight in this format.
  const hour = field("hour") % 24;
  const asUTC = Date.UTC(
    field("year"),
    field("month") - 1,
    field("day"),
    hour,
    field("minute"),
    field("second"),
  );
  return (asUTC - instant) / 60_000;
}

function localDay(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const STAMP = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/;

/**
 * The local calendar day a DTSTART falls on.
 *
 * Three forms, and the difference matters: an all-day value is already a
 * calendar day and must not be shifted by a timezone; a UTC instant has to be
 * converted, because "due 23:59 UTC" is the previous evening in Colorado;
 * and a zoned wall-clock time has to be resolved through its own zone first.
 */
export function dayOf(value: string, parameters: string): string | null {
  const match = STAMP.exec(value.trim());
  if (!match) return null;
  const [, year, month, day, hour, minute, second, zulu] = match;

  // An all-day event is a date, not a moment. Converting it would move it.
  if (hour === undefined || /VALUE=DATE\b/i.test(parameters)) return `${year}-${month}-${day}`;

  const wall = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
  );

  if (zulu) return localDay(new Date(wall));

  const zone = /TZID=([^;:]+)/i.exec(parameters)?.[1];
  if (!zone) {
    // Floating time: the spec says it happens at that wall clock wherever you
    // are, which is already the local day.
    return `${year}-${month}-${day}`;
  }

  try {
    // One correction pass is enough: the guess is only wrong by the offset,
    // and re-reading at the corrected instant catches a DST boundary.
    const guess = wall - zoneOffsetMinutes(zone, wall) * 60_000;
    const instant = wall - zoneOffsetMinutes(zone, guess) * 60_000;
    return localDay(new Date(instant));
  } catch {
    // An unknown zone name is not worth losing the event over.
    return `${year}-${month}-${day}`;
  }
}

/** "Problem Set 3 [ENGR 502]" — courseware appends the course to every title. */
const COURSE_SUFFIX = /\s*\[([^\]]{1,60})\]\s*$/;

/**
 * The assignments in an iCalendar feed.
 *
 * Events with no date are dropped rather than guessed at, and an event with
 * no summary is not an assignment worth showing.
 */
export function parseCalendarFeed(text: string): FeedEvent[] {
  if (!/BEGIN:VCALENDAR/i.test(text)) {
    throw new FeedError(
      "That does not look like a calendar file. In Canvas it is under Calendar → Calendar Feed.",
    );
  }

  const events: FeedEvent[] = [];
  let current: { uid?: string; summary?: string; day?: string; order?: number } | null = null;
  let index = 0;

  for (const line of unfold(text)) {
    if (/^BEGIN:VEVENT\s*$/i.test(line)) {
      current = { order: index++ };
      continue;
    }
    if (/^END:VEVENT\s*$/i.test(line)) {
      if (current?.summary && current.day) {
        const raw = current.summary;
        const hint = COURSE_SUFFIX.exec(raw)?.[1] ?? null;
        events.push({
          // Without a UID of its own, the title and day are what identify it.
          uid: current.uid ?? `${raw}|${current.day}`,
          title: raw.replace(COURSE_SUFFIX, "").trim() || raw,
          dueDay: current.day,
          courseHint: hint,
        });
      }
      current = null;
      continue;
    }
    if (!current) continue;

    const split = line.indexOf(":");
    if (split === -1) continue;
    const left = line.slice(0, split);
    const value = line.slice(split + 1);
    const name = left.split(";")[0].toUpperCase();
    const parameters = left.slice(name.length);

    if (name === "UID") current.uid = value.trim();
    else if (name === "SUMMARY") current.summary = unescape(value);
    else if (name === "DTSTART" || (name === "DUE" && !current.day)) {
      current.day = dayOf(value, parameters) ?? undefined;
    }
  }

  return events.sort((a, b) => a.dueDay.localeCompare(b.dueDay));
}
