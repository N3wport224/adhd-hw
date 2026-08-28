import type { DocumentBlock } from "@/types";

/**
 * Turning raw extraction output into structure.
 *
 * Each source format preserves a different amount: Word knows its own
 * headings and lists, Markdown marks them with punctuation, and a PDF knows
 * nothing at all — only that some glyphs are bigger than others. These
 * functions bring all three to the same shape.
 */

/** A line of PDF text with the font size that covered most of it. */
export interface SizedLine {
  text: string;
  size: number;
}

// The hyphen sits last: anywhere else in a character class it would be read
// as a range operator rather than as a bullet.
const BULLETS = "•·◦‣∙▪●–—*-";

/** Splits a leading list marker off a line, if it has one. */
export function splitListMarker(text: string): { marker: string; rest: string } | null {
  const bullet = new RegExp(`^([${BULLETS}])\\s+(.*)$`).exec(text);
  if (bullet) return { marker: "•", rest: bullet[2] };

  // "1." / "1)" / "(1)" / "a." / "iv." — anything that numbers an item.
  const numbered = /^\(?((?:\d{1,3}|[a-zA-Z]|[ivxIVX]{1,5}))[.)]\s+(.*)$/.exec(text);
  if (numbered) return { marker: `${numbered[1]}.`, rest: numbered[2] };

  return null;
}

/**
 * A list marker with its punctuation missing.
 *
 * PDF generators often draw the number of a list item as its own positioned
 * run, so the period never reaches the text layer and "1. Broadbent" arrives
 * as "1 Broadbent". Accepting a bare number is only safe under tight limits,
 * or every sentence opening with a year becomes a bullet.
 */
function splitBareNumberMarker(text: string): { marker: string; rest: string } | null {
  const match = /^(\d{1,2})\s+([A-Z].*)$/.exec(text);
  if (!match) return null;
  const ordinal = Number(match[1]);
  // Small numbers only: a list rarely runs past thirty, and a large number
  // at the start of a line is far more likely to be a year or a quantity.
  if (ordinal < 1 || ordinal > 30) return null;
  return { marker: `${ordinal}.`, rest: match[2] };
}

function asBlock(text: string, fallback: DocumentBlock): DocumentBlock {
  const list = splitListMarker(text);
  if (list && list.rest.trim().length > 0) {
    return { kind: "listItem", text: list.rest.trim(), marker: list.marker, level: 1 };
  }
  if (/^>\s+/.test(text)) {
    return { kind: "quote", text: text.replace(/^>\s+/, "").trim() };
  }
  return fallback;
}

/** Blocks from plain text or Markdown. */
export function markdownBlocks(raw: string): DocumentBlock[] {
  const blocks: DocumentBlock[] = [];

  for (const rawLine of raw.split(/\r?\n/)) {
    const line = rawLine.replace(/\s+$/, "");
    if (line.trim().length === 0) continue;

    const heading = /^(#{1,6})\s+(.*)$/.exec(line.trim());
    if (heading) {
      blocks.push({
        kind: "heading",
        text: heading[2].trim(),
        level: Math.min(heading[1].length, 3),
      });
      continue;
    }

    // An underlined heading: "Title" followed by "=====" or "-----".
    const underline = /^[=-]{3,}$/.test(line.trim());
    const previous = blocks[blocks.length - 1];
    if (underline && previous?.kind === "paragraph") {
      blocks[blocks.length - 1] = {
        kind: "heading",
        text: previous.text,
        level: line.trim().startsWith("=") ? 1 : 2,
      };
      continue;
    }

    blocks.push(asBlock(line.trim(), { kind: "paragraph", text: line.trim() }));
  }

  return blocks;
}

const INLINE_TAGS = /<\/?(?:strong|b|em|i|u|span|a|code|sup|sub|br|small|mark)\b[^>]*>/gi;
const BLOCK_MATCH = /<(h[1-6]|p|li|blockquote)\b[^>]*>([\s\S]*?)<\/\1>/gi;

function decodeEntities(text: string) {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)));
}

/**
 * Blocks from the HTML that Word conversion produces.
 *
 * Matched with a tokeniser rather than `DOMParser` so this stays pure — it
 * can be reasoned about and tested without a browser, and the output of a
 * document converter is far more regular than HTML in general.
 */
