import assert from "node:assert/strict";
import { test } from "node:test";
import { kindForFile, mergeWrappedLines, titleFromFileName } from "../extract.ts";

test("maps file extensions to document kinds", () => {
  assert.equal(kindForFile("syllabus.pdf"), "pdf");
  assert.equal(kindForFile("NOTES.PDF"), "pdf");
  assert.equal(kindForFile("notes.docx"), "docx");
  assert.equal(kindForFile("list.txt"), "text");
  assert.equal(kindForFile("readme.md"), "text");
});

test("rejects unsupported and extensionless files", () => {
  assert.equal(kindForFile("scan.jpg"), null);
  assert.equal(kindForFile("essay.doc"), null);
  assert.equal(kindForFile("noextension"), null);
});

test("turns a file name into a readable title", () => {
  assert.equal(titleFromFileName("week_3-reading.pdf"), "week 3 reading");
  assert.equal(titleFromFileName("syllabus.pdf"), "syllabus");
  assert.equal(titleFromFileName("noextension"), "noextension");
});

test("rejoins a sentence broken across wrapped lines", () => {
  assert.deepEqual(
    mergeWrappedLines([
      "Attention is the process by which the mind selects among competing",
      "inputs from the environment.",
    ]),
    ["Attention is the process by which the mind selects among competing inputs from the environment."],
  );
});

test("treats a semicolon as mid-sentence but a colon as a stop", () => {
  const semicolon = mergeWrappedLines([
    "Working memory holds roughly four chunks at once, which is not fixed;",
    "chunking raises the ceiling.",
  ]);
  assert.equal(semicolon.length, 1);

  const colon = mergeWrappedLines([
    "The grading breakdown for this course is split across four components:",
    "participation, midterms, the final paper, and problem sets.",
  ]);
  assert.equal(colon.length, 2);
});

test("keeps list items and headings on their own", () => {
  assert.deepEqual(
    mergeWrappedLines([
      "The reading list for the midterm covers the following three works",
      "- Broadbent (1958)",
      "1. Treisman (1964)",
    ]),
    [
      "The reading list for the midterm covers the following three works",
      "- Broadbent (1958)",
      "1. Treisman (1964)",
    ],
  );
});

test("does not glue a short line onto the next one", () => {
  // Short lines are headings and captions far more often than wrapped prose.
  assert.deepEqual(mergeWrappedLines(["Week 1", "Read the assigned chapter."]), [
    "Week 1",
    "Read the assigned chapter.",
  ]);
});

test("closes a hyphenated word split across lines", () => {
  assert.deepEqual(
    mergeWrappedLines([
      "Unattended channels are attenuated rather than blocked out-",
      "right by the filter.",
    ]),
    ["Unattended channels are attenuated rather than blocked outright by the filter."],
  );
});
