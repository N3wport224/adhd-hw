import assert from "node:assert/strict";
import { test } from "node:test";
import {
  bodyTextSize,
  htmlBlocks,
  markdownBlocks,
  mergeWrappedSizedLines,
  sizedLinesToBlocks,
  splitListMarker,
  type SizedLine,
} from "@/lib/documents/blocks";

const shape = (blocks: ReturnType<typeof markdownBlocks>) =>
  blocks.map((b) => [b.kind, b.text, b.level ?? null, b.marker ?? null]);

test("splits bullet and numbered list markers", () => {
  assert.deepEqual(splitListMarker("• Read chapter one"), {
    marker: "•",
    rest: "Read chapter one",
  });
  assert.deepEqual(splitListMarker("1. Read chapter one"), {
    marker: "1.",
    rest: "Read chapter one",
  });
  assert.deepEqual(splitListMarker("(a) Read chapter one"), {
    marker: "a.",
    rest: "Read chapter one",
  });
  assert.equal(splitListMarker("Read chapter one"), null);
  // A sentence that opens with a number is not a list item.
  assert.equal(splitListMarker("1998 was a long time ago"), null);
});

test("reads Markdown headings, lists and quotes", () => {
  assert.deepEqual(
    shape(markdownBlocks("# Syllabus\n\nSome prose.\n\n- First\n- Second\n\n> A quote")),
    [
      ["heading", "Syllabus", 1, null],
      ["paragraph", "Some prose.", null, null],
      ["listItem", "First", 1, "•"],
      ["listItem", "Second", 1, "•"],
      ["quote", "A quote", null, null],
    ],
  );
});

test("caps heading depth at three", () => {
  assert.equal(markdownBlocks("###### Deep")[0].level, 3);
});

test("promotes an underlined line to a heading", () => {
  assert.deepEqual(shape(markdownBlocks("Course outline\n==============\nBody text.")), [
    ["heading", "Course outline", 1, null],
    ["paragraph", "Body text.", null, null],
  ]);
});

test("reads the HTML a Word conversion produces", () => {
  const blocks = htmlBlocks(
    "<h1>Syllabus</h1><p>Some <strong>bold</strong> prose.</p>" +
      "<ul><li>First</li><li>Second</li></ul><blockquote>Quoted</blockquote>",
  );
  assert.deepEqual(shape(blocks), [
    ["heading", "Syllabus", 1, null],
    ["paragraph", "Some bold prose.", null, null],
    ["listItem", "First", 1, "•"],
    ["listItem", "Second", 1, "•"],
    ["quote", "Quoted", null, null],
  ]);
});

test("numbers an ordered list, and restarts at the next one", () => {
  const blocks = htmlBlocks(
    "<ol><li>One</li><li>Two</li></ol><p>Between</p><ol><li>Again</li></ol>",
  );
  assert.deepEqual(
    blocks.filter((b) => b.kind === "listItem").map((b) => b.marker),
    ["1.", "2.", "1."],
  );
});

test("decodes entities and drops inline markup", () => {
  assert.equal(
    htmlBlocks("<p>Rock &amp; roll &#8212; <em>loudly</em></p>")[0].text,
    "Rock & roll — loudly",
  );
});

test("skips empty blocks", () => {
  assert.deepEqual(htmlBlocks("<p></p><p>  </p><p>Real</p>").length, 1);
});

test("body size is the size covering the most characters, not the most lines", () => {
  const lines: SizedLine[] = [
    { text: "A", size: 24 },
    { text: "B", size: 24 },
    { text: "a".repeat(500), size: 11 },
  ];
  assert.equal(bodyTextSize(lines), 11);
});

test("merges wrapped lines only within one font size", () => {
  const merged = mergeWrappedSizedLines([
    { text: "Attention is the process by which the mind selects among", size: 11 },
    { text: "competing inputs.", size: 11 },
    { text: "Next Section", size: 18 },
  ]);
  assert.deepEqual(merged.map((l) => l.text), [
    "Attention is the process by which the mind selects among competing inputs.",
    "Next Section",
  ]);
});

test("never merges a heading into the paragraph beneath it", () => {
  const merged = mergeWrappedSizedLines([
    { text: "A heading with no closing punctuation that is quite long indeed", size: 18 },
    { text: "The paragraph that follows it.", size: 11 },
  ]);
  assert.equal(merged.length, 2);
});

test("classifies PDF lines by relative font size", () => {
  const blocks = sizedLinesToBlocks([
    { text: "Course Syllabus", size: 20 },
    { text: "Grading", size: 14 },
    { text: "a".repeat(300), size: 11 },
    { text: "• Problem sets are due Fridays", size: 11 },
  ]);
  assert.deepEqual(
    blocks.map((b) => [b.kind, b.level ?? null]),
    [
      ["heading", 1],
      ["heading", 2],
      ["paragraph", null],
      ["listItem", 1],
    ],
  );
});

// Each of these leads with a finished sentence: an unpunctuated line would
// be merged into whatever follows it, which is the wrapped-line rule doing
// its job rather than anything to do with classification.
const PROSE = `${"body text ".repeat(30)}ends here.`;

test("leaves body-size prose as prose", () => {
  const blocks = sizedLinesToBlocks([
    { text: PROSE, size: 11 },
    { text: PROSE, size: 11 },
  ]);
  assert.deepEqual(blocks.map((b) => b.kind), ["paragraph", "paragraph"]);
});

test("treats a short unpunctuated line as a heading even at body size", () => {
  const blocks = sizedLinesToBlocks([
    { text: PROSE, size: 11 },
    { text: "Weekly Schedule", size: 11 },
  ]);
  assert.deepEqual(blocks.map((b) => b.kind), ["paragraph", "heading"]);
});

test("a lower-case short line stays a paragraph", () => {
  const blocks = sizedLinesToBlocks([
    { text: PROSE, size: 11 },
    { text: "and so on", size: 11 },
  ]);
  assert.deepEqual(blocks.map((b) => b.kind), ["paragraph", "paragraph"]);
});

test("a numbered heading stays a heading", () => {
  const blocks = sizedLinesToBlocks([
    { text: "1. The cocktail party effect", size: 16 },
    { text: PROSE, size: 11 },
  ]);
  assert.deepEqual(blocks.map((b) => b.kind), ["heading", "paragraph"]);
  assert.equal(blocks[0].text, "1. The cocktail party effect");
});

test("recovers a list marker whose punctuation was lost in the PDF", () => {
  const blocks = sizedLinesToBlocks([
    { text: PROSE, size: 11 },
    { text: "1 Broadbent (1958), chapters 2 and 3.", size: 11 },
    { text: "2 Treisman (1964) on attenuation.", size: 11 },
  ]);
  assert.deepEqual(
    blocks.slice(1).map((b) => [b.kind, b.marker, b.text]),
    [
      ["listItem", "1.", "Broadbent (1958), chapters 2 and 3."],
      ["listItem", "2.", "Treisman (1964) on attenuation."],
    ],
  );
});

test("does not read a year or a large quantity as a list marker", () => {
  const blocks = sizedLinesToBlocks([
    { text: PROSE, size: 11 },
    { text: "1998 was a long time ago and much has changed since then.", size: 11 },
    { text: "450 Students enrolled that year across the whole programme.", size: 11 },
  ]);
  assert.deepEqual(blocks.slice(1).map((b) => b.kind), ["paragraph", "paragraph"]);
});
