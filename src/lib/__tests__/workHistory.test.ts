import assert from "node:assert/strict";
import { test } from "node:test";
import { describeTypical, effortLabel, typicalEfforts, typicalFor } from "@/lib/workHistory";
import type { Task } from "@/types";

function task(title: string, focusMinutes?: number): Task {
  return {
    id: title,
    courseId: null,
    title,
    notes: "",
    dueAt: null,
    status: "todo",
    subtasks: [],
    pomodorosCompleted: 0,
    focusMinutes,
    createdAt: "",
    updatedAt: "",
  };
}

test("groups a task with the siblings it repeats", () => {
  // "Quiz 7" and "Quiz 8" are the same job twice, not two unrelated tasks.
  assert.equal(effortLabel("Quiz 7"), "Quiz");
  assert.equal(effortLabel("Discussion Board 12"), "Discussion Board");
  assert.equal(effortLabel("Discussion — Sep 14"), "Discussion");
  assert.equal(effortLabel("Final Exam"), "Final Exam");
});

test("waits for more than one data point before claiming a pattern", () => {
  assert.equal(typicalFor([task("Quiz 1", 30)], "Quiz 4"), null);
  const two = typicalFor([task("Quiz 1", 30), task("Quiz 2", 40)], "Quiz 4");
  assert.equal(two?.minutes, 35);
  assert.equal(two?.samples, 2);
});

test("uses the median, so one marathon does not become the expectation", () => {
  const tasks = [
    task("Reading 1", 30),
    task("Reading 2", 35),
    task("Reading 3", 40),
    task("Reading 4", 300),
  ];
  // The mean would say 101 minutes. Three of the four took about half an hour.
  assert.equal(typicalFor(tasks, "Reading 5")?.minutes, 38);
});

test("ignores tasks with no recorded time", () => {
  const efforts = typicalEfforts([task("Quiz 1", 30), task("Quiz 2"), task("Quiz 3", 0)]);
  assert.equal(efforts.size, 0);
});

test("says how long and how sure in plain words", () => {
  assert.equal(
    describeTypical({ label: "Quiz", minutes: 40, samples: 3 }),
    "About 40 minutes, going by the last 3",
  );
  assert.equal(
    describeTypical({ label: "Paper", minutes: 135, samples: 2 }),
    "About 2h 15m, going by the last 2",
  );
});
