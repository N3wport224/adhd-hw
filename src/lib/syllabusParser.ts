import {
  DEFAULT_TERM_MONTHS,
  findDates,
  guessTermStart,
  type DateMatch,
  type TermWindow,
} from "@/lib/syllabusDates";
import { toSentences } from "@/lib/documents/sentences";
import type { GradeWeight } from "@/types";

/**
 * Heuristic syllabus reader.
 *
 * This is pattern matching over text, not comprehension: it finds lines that
 * pair a date with something that sounds like a deliverable, and lines that
 * pair a label with a percentage. It will miss things and it will invent the
 * occasional oddity, which is exactly why nothing it produces reaches the
 * schedule without passing through the review step first.
 */

export type AssignmentKind =
  | "exam"
  | "quiz"
  | "paper"
  | "reading"
  | "problemSet"
  | "project"
  | "presentation"
  | "other";

/** How much of the line supported reading it as an assignment. */
export type Confidence = "high" | "medium" | "low";

export interface ParsedAssignment {
  /** Stable within one parse, so the review table can key rows off it. */
  id: string;
  title: string;
  dueAt: string | null;
  /** The date exactly as the syllabus wrote it, shown next to the resolved one. */
  rawDate: string | null;
  kind: AssignmentKind;
  confidence: Confidence;
  /** The line this came from, so a student can check the parser's work. */
  excerpt: string;
}

export interface SyllabusParseResult {
  assignments: ParsedAssignment[];
  gradingWeights: GradeWeight[];
  /** The term start the dates were resolved against. */
  termStart: string;
  /** True when the document reads like a syllabus rather than a reading. */
  looksLikeSyllabus: boolean;
  /** Things worth saying out loud in the review step. */
  warnings: string[];
}

export interface ParseOptions {
  /** ISO date the term begins. Bare dates and week numbers resolve against it. */
  termStart?: string;
  termMonths?: number;
}

interface KindRule {
  kind: AssignmentKind;
  pattern: RegExp;
  /** Strong signals are deliverables in their own right; weak ones need help. */
  strength: "strong" | "weak";
}

const KIND_RULES: KindRule[] = [
  { kind: "exam", pattern: /\b(exam|midterm|final(?!\s+paper)|test)\b/i, strength: "strong" },
  { kind: "quiz", pattern: /\bquiz(?:zes)?\b/i, strength: "strong" },
  { kind: "paper", pattern: /\b(paper|essay|report|thesis|write-?up|memo)\b/i, strength: "strong" },
  { kind: "problemSet", pattern: /\b(problem set|p-?set|homework|hw\b|assignment|exercises?|worksheet)\b/i, strength: "strong" },
  { kind: "project", pattern: /\b(project|lab\b|prototype|portfolio)\b/i, strength: "strong" },
  { kind: "presentation", pattern: /\b(presentation|present\b|slides?|poster)\b/i, strength: "strong" },
  { kind: "reading", pattern: /\b(read(?:ing)?s?|chapters?|ch\.\s?\d|pp?\.\s?\d|pages?)\b/i, strength: "weak" },
];

const DUE_PATTERN = /\b(due|deadline|submit|hand in|turn in|by\s+\d)\b/i;

/** Section headings that mark the grading breakdown. */
const GRADING_HEADING = /\b(grad(?:e|ing)|evaluation|assessment|breakdown|weight(?:ing|s)?|marks?)\b/i;

/**
 * Percentages that describe a rule rather than a share of the grade —
 * "loses 5% per day" is the common one, and importing it as a grade
 * component would quietly corrupt the breakdown.
 */
const NOT_A_WEIGHT = /\b(per\s+(day|week|hour)|late|penalt|deduct|curve|minimum|at least|below|attendance\s+below)\b/i;

const SYLLABUS_HINT =
  /\b(syllabus|course outline|grading|office hours|required text|learning outcomes|academic integrity)\b/i;

function classify(text: string): { kind: AssignmentKind; strength: "strong" | "weak" } | null {
  for (const rule of KIND_RULES) {
    if (rule.pattern.test(text)) return { kind: rule.kind, strength: rule.strength };
  }
  return null;
}

/**
 * The words that introduce a date and carry no meaning once it is gone.
 * Stripped repeatedly from the end of a title, so "Midterm 1 will be held on"
 * comes back as "Midterm 1".
 */
const TRAILING_FILLER =
  /(?:\b(?:on|by|at|for|in|of|from|before|during|until|is|are|was|were|will|be|been|due|deadline|scheduled|held|takes?|place|happens?|occurs?|the|this|next|a|an|mon(?:day)?|tues?(?:day)?|wed(?:nes)?(?:day)?|thur?s?(?:day)?|fri(?:day)?|sat(?:ur)?(?:day)?|sun(?:day)?)\b|[\s.:;,\-–—(]+)$/i;

/**
 * The part of a line that names the assignment.
 *
 * Taken from before the date rather than by cutting the date out of the
 * middle: a syllabus says "Midterm 1 will be held on 10/07 in the usual
 * room", and splicing the date out of that leaves the rest of the sentence
 * glued to a dangling preposition. Everything before the date is the name;
 * everything after it is circumstance. Lines that lead with the date — a
 * schedule table, "Week 3: ..." — have nothing before it, so those fall back
 * to what follows.
 */
function titleAround(text: string, date: DateMatch) {
  const before = text.slice(0, date.index);
  const after = text.slice(date.index + date.length);
  const cleanedBefore = cleanTitle(before);
  return cleanedBefore.length >= 3 ? cleanedBefore : cleanTitle(after);
}

const LEADING_NOISE =
  /^(?:[-–—•*•]+\s*|\d+[.)]\s+|weeks?\s*\d*\s*[:.\-–—]?\s*|(?:mon|tues?|wed(?:nes)?|thur?s?|fri|sat(?:ur)?|sun)(?:day)?\.?,?\s+)+/i;

