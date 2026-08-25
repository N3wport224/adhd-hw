/**
 * A sentence of a document, with the paragraph it came from so the reader can
 * render paragraph structure while highlighting one sentence at a time.
 */
export interface Sentence {
  /** Position in the flat sentence list — the unit playback and resume use. */
  index: number;
  paragraphIndex: number;
  text: string;
}

/**
 * Abbreviations whose trailing period does not end a sentence. Without this,
 * "Dr. Reyes" and "Ch. 4" each become two fragments, and the reader pauses
 * mid-name every time.
 */
const ABBREVIATIONS = new Set([
  "mr", "mrs", "ms", "dr", "prof", "sr", "jr", "st",
  "vs", "etc", "eg", "ie", "cf", "al", "ca", "approx",
  "fig", "figs", "ch", "chap", "sec", "pp", "vol", "no", "ed", "eds",
  "jan", "feb", "mar", "apr", "jun", "jul", "aug", "sept", "sep", "oct", "nov", "dec",
  "mon", "tue", "tues", "wed", "thu", "thur", "thurs", "fri", "sat", "sun",
  "u.s", "u.k", "e.g", "i.e", "a.m", "p.m", "ph.d", "b.a", "m.a",
]);

function endsWithAbbreviation(text: string) {
  const match = /(?:^|[\s(])([A-Za-z][A-Za-z.]*)\.$/.exec(text);
  if (!match) return false;
  return ABBREVIATIONS.has(match[1].toLowerCase().replace(/\.$/, ""));
}

/**
 * Splits a paragraph on sentence-ending punctuation.
 *
 * Deliberately not `Intl.Segmenter`: its sentence granularity is unevenly
 * implemented across browsers, and the reader's highlighting has to line up
 * with what is actually spoken on every one of them.
 */
function splitParagraph(paragraph: string) {
  const sentences: string[] = [];
  let current = "";

  for (let i = 0; i < paragraph.length; i += 1) {
    const char = paragraph[i];
    current += char;

    if (char !== "." && char !== "!" && char !== "?") continue;

    // Absorb trailing quotes, brackets and repeated punctuation ("...", "?!").
    while (i + 1 < paragraph.length && /[.!?"')\]]/.test(paragraph[i + 1])) {
      i += 1;
      current += paragraph[i];
    }

    const next = paragraph[i + 1];
    // A sentence break needs whitespace after it; "3.5" and "example.com" don't have it.
    if (next !== undefined && !/\s/.test(next)) continue;
    if (endsWithAbbreviation(current)) continue;
    // A single initial ("J. Smith") is a name, not the end of a thought.
    if (/(?:^|\s)[A-Z]\.$/.test(current)) continue;
    // A leading enumerator — "1.", "(2)", "iv." — numbers what follows
    // rather than ending anything. Splitting here makes the reader say
    // "one." and stop, before starting the heading as if it were new.
    if (/^\(?[\divxIVX]{1,4}[.)]$/.test(current.trim())) continue;

    sentences.push(current.trim());
    current = "";
  }

  if (current.trim()) sentences.push(current.trim());
  return sentences.filter((sentence) => sentence.length > 0);
}

/** Flattens a document's paragraphs into the numbered sentences the reader plays. */
export function toSentences(paragraphs: string[]): Sentence[] {
  const sentences: Sentence[] = [];
  paragraphs.forEach((paragraph, paragraphIndex) => {
    for (const text of splitParagraph(paragraph)) {
      sentences.push({ index: sentences.length, paragraphIndex, text });
    }
  });
  return sentences;
}

/** Groups sentences back under their paragraph, for rendering the reading pane. */
export function groupByParagraph(sentences: Sentence[]) {
  const groups: Sentence[][] = [];
  for (const sentence of sentences) {
    const group = groups[groups.length - 1];
    if (group && group[0].paragraphIndex === sentence.paragraphIndex) {
      group.push(sentence);
    } else {
      groups.push([sentence]);
    }
  }
  return groups;
}

/** Rough reading time, shown so a document's length is known before starting. */
export function estimateMinutes(paragraphs: string[]) {
  const words = paragraphs.reduce(
    (total, paragraph) => total + paragraph.split(/\s+/).filter(Boolean).length,
    0,
  );
  // ~155 wpm is a comfortable synthesised-speech pace at 1x.
  return Math.max(1, Math.round(words / 155));
}
