import { findDates, type DateMatch, type TermWindow } from "@/lib/syllabusDates";

/**
 * Puts flattened table rows back together.
 *
 * Almost every syllabus keeps its schedule and its grading breakdown in a
 * table, and text extraction has no notion of a table: a PDF hands back
 * positioned glyphs and a Word file hands back one paragraph per cell. Either
 * way a row that reads
 *
 *     | Aug 24 – Aug 30 | Intro | Chapter 1 | Discussion Board 1, Quiz 1 |
 *
 * arrives as six separate lines, and the date is no longer on the same line
 * as the work. A parser that looks for a date and a deliverable together
 * finds neither — which is why real syllabi came back empty.
 */

/** One row of a schedule table: the date that headed it, and what it held. */
export interface ScheduleRow {
  /** The date the row is filed under; the end of a range, where it is one. */
  date: DateMatch;
  /** Exactly as the syllabus wrote it, including both ends of a range. */
  raw: string;
  lines: string[];
}

/**
 * How much text may sit beside a date before the line stops being a heading
 * and starts being a sentence that merely mentions one.
 */
const HEADING_SLACK = 14;

/** Past this a line is prose, and prose is not a table. */
const PROSE_LENGTH = 200;

/** Trailing "–" or "to" on the first half of a range split across two lines. */
const OPEN_RANGE = /[-–—]\s*$|\bto\s*$/;

function withoutDates(line: string, dates: DateMatch[]) {
  let rest = line;
  // Back to front, so earlier offsets stay valid.
  for (const date of [...dates].sort((a, b) => b.index - a.index)) {
    rest = rest.slice(0, date.index) + rest.slice(date.index + date.length);
  }
  return rest.replace(/[\s.,:;•\-–—()\d]/g, "");
}

/**
 * A line that is a date and little else — "Aug 24", "August 24 –",
 * "November 23 – November 29", "Week 5 Oct 5".
 *
 * The leftovers are measured rather than pattern-matched because the label
 * beside the date is different in every syllabus; what they share is that
 * there is barely any of it.
 */
function dateHeading(line: string, term: TermWindow): DateMatch[] | null {
  const trimmed = line.trim();
  if (trimmed.length === 0 || trimmed.length > PROSE_LENGTH) return null;
  const dates = findDates(trimmed, term);
  if (dates.length === 0) return null;
  return withoutDates(trimmed, dates).length <= HEADING_SLACK ? dates : null;
}

/**
 * The schedule rows in a document, each with the date it is filed under.
 *
 * A row runs from one date heading to the next. Where a heading is a range —
 * or the two halves of one, split across lines by the column width — the row
 * is filed under the end of it, because a week of work is due by the end of
 * the week rather than on the Monday.
 */
export function scheduleRows(paragraphs: string[], term: TermWindow): ScheduleRow[] {
  const rows: ScheduleRow[] = [];
  let open: ScheduleRow | null = null;

  for (let index = 0; index < paragraphs.length; index += 1) {
    const line = paragraphs[index].trim();
    if (line.length === 0) continue;

    const dates = dateHeading(line, term);
    if (dates) {
      let raw = line;
      let all = dates;

      // "August 24 –" on one line and "August 30" on the next is one heading
      // that the column was too narrow to hold.
      if (OPEN_RANGE.test(line)) {
        const next = paragraphs[index + 1]?.trim() ?? "";
        const continued = dateHeading(next, term);
        if (continued) {
          raw = `${line} ${next}`;
          all = [...dates, ...continued];
          index += 1;
        }
      }

      const placed = all.filter((date) => date.iso !== null);
      if (placed.length > 0) {
        // The last placed date: the end of a range, or the only date there is.
        open = { date: placed[placed.length - 1], raw, lines: [] };
        rows.push(open);
      } else {
        open = null;
      }
      continue;
    }

    // Prose means the table is behind us — a paragraph that long is not a cell.
    if (line.length > PROSE_LENGTH) {
      open = null;
      continue;
    }

    open?.lines.push(line);
  }

  return rows.filter((row) => row.lines.length > 0);
}

/** A cell holding only figures — "75", "15%", "10 10%". */
const FIGURES_ONLY = /^[\s\d.,%]+$/;

/** Past this, a run of label lines has stopped being one table cell. */
const LABEL_LIMIT = 70;

/**
 * Grading-table rows put back onto one line.
 *
 * A breakdown is nearly always a three-column table — what it is, how many
 * points, what share of the grade — and flattening leaves "Homework", "75"
 * and "15%" on three separate lines, where nothing pairs the label with the
 * percentage. Labels wrap too, so "Project Management Plan" and "(PMP) &
 * Presentation" have to come back together before the figures arrive.
 */
export function weightRows(paragraphs: string[]): string[] {
  const rows: string[] = [];
  let label: string[] = [];
  let figures = "";

  const flush = () => {
    if (label.length > 0 && figures.includes("%")) {
      rows.push(`${label.join(" ")} ${figures}`.replace(/\s+/g, " ").trim());
    }
    label = [];
    figures = "";
  };

  for (const paragraph of paragraphs) {
    const line = paragraph.trim();
    if (line.length === 0) continue;

    // A line already carrying both halves needs no help — but only a table
    // row, not any sentence that happens to mention a percentage. A row ends
    // at its percentage column; prose carries on past it.
    if (/%/.test(line) && /[A-Za-z]/.test(line)) {
      // Ending at the percentage is what makes it a row. "Class – 100%
      // Virtual" mentions one mid-sentence and is a lecture note, not a
      // share of the grade.
      if (/%\s*$/.test(line)) {
        flush();
        rows.push(line);
      }
      continue;
    }

    if (FIGURES_ONLY.test(line)) {
      figures = figures ? `${figures} ${line}` : line;
      if (line.includes("%")) flush();
      continue;
    }

    // Text after figures have started belongs to the next row, not this one.
    if (figures) flush();
    if (line.length > PROSE_LENGTH) {
      label = [];
      continue;
    }
    // Only a line that reads as a continuation joins the one before it — one
    // opening with "(", "&" or a lower-case word. Appending every short line
    // instead glued a column header onto the row beneath it, and the label
    // came out as "Weightage Homework".
    const continues =
      label.length > 0 &&
      /^[(&a-z]/.test(line) &&
      label.join(" ").length + line.length <= LABEL_LIMIT;
    label = continues ? [...label, line] : [line];
  }

  return rows;
}
