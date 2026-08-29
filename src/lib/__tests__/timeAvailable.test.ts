import assert from "node:assert/strict";
import { test } from "node:test";
import { describeStepMinutes, stepMinutes, stepsThatFit } from "@/lib/timeAvailable";
import type { PlannedStep } from "@/lib/schedule";
import type { SubTask, Task } from "@/types";

function step(title: string, estimatedMinutes: number | null): SubTask {
  return { id: title, title, done: false, estimatedMinutes, plannedFor: "2026-09-14" };
}

function task(title: string, steps: SubTask[], extra: Partial<Task> = {}): Task {
  return {
    id: title,
    courseId: "c1",
    title,
    notes: "",
    dueAt: null,
    status: "todo",
    subtasks: steps,
    pomodorosCompleted: 0,
    createdAt: "",
    updatedAt: "",
    ...extra,
  };
}

function entries(t: Task): PlannedStep[] {
  return t.subtasks.map((s) => ({ task: t, step: s }));
}

test("uses the step's own estimate where it has one", () => {
  const t = task("Read chapter 4", [step("skim", 10)]);
  assert.equal(stepMinutes(entries(t)[0], [t]), 10);
});

test("falls back to what this kind of work has actually cost", () => {
  // A finished discussion board that took 60 minutes over two steps.
  const history = task("Discussion Board 1", [step("a", null), step("b", null)], {
    status: "done",
    doneAt: "2026-09-01T00:00:00.000Z",
    focusMinutes: 60,
  });
  const live = task("Discussion Board 2", [step("c", null), step("d", null)]);
  assert.equal(stepMinutes(entries(live)[0], [history, live]), 30);
});

test("falls back to a modest guess when nothing is known", () => {
  const t = task("Something new", [step("a", null)]);
  assert.equal(stepMinutes(entries(t)[0], [t]), 30);
});

test("shows everything when no window is chosen", () => {
  const t = task("t", [step("a", 10), step("b", 120)]);
  assert.equal(stepsThatFit(entries(t), null, [t]).length, 2);
});

test("keeps only what fits the window", () => {
  const t = task("t", [step("a", 10), step("b", 15), step("c", 45)]);
  const fits = stepsThatFit(entries(t), 15, [t]).map((entry) => entry.step.title);
  assert.deepEqual(fits, ["a", "b"]);
});

test("counts a step exactly the length of the window as fitting", () => {
  const t = task("t", [step("a", 30)]);
  assert.equal(stepsThatFit(entries(t), 30, [t]).length, 1);
});

test("describes a step in the unit a person would say it in", () => {
  assert.equal(describeStepMinutes(20), "20 min");
  assert.equal(describeStepMinutes(60), "1 hr");
  assert.equal(describeStepMinutes(90), "1½ hr");
  assert.equal(describeStepMinutes(120), "2 hr");
});