export function htmlBlocks(html: string): DocumentBlock[] {
  const blocks: DocumentBlock[] = [];
  // Which list a <li> belongs to, so numbered lists keep their numbers.
  const listRuns = [...html.matchAll(/<(ol|ul)\b[^>]*>([\s\S]*?)<\/\1>/gi)];
  const orderedRanges = listRuns
    .filter((run) => run[1].toLowerCase() === "ol")
    .map((run) => [run.index ?? 0, (run.index ?? 0) + run[0].length] as const);

  let ordinal = 0;
  let lastListEnd = -1;

  BLOCK_MATCH.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = BLOCK_MATCH.exec(html)) !== null) {
    const tag = match[1].toLowerCase();
    // Anything still carrying angle brackets is markup, not words. Word
    // tables nest a list inside a paragraph that is never closed before it,
    // so the lazy capture above swallows the <ul><li> — which then reached
    // the page, and the voice, as literal text.
    const text = decodeEntities(
      match[2].replace(INLINE_TAGS, "").replace(/<[^>]+>/g, " "),
    )
      .replace(/\s+/g, " ")
      .trim();
    if (!text) continue;

    if (tag === "li") {
      const at = match.index;
      const ordered = orderedRanges.find(([from, to]) => at >= from && at < to);
      if (ordered) {
        // Restart numbering whenever a different ordered list begins.
        if (ordered[1] !== lastListEnd) ordinal = 0;
        lastListEnd = ordered[1];
        ordinal += 1;
      }
      blocks.push({
        kind: "listItem",
        text,
        marker: ordered ? `${ordinal}.` : "•",
        level: 1,
      });
      continue;
    }

    if (tag === "blockquote") {
      blocks.push({ kind: "quote", text });
      continue;
    }

    if (tag.startsWith("h")) {
      blocks.push({ kind: "heading", text, level: Math.min(Number(tag.slice(1)), 3) });
      continue;
    }

    blocks.push(asBlock(text, { kind: "paragraph", text }));
  }

  return blocks;
}

/**
 * The font size that covers the most characters — the body text of the
 * document, whatever it happens to be set in.
 */
export function bodyTextSize(lines: SizedLine[]) {
  const weight = new Map<number, number>();
  for (const line of lines) {
    weight.set(line.size, (weight.get(line.size) ?? 0) + line.text.length);
  }
  let best = 0;
  let bestWeight = -1;
  for (const [size, chars] of weight) {
    if (chars > bestWeight) {
      best = size;
      bestWeight = chars;
    }
  }
  return best;
}

/**
 * PDF lines break at the page margin, not at the end of a thought. Rejoining
 * them matters beyond tidiness: the reader speaks and highlights one sentence
 * at a time, and a sentence chopped across three lines would be read as three
 * disconnected fragments.
 */
export function mergeWrappedSizedLines(lines: SizedLine[]): SizedLine[] {
  const merged: SizedLine[] = [];

  for (const line of lines) {
    const previous = merged[merged.length - 1];
    const continuesPrevious =
      previous !== undefined &&
      // Only within one run of the same size — a heading and the paragraph
      // under it are never the same sentence.
      previous.size === line.size &&
      // The previous line stopped mid-sentence. A colon is treated as a stop
      // because it usually introduces a list; a semicolon is not, because it
      // almost always sits inside one continuing sentence.
      !/[.!?:]["')\]]?$/.test(previous.text) &&
      // ...and this one is not a new list item.
      splitListMarker(line.text) === null &&
      previous.text.length > 40;

    if (continuesPrevious) {
      const joiner = previous.text.endsWith("-") ? "" : " ";
      merged[merged.length - 1] = {
        text: `${previous.text.replace(/-$/, "")}${joiner}${line.text}`,
        size: previous.size,
      };
    } else {
      merged.push({ ...line });
    }
  }

  return merged;
}

/** Kept for callers that have no font information. */
export function mergeWrappedLines(lines: string[]) {
  return mergeWrappedSizedLines(lines.map((text) => ({ text, size: 1 }))).map(
    (line) => line.text,
  );
}

/**
 * Blocks from PDF lines, using relative font size as the only structural
 * signal the format actually preserves.
 *
 * The thresholds are deliberately conservative. A paragraph wrongly promoted
 * to a heading is jarring and breaks the outline; a heading left as a
 * paragraph merely looks plain, which is what the old flat output did to
 * everything anyway.
 */
export function sizedLinesToBlocks(lines: SizedLine[]): DocumentBlock[] {
  const merged = mergeWrappedSizedLines(lines);
  const body = bodyTextSize(merged);

  return merged.map((line) => {
    const text = line.text.trim();
    const ratio = body > 0 ? line.size / body : 1;

    // Size is checked before list markers, because a numbered heading —
    // "1. The cocktail party effect" set two points larger — is a heading
    // that happens to be numbered, not a bullet that happens to be big.
    if (ratio >= 1.45) return { kind: "heading" as const, text, level: 1 };
    if (ratio >= 1.22) return { kind: "heading" as const, text, level: 2 };
    if (ratio >= 1.08) return { kind: "heading" as const, text, level: 3 };

    const structural = asBlock(text, { kind: "paragraph", text });
    if (structural.kind !== "paragraph") return structural;

    const bare = splitBareNumberMarker(text);
    if (bare) {
      return { kind: "listItem" as const, text: bare.rest, marker: bare.marker, level: 1 };
    }

    // Same size as the body, but short and unpunctuated — the shape of a
    // heading in a document that never changed its font.
    if (text.length <= 60 && !/[.!?,;:]$/.test(text) && /^[A-Z0-9]/.test(text)) {
      return { kind: "heading" as const, text, level: 3 };
    }

    return structural;
  });
}

/** Legacy documents stored flat text; treat every line as a paragraph. */
export function blocksFromParagraphs(paragraphs: string[]): DocumentBlock[] {
  return paragraphs.map((text) => ({ kind: "paragraph" as const, text }));
}
