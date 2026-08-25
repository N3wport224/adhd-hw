import assert from "node:assert/strict";
import { test } from "node:test";
import { estimateMinutes, groupByParagraph, toSentences } from "../sentences.ts";

const textOf = (paragraphs: string[]) => toSentences(paragraphs).map((s) => s.text);

test("splits a paragraph on sentence-ending punctuation", () => {
  assert.deepEqual(textOf(["One thing. Then another! And a third?"]), [
    "One thing.",
    "Then another!",
    "And a third?",
  ]);
});

test("keeps abbreviations inside their sentence", () => {
  assert.deepEqual(textOf(["Dr. Reyes assigned Ch. 4 today. Read it by Friday."]), [
    "Dr. Reyes assigned Ch. 4 today.",
    "Read it by Friday.",
  ]);
});

test("does not split on decimals or domains", () => {
  assert.deepEqual(textOf(["The mean was 3.5 overall."]), ["The mean was 3.5 overall."]);
  assert.deepEqual(textOf(["Submit via canvas.example.edu before noon."]), [
    "Submit via canvas.example.edu before noon.",
  ]);
});

test("keeps a single initial attached to its name", () => {
  assert.deepEqual(textOf(["Work by J. Smith is on the syllabus."]), [
    "Work by J. Smith is on the syllabus.",
  ]);
});

test("absorbs trailing quotes and repeated punctuation", () => {
  assert.deepEqual(textOf(['She said "start early." Then she left.']), [
    'She said "start early."',
    "Then she left.",
  ]);
  assert.deepEqual(textOf(["Really?! I had no idea."]), ["Really?!", "I had no idea."]);
});

test("keeps a trailing fragment that has no final punctuation", () => {
  assert.deepEqual(textOf(["A complete thought. An unfinished one"]), [
    "A complete thought.",
    "An unfinished one",
  ]);
});

test("numbers sentences continuously across paragraphs", () => {
  const sentences = toSentences(["First. Second.", "Third."]);
  assert.deepEqual(
    sentences.map((s) => [s.index, s.paragraphIndex]),
    [
      [0, 0],
      [1, 0],
      [2, 1],
    ],
  );
});

test("ignores paragraphs with no sentences", () => {
  assert.deepEqual(toSentences([]), []);
  assert.deepEqual(toSentences(["   "]), []);
});

test("groups sentences back under their paragraph", () => {
  const groups = groupByParagraph(toSentences(["First. Second.", "Third."]));
  assert.deepEqual(
    groups.map((group) => group.map((sentence) => sentence.text)),
    [["First.", "Second."], ["Third."]],
  );
});

test("estimates at least one minute for any content", () => {
  assert.equal(estimateMinutes(["Short."]), 1);
  assert.equal(estimateMinutes([Array(310).fill("word").join(" ")]), 2);
});

test("keeps a leading enumerator attached to what it numbers", () => {
  assert.deepEqual(textOf(["1. The cocktail party effect"]), [
    "1. The cocktail party effect",
  ]);
  assert.deepEqual(textOf(["(2) What to read next."]), ["(2) What to read next."]);
  assert.deepEqual(textOf(["iv. Attenuation theory"]), ["iv. Attenuation theory"]);
});

test("still splits a numbered item that contains several sentences", () => {
  assert.deepEqual(textOf(["1. Read the chapter. Then take notes."]), [
    "1. Read the chapter.",
    "Then take notes.",
  ]);
});
