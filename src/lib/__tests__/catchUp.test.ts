import assert from "node:assert/strict";
import { test } from "node:test";
import { catchUpPlan, describeCatchUp, hasSlipped } from "@/lib/catchUp";
import type { Course, SubTask, Task } from "@/types";

const TODAY = "2026-09-14";

const course: Course = {
  id: "c1",
  name: "Systems Engineering",
  code: "ENGR 501",
  instructor: "",
  meetingInfo: "",
  color: "sage",
  icon: "book",
  termStart: "2026-08-24",
  termEnd: "2026-12-11",
  // Monday evenings, like the real one.
  meetingPattern: { days: [1], startTime: "17:15", endTime: "20:00", location: "" },
  createdAt: "",
  updatedAt: "",
};

function step(title: string, plannedFor: string | null, done = false): SubTask {
  return { id: title, title, done, estimatedMinutes: 30, plannedFor };
}

function task(id: string, dueAt: string | null, subtasks: SubTask[]): Task {
  return {
    id,
    courseId: "c1",
    title: id,
    notes: "",
    dueAt,
    status: "todo",
    subtasks,
    pomodorosCompleted: 0,
    createdAt: "",
    updatedAt: "",
  };
}

test("moves only what actually slipped", () => {
  const t = task("t1", "2026-09-25", [
    step("a", "2026-09-08"),
    step("b", "2026-09-20"),
  ]);
  const plan = catchUpPlan([t], [], TODAY);
  assert.equal(plan.stepCount, 1);
  assert.equal(plan.tasks[0].slipped.length, 1);
  assert.equal(plan.tasks[0].slipped[0].title, "a");
});

test("leaves finished steps on the day they actually happened", () => {
  const t = task("t1", "2026-09-25", [
    step("done last week", "2026-09-07", true),
    step("late", "2026-09-08"),
  ]);
  const plan = catchUpPlan([t], [], TODAY);
  const kept = plan.tasks[0].subtasks.find((s) => s.title === "done last week")!;
  assert.equal(kept.plannedFor, "2026-09-07");
});

test("re-spreads the whole remaining task, not only the late part", () => {
  // Leaving tomorrow's step where it is while three late ones land on today
  // rebuilds exactly the crush that caused the backlog.
  const t = task("t1", "2026-09-25", [
    step("a", "2026-09-08"),
    step("b", "2026-09-09"),
    step("c", "2026-09-30"),
  ]);
  const plan = catchUpPlan([t], [], TODAY);
  for (const s of plan.tasks[0].subtasks) {
    assert.ok(s.plannedFor! >= TODAY, `${s.title} landed on ${s.plannedFor}`);
  }
});

test("keeps each task inside its own deadline", () => {
  const t = task("t1", "2026-09-17", [step("a", "2026-09-01"), step("b", "2026-09-02")]);
  const plan = catchUpPlan([t], [], TODAY);
  for (const s of plan.tasks[0].subtasks) assert.ok(s.plannedFor! <= "2026-09-17");
});

test("gives a deadline already gone today rather than a day in the past", () => {
  const t = task("t1", "2026-09-01", [step("a", "2026-08-30")]);
  const plan = catchUpPlan([t], [], TODAY);
  assert.equal(plan.tasks[0].overdue, true);
  assert.equal(plan.tasks[0].subtasks[0].plannedFor, TODAY);
});

test("steers clear of class nights when there is room to", () => {
  // 14 Sep 2026 is a Monday, and this course meets on Mondays.
  const t = task("t1", "2026-09-25", [step("a", "2026-09-08"), step("b", "2026-09-09")]);
  const plan = catchUpPlan([t], [course], TODAY);
  for (const s of plan.tasks[0].subtasks) {
    assert.notEqual(s.plannedFor, "2026-09-14", "landed on a class night");
  }
});

test("uses a class night rather than dropping the step", () => {
  // The deadline is the class night itself: there is nowhere else to go.
  const t = task("t1", TODAY, [step("a", "2026-09-01")]);
  const plan = catchUpPlan([t], [course], TODAY);
  assert.equal(plan.tasks[0].subtasks[0].plannedFor, TODAY);
});

test("ignores a task that is already finished", () => {
  const t = { ...task("t1", "2026-09-25", [step("a", "2026-09-01")]), status: "done" as const };
  assert.equal(catchUpPlan([t], [], TODAY).stepCount, 0);
  assert.equal(hasSlipped([t], TODAY), false);
});

test("ignores a step with no day at all", () => {
  const t = task("t1", "2026-09-25", [step("a", null)]);
  assert.equal(catchUpPlan([t], [], TODAY).stepCount, 0);
  assert.equal(hasSlipped([t], TODAY), false);
});

test("says nothing has slipped rather than showing an empty plan", () => {
  assert.equal(
    describeCatchUp(catchUpPlan([], [], TODAY)),
    "Nothing has slipped. This is all up to date.",
  );
});

test("states the size of the pile", () => {
  const tasks = [
    task("t1", "2026-09-25", [step("a", "2026-09-01"), step("b", "2026-09-02")]),
    task("t2", "2026-09-25", [step("c", "2026-09-03")]),
  ];
  const text = describeCatchUp(catchUpPlan(tasks, [], TODAY));
  assert.match(text, /^3 steps across 2 tasks, spread from today to /);
});
