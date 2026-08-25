import assert from "node:assert/strict";
import { test } from "node:test";
import { stepsForTemplate, suggestSteps, templateForTitle } from "../taskBreakdown.ts";

test("recognises common assignment shapes from the title", () => {
  assert.equal(templateForTitle("Write essay on attention")?.id, "essay");
  assert.equal(templateForTitle("Read Chapter 4")?.id, "reading");
  assert.equal(templateForTitle("Problem set 3")?.id, "problemSet");
  assert.equal(templateForTitle("Study for the midterm")?.id, "exam");
  assert.equal(templateForTitle("Group presentation slides")?.id, "presentation");
  assert.equal(templateForTitle("Build the lab prototype")?.id, "project");
});

test("matches regardless of case", () => {
  assert.equal(templateForTitle("READ CH. 7")?.id, "reading");
});

test("returns no template when nothing matches", () => {
  assert.equal(templateForTitle("Email the registrar"), null);
});

test("always suggests steps, matched or not", () => {
  assert.ok(suggestSteps("Email the registrar").length > 0);
  assert.deepEqual(suggestSteps("Read Chapter 4"), stepsForTemplate("reading"));
});

test("falls back to generic steps for an unknown template id", () => {
  assert.deepEqual(stepsForTemplate("nope"), suggestSteps("Email the registrar"));
});

test("every suggested step is a non-empty single line", () => {
  for (const title of ["Write essay", "Read Chapter 1", "Anything else"]) {
    for (const step of suggestSteps(title)) {
      assert.ok(step.trim().length > 0, `empty step for "${title}"`);
      assert.ok(!step.includes("\n"), `multi-line step for "${title}"`);
    }
  }
});
