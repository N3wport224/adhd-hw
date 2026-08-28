import assert from "node:assert/strict";
import { test } from "node:test";
import { describeHours, weekDone, weekLoad } from "@/lib/weekLoad";
import type { SubTask, Task } from "@/types";

const MONDAY = new Date(2026, 8, 14, 9); // a Monday, five days to Saturday

function step(id: string, plannedFor: string, extra: Partial<SubTask> = {}): SubTask {
  return { id, title: id, done: false, estimatedMinutes: null, plannedFor, ...extra };
}

function task(id: string, subtasks: SubTask[], extra: Partial<Task> = {}): Task {
  return {
    id,
    courseId: null,
    title: id,
    notes: "",
    dueAt: null,
    status: "todo",
    subtasks,
    pomodorosCompleted: 0,
    createdAt: "",
    updatedAt: "",
    ...extra,
  };
}

test("prices the rest of the week, ignoring what is already done", () => {
  const load = weekLoad(
    [
      task("Reading 1", [
        step("a", "2026-09-14"),
        step("b", "2026-09-15", { done: true }),
        step("c", "2026-09-16"),
      ]),
    ],
    MONDAY,
  );
  assert.equal(load.steps, 2);
  // Nothing known about them, so the modest default applies.
  assert.equal(load.minutes, 60);
  assert.equal(load.daysLeft, 6);
  assert.equal(load.crowded, false);
});

test("leaves out what already happened earlier in the week", () => {
  const load = weekLoad([task("Reading 1", [step("a", "2026-09-13")])], MONDAY);
  assert.equal(load.steps, 0);
});

test("uses your own record where there is one", () => {
  // Two finished quizzes at two hours each, split over four steps: half an
  // hour a step, so eight steps this week is four hours.
  const history = [
    task("Quiz 1", [], { focusMinutes: 120 }),
    task("Quiz 2", [], { focusMinutes: 120 }),
  ];
  const planned = task(
    "Quiz 3",
    ["a", "b", "c", "d"].map((id) => step(id, "2026-09-15")),
  );
  const load = weekLoad([...history, planned], MONDAY);
  assert.equal(load.minutes, 4 * 30);
});

test("says so when the week does not fit in the evenings left", () => {
  const many = Array.from({ length: 40 }, (_, i) => step(`s${i}`, "2026-09-15"));
  const load = weekLoad([task("Big", many)], MONDAY);
  // Forty half-hour steps is twenty hours across six evenings.
  assert.equal(load.crowded, true);
});

test("sums the last seven days from what was actually ticked", () => {
  const recent = new Date(2026, 8, 12).toISOString();
  const old = new Date(2026, 7, 1).toISOString();
  const done = weekDone(
    [
      task("A", [step("a", "2026-09-12", { done: true, doneAt: recent })], {
        status: "done",
        doneAt: recent,
        focusMinutes: 90,
      }),
      task("B", [step("b", "2026-08-01", { done: true, doneAt: old })], {
        status: "done",
        doneAt: old,
        focusMinutes: 60,
      }),
    ],
    MONDAY,
  );
  assert.deepEqual(done, { steps: 1, tasks: 1, minutes: 90 });
});

test("stays vague about hours, because the inputs are estimates", () => {
  assert.equal(describeHours(45), "about 45 minutes");
  assert.equal(describeHours(60), "about 1 hour");
  assert.equal(describeHours(270), "about 4½ hours");
});
