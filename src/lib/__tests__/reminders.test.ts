import assert from "node:assert/strict";
import { test } from "node:test";
import { dueReminders } from "@/lib/reminders";
import type { AppData, Course, SubTask, Task } from "@/types";

/** A Monday, chosen because both of the real courses meet on one. */
const MONDAY = "2026-09-14";

function at(time: string): Date {
  return new Date(`${MONDAY}T${time}:00`);
}

const course: Course = {
  id: "c1",
  name: "Engineering Project Management",
  code: "ENGR 502",
  instructor: "",
  meetingInfo: "",
  color: "sage",
  icon: "book",
  termStart: "2026-08-24",
  termEnd: "2026-12-11",
  meetingPattern: { days: [1], startTime: "17:15", endTime: "20:00", location: "Hall 204" },
  createdAt: "",
  updatedAt: "",
};

function step(title: string, done = false): SubTask {
  return { id: title, title, done, estimatedMinutes: 30, plannedFor: MONDAY };
}

function taskWith(...subtasks: SubTask[]): Task {
  return {
    id: "t1",
    courseId: "c1",
    title: "Read the risk chapter",
    notes: "",
    dueAt: null,
    status: "todo",
    subtasks,
    pomodorosCompleted: 0,
    createdAt: "",
    updatedAt: "",
  };
}

function appData(tasks: Task[] = [], courses: Course[] = [course]): AppData {
  return { courses, tasks, documents: [] };
}

test("says a class is coming within the lead window", () => {
  const [reminder] = dueReminders(appData(), at("17:02"));
  assert.match(reminder.title, /ENGR 502 starts in 13 minutes/);
  assert.equal(reminder.body, "In Hall 204.");
});

test("stays quiet an hour before the same class", () => {
  assert.deepEqual(dueReminders(appData(), at("16:15")), []);
});

test("stays quiet once the class has started", () => {
  assert.deepEqual(dueReminders(appData(), at("17:16")), []);
});

test("stays quiet on a day the course does not meet", () => {
  // The Tuesday after, at the same time of day.
  assert.deepEqual(dueReminders(appData(), new Date("2026-09-15T17:02:00")), []);
});

test("stays quiet outside the term", () => {
  const finished = { ...course, termEnd: "2026-09-01" };
  assert.deepEqual(dueReminders(appData([], [finished]), at("17:02")), []);
});

test("keys a class reminder to the day so it cannot repeat", () => {
  const [first] = dueReminders(appData(), at("17:02"));
  const [second] = dueReminders(appData(), at("17:03"));
  assert.equal(first.key, second.key);
  assert.equal(first.key, `class|${MONDAY}|c1`);
});

test("names the first unfinished step in the evening rather than counting", () => {
  const task = taskWith(step("Read pages 40 to 60"), step("Write the summary"));
  const found = dueReminders(appData([task]), at("20:30"));
  const evening = found.find((item) => item.key.startsWith("evening"));
  assert.ok(evening);
  assert.equal(evening.title, "2 things planned for today");
  assert.equal(evening.body, "Read pages 40 to 60 — and 1 more.");
});

test("does not nudge in the evening once every step is ticked", () => {
  const task = taskWith(step("Read pages 40 to 60", true));
  assert.deepEqual(dueReminders(appData([task]), at("20:30")), []);
});

test("does not nudge about the evening in the afternoon", () => {
  const task = taskWith(step("Read pages 40 to 60"));
  assert.deepEqual(dueReminders(appData([task]), at("14:00")), []);
});

test("says nothing at all when there is nothing on", () => {
  assert.deepEqual(dueReminders({ courses: [], tasks: [], documents: [] }, at("19:30")), []);
});
