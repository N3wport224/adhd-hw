/**
 * Date recognition for syllabus text.
 *
 * Syllabi almost never write a year. "Oct 12" and "Week 4" only mean
 * something relative to when the term starts, so every function here takes a
 * term anchor and resolves against it. Getting this wrong is worse than
 * finding nothing: a due date silently a year out is a trap, not a feature.
 */

export interface TermWindow {
  /** ISO date (YYYY-MM-DD) of the first day of the term. */
  start: string;
  /** How long the term runs. Used to pick the right year for a bare date. */
  months: number;
}

export const DEFAULT_TERM_MONTHS = 5;

export type DateMatchKind = "explicit" | "week";

export interface DateMatch {
  /** The text that matched, e.g. "Oct 12" or "Week 4". */
  raw: string;
  index: number;
  length: number;
  /** Resolved calendar day, or null if it could not be placed. */
  iso: string | null;
  kind: DateMatchKind;
}

const MONTH_NAMES = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

/** Matches full names and the usual abbreviations, including "Sept". */
const MONTH_PATTERN =
  "jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?" +
  "|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?";

const WEEKDAY_PATTERN =
  "(?:mon|tues?|wed(?:nes)?|thur?s?|fri|sat(?:ur)?|sun)(?:day)?";

function monthIndex(word: string) {
  const lower = word.toLowerCase().replace(/\.$/, "");
  const found = MONTH_NAMES.findIndex((name) => name.startsWith(lower.slice(0, 3)));
  // "sept" and "sep" both have to land on September rather than on the first
  // month whose first three letters happen to match.
  return found;
}

function toISO(year: number, month: number, day: number) {
  // Constructed in UTC so the result never shifts a day either side of the
  // date line. The rest of the app treats a due date as a calendar day.
  const date = new Date(Date.UTC(year, month, day));
  if (date.getUTCMonth() !== month || date.getUTCDate() !== day) return null;
  return date.toISOString().slice(0, 10);
}

function addDays(iso: string, days: number) {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function addMonths(iso: string, months: number) {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + months);
  return date.toISOString().slice(0, 10);
}

/**
 * Picks the year for a month/day with none written.
 *
 * A term that starts in August and runs into January covers two calendar
 * years, so "Jan 20" on a Fall syllabus means the *following* January. The
 * rule is simply: the first occurrence at or after the term start.
 */
function resolveYear(term: TermWindow, month: number, day: number) {
  const startYear = Number(term.start.slice(0, 4));
  const end = addMonths(term.start, term.months);

  for (const year of [startYear, startYear + 1]) {
    const candidate = toISO(year, month, day);
    if (candidate && candidate >= term.start && candidate <= end) return candidate;
  }

  // Outside the term window entirely — a date in the course description, or a
  // term start that was guessed wrong. Keep the closest reading rather than
  // discarding it; the review step is where a human catches this.
  return toISO(startYear, month, day);
}

interface Pattern {
  regex: RegExp;
  build(match: RegExpExecArray, term: TermWindow): { iso: string | null; kind: DateMatchKind } | null;
}

/**
 * Ordered by how specific each pattern is. ISO first so "2026-10-12" is not
 * read as a bare "10" by a later pattern; week numbers last because "Week 4"
 * is the weakest signal of the set.
 */
const PATTERNS: Pattern[] = [
  {
    // 2026-10-12
    regex: /\b(\d{4})-(\d{1,2})-(\d{1,2})\b/gi,
    build: (m) => ({ iso: toISO(Number(m[1]), Number(m[2]) - 1, Number(m[3])), kind: "explicit" }),
  },
  {
    // Tue, October 12th, 2026 — the weekday and year are both optional.
    regex: new RegExp(
      `\\b(?:${WEEKDAY_PATTERN}\\.?,?\\s+)?(${MONTH_PATTERN})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:\\s*,?\\s*(\\d{4}))?\\b`,
      "gi",
    ),
    build: (m, term) => {
      const month = monthIndex(m[1]);
      const day = Number(m[2]);
      if (month < 0 || day < 1 || day > 31) return null;
      const iso = m[3]
        ? toISO(Number(m[3]), month, day)
        : resolveYear(term, month, day);
      return { iso, kind: "explicit" };
    },
  },
  {
    // 12 October 2026
    regex: new RegExp(
      `\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${MONTH_PATTERN})\\.?(?:\\s*,?\\s*(\\d{4}))?\\b`,
      "gi",
    ),
    build: (m, term) => {
      const month = monthIndex(m[2]);
      const day = Number(m[1]);
      if (month < 0 || day < 1 || day > 31) return null;
      const iso = m[3]
        ? toISO(Number(m[3]), month, day)
        : resolveYear(term, month, day);
      return { iso, kind: "explicit" };
    },
  },
  {
    // 10/12 or 10/12/26 or 10/12/2026
    regex: /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/g,
    build: (m, term) => {
      let month = Number(m[1]) - 1;
      let day = Number(m[2]);
      // US month/day is the default, but a first number above 12 can only be
      // a day, so read it the other way round rather than dropping it.
      if (month > 11 && day <= 12) {
        [month, day] = [day - 1, month + 1];
      }
      if (month < 0 || month > 11 || day < 1 || day > 31) return null;

      if (!m[3]) return { iso: resolveYear(term, month, day), kind: "explicit" };
      const written = Number(m[3]);
      const year = written < 100 ? 2000 + written : written;
      return { iso: toISO(year, month, day), kind: "explicit" };
    },
  },
  {
    // Week 4 — resolved against the term start, so it lands on the same
    // weekday the term began on.
    regex: /\bweeks?\s+(\d{1,2})\b/gi,
    build: (m, term) => {
      const week = Number(m[1]);
      if (week < 1 || week > 52) return null;
      return { iso: addDays(term.start, (week - 1) * 7), kind: "week" };
    },
  },
];

/**
 * Every date in a line, left to right, with overlaps resolved in favour of
 * the more specific pattern.
 */
export function findDates(line: string, term: TermWindow): DateMatch[] {
  const found: DateMatch[] = [];

  for (const pattern of PATTERNS) {
    pattern.regex.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.regex.exec(line)) !== null) {
      const start = match.index;
      const end = start + match[0].length;

      // An earlier (more specific) pattern already claimed this text.
      if (found.some((existing) => start < existing.index + existing.length && end > existing.index)) {
        continue;
      }

      const built = pattern.build(match, term);
      if (!built) continue;
      found.push({ raw: match[0], index: start, length: match[0].length, ...built });
    }
  }

  return found.sort((a, b) => a.index - b.index);
}

/** The first date in a line, or null. */
export function findFirstDate(line: string, term: TermWindow) {
  return findDates(line, term)[0] ?? null;
}

/**
 * Guesses when the current term started, for use as a default the student
 * then corrects. Fall terms start late August, Spring mid-January, and a
 * summer upload most likely belongs to the Fall term about to begin.
 */
export function guessTermStart(today = new Date()): string {
  const year = today.getUTCFullYear();
  const month = today.getUTCMonth();

  if (month <= 4) return `${year}-01-15`;
  return `${year}-08-25`;
}

/** "12 October 2026" — for showing a resolved date back to the student. */
export function formatISODate(iso: string) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString(undefined, {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