function cleanTitle(text: string) {
  let title = text.replace(/\s+/g, " ").trim();
  title = title.replace(LEADING_NOISE, "");
  // Strip the connective tissue left behind once the date is gone.
  title = title.replace(/^[\s:;,\-–—()]+/, "");
  title = title.replace(/[\s:;,\-–—]+$/, "");
  title = title.replace(/^\s*(due|deadline)\s*(on|by|:)?\s*/i, "").trim();

  // Peel filler off the end until nothing more comes away. One pass is not
  // enough: "will be held on" is four separate words to remove.
  let previous: string;
  do {
    previous = title;
    title = title.replace(TRAILING_FILLER, "");
  } while (title !== previous && title.length > 0);

  return title.trim();
}

/** Keeps a title to something readable in a list, cut at a word boundary. */
function truncate(title: string, limit = 80) {
  if (title.length <= limit) return title;
  const cut = title.slice(0, limit);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 40 ? cut.slice(0, lastSpace) : cut).trim()}…`;
}

const KIND_FALLBACK_TITLES: Record<AssignmentKind, string> = {
  exam: "Exam",
  quiz: "Quiz",
  paper: "Paper",
  reading: "Reading",
  problemSet: "Problem set",
  project: "Project",
  presentation: "Presentation",
  other: "Assignment",
};

export const KIND_LABELS: Record<AssignmentKind, string> = KIND_FALLBACK_TITLES;

/**
 * Splits a line that lists several dated items into one fragment each, so
 * "Midterm Oct 12, final Dec 14" yields two assignments rather than one
 * mangled title. Lines with a single date are left whole — splitting those
 * only chops titles in half.
 */
function fragmentsOf(line: string, term: TermWindow) {
  if (findDates(line, term).length < 2) return [line];

  const pieces = line.split(/[;,]\s*/).filter((piece) => piece.trim().length > 0);
  const dated = pieces.filter((piece) => findDates(piece, term).length > 0);
  // If splitting scattered the dates away from their titles, it did more harm
  // than good — fall back to the whole line.
  return dated.length >= 2 ? pieces : [line];
}

function scoreConfidence(
  text: string,
  date: DateMatch,
  strength: "strong" | "weak" | null,
): Confidence {
  const saysDue = DUE_PATTERN.test(text);
  if (date.kind === "week") return "low";
  if (strength === "strong" && saysDue) return "high";
  if (strength === "strong" || saysDue) return "medium";
  return "low";
}

function extractAssignments(paragraphs: string[], term: TermWindow): ParsedAssignment[] {
  const assignments: ParsedAssignment[] = [];
  const seen = new Set<string>();

  // Sentence by sentence, using the same splitter the reader speaks with. A
  // paragraph is often several sentences and only one of them carries the
  // deadline; taking the whole paragraph as the title drags the rest of the
  // prose along with it.
  for (const sentence of toSentences(paragraphs)) {
    const paragraph = paragraphs[sentence.paragraphIndex];
    for (const fragment of fragmentsOf(sentence.text, term)) {
      const dates = findDates(fragment, term);
      if (dates.length === 0) continue;

      // "Week 3: Problem set 1 due Sept 7" carries both kinds. The written
      // date is the real deadline; the week number is only a position in the
      // term, and reading it as the due date would be off by days.
      const date = dates.find((candidate) => candidate.kind === "explicit") ?? dates[0];
      const classified = classify(fragment);
      const saysDue = DUE_PATTERN.test(fragment);

      // A date on its own is not an assignment — it is a lecture topic, a
      // holiday, or the edition year of a textbook. Something has to mark it
      // as work before it earns a row.
      if (!classified && !saysDue) continue;

      const title = titleAround(fragment, date);
      const kind = classified?.kind ?? "other";
      // A week-based syllabus repeats the same wording every week, so the week
      // marker is the only thing telling one row from another. Keep it.
      const prefix = date.kind === "week" ? `${titleCase(date.raw.toLowerCase())} — ` : "";
      const finalTitle = truncate(
        prefix + titleCase(title.length >= 3 ? title : KIND_FALLBACK_TITLES[kind]),
      );

      // The same deliverable often appears in both a schedule table and a
      // prose summary.
      const key = `${finalTitle.toLowerCase()}|${date.iso ?? date.raw}`;
      if (seen.has(key)) continue;
      seen.add(key);

      assignments.push({
        id: `assignment-${assignments.length}`,
        title: finalTitle,
        dueAt: date.iso,
        rawDate: date.raw,
        kind,
        confidence: scoreConfidence(fragment, date, classified?.strength ?? null),
        excerpt: paragraph.length > 200 ? `${paragraph.slice(0, 200)}…` : paragraph,
      });
    }
  }

  return assignments.sort((a, b) => {
    if (a.dueAt && b.dueAt) return a.dueAt.localeCompare(b.dueAt);
    if (a.dueAt) return -1;
    if (b.dueAt) return 1;
    return 0;
  });
}

interface WeightCandidate extends GradeWeight {
  fromGradingSection: boolean;
}

function weightsInFragment(fragment: string, fromGradingSection: boolean): WeightCandidate[] {
  if (NOT_A_WEIGHT.test(fragment)) return [];

  const results: WeightCandidate[] = [];
  // "Midterms: 40%", "Midterms .... 40%", "40% midterms" — the label is
  // whichever side of the number carries the words.
  // Labels may contain digits — "Midterm 1", "Essay 2" — but must start with
  // a letter, so a bare number is never mistaken for a category name.
  const pattern = /([A-Za-z][A-Za-z\d\s/&'’-]{2,40}?)\s*[:\-–—.\s]*(\d{1,3}(?:\.\d)?)\s*%|(\d{1,3}(?:\.\d)?)\s*%\s*[:\-–—]?\s*([A-Za-z][A-Za-z\d\s/&'’-]{2,40})/g;

  let match: RegExpExecArray | null;
  while ((match = pattern.exec(fragment)) !== null) {
    const label = (match[1] ?? match[4] ?? "").replace(/\s+/g, " ").trim().replace(/[.\-–—:]+$/, "");
    const percent = Number(match[2] ?? match[3]);
    if (!label || !Number.isFinite(percent) || percent <= 0 || percent > 100) continue;
    if (GRADING_HEADING.test(label) && label.split(" ").length <= 2) continue;
    results.push({ label: titleCase(label), percent, fromGradingSection });
  }
  return results;
}

function titleCase(label: string) {
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function extractGradingWeights(paragraphs: string[]): { weights: GradeWeight[]; warnings: string[] } {
  const candidates: WeightCandidate[] = [];
  let inGradingSection = false;

  for (const paragraph of paragraphs) {
    // A short line that is only a heading turns the section on; a long line
    // mentioning grading counts as the section itself.
    const isHeading = paragraph.length < 60 && GRADING_HEADING.test(paragraph);
    if (isHeading) inGradingSection = true;

    const mentionsGrading = GRADING_HEADING.test(paragraph);
    // Dot leaders are layout, not sentences. Collapsing them first stops the
    // sentence split below from severing a label from its percentage.
    const flattened = paragraph.replace(/\.{2,}/g, " ");
    for (const fragment of flattened.split(/[;,]|\.\s+/)) {
      candidates.push(...weightsInFragment(fragment, inGradingSection || mentionsGrading));
    }

    // A paragraph with no percentages at all ends the run.
    if (!paragraph.includes("%") && !isHeading && paragraph.length > 60) inGradingSection = false;
  }

  // Percentages inside a grading section are the real breakdown; anything
  // else in the document is far more likely to be prose about statistics.
  const sectioned = candidates.filter((candidate) => candidate.fromGradingSection);
  const chosen = sectioned.length > 0 ? sectioned : candidates;

  const byLabel = new Map<string, GradeWeight>();
  for (const { label, percent } of chosen) {
    if (!byLabel.has(label.toLowerCase())) byLabel.set(label.toLowerCase(), { label, percent });
  }
  const weights = [...byLabel.values()];

  const warnings: string[] = [];
  if (weights.length > 0) {
    const total = weights.reduce((sum, weight) => sum + weight.percent, 0);
    if (Math.abs(total - 100) > 1) {
      warnings.push(
        `The grading weights add up to ${Math.round(total)}%, not 100%. Something was probably missed.`,
      );
    }
  }

  return { weights, warnings };
}

/**
 * Reads a document's extracted paragraphs for assignments and grading weights.
 * Pure and synchronous — the caller owns what happens to the result.
 */
export function parseSyllabus(
  paragraphs: string[],
  options: ParseOptions = {},
): SyllabusParseResult {
  const termStart = options.termStart ?? guessTermStart();
  const term: TermWindow = {
    start: termStart,
    months: options.termMonths ?? DEFAULT_TERM_MONTHS,
  };

  const assignments = extractAssignments(paragraphs, term);
  const { weights, warnings } = extractGradingWeights(paragraphs);

  const text = paragraphs.join("\n");
  const looksLikeSyllabus =
    SYLLABUS_HINT.test(text) || weights.length > 0 || assignments.length >= 3;

  const undated = assignments.filter((assignment) => assignment.dueAt === null).length;
  if (undated > 0) {
    warnings.push(
      `${undated} ${undated === 1 ? "item has" : "items have"} a date that could not be read. Set it by hand or remove the row.`,
    );
  }

  return { assignments, gradingWeights: weights, termStart, looksLikeSyllabus, warnings };
}
