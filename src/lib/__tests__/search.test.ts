import assert from "node:assert/strict";
import { test } from "node:test";
import { searchApp } from "@/lib/search";
import type { AppData, Course, StudyDocument, Task } from "@/types";

const course: Course = {
  id: "c1",
  name: "Engineering Project Management",
  code: "ENGR 502",
  instructor: "",
  meetingInfo: "",
  color: "sage",
  icon: "book",
  createdAt: "",
  updatedAt: "",
};

function task(id: string, title: string, steps: string[] = [], done = false): Task {
  return {
    id,
    courseId: "c1",
    title,
    notes: "",
    dueAt: null,
    status: done ? "done" : "todo",
    subtasks: steps.map((step) => ({
      id: `${id}-${step}`,
      title: step,
      done: false,
      estimatedMinutes: null,
    })),
    pomodorosCompleted: 0,
    createdAt: "",
    updatedAt: "",
  };
}

const document: StudyDocument = {
  id: "d1",
  courseId: "c1",
  title: "Risk management chapter",
  kind: "pdf",
  fileName: "risk.pdf",
  fileSize: 1024,
  pageCount: 12,
  paragraphs: [],
  lastSentenceIndex: 0,
  createdAt: "",
  updatedAt: "",
};

function app(tasks: Task[]): AppData {
  return { courses: [course], tasks, documents: [document] };
}

test("finds nothing for an empty query rather than everything", () => {
  assert.deepEqual(searchApp(app([task("t1", "Quiz 1")]), "   "), []);
});

test("finds a task by a word in the middle of its title", () => {
  const found = searchApp(app([task("t1", "Read the risk chapter")]), "risk");
  assert.ok(found.some((item) => item.kind === "task" && item.title === "Read the risk chapter"));
});

test("requires every term, so a number narrows rather than widens", () => {
  const tasks = [task("t1", "Quiz 1"), task("t2", "Quiz 3"), task("t3", "Quiz 11")];
  const titles = searchApp(app(tasks), "quiz 3").map((item) => item.title);
  assert.deepEqual(titles.filter((t) => t.startsWith("Quiz")), ["Quiz 3"]);
});

test("puts a title that starts with the query above one that merely contains it", () => {
  const tasks = [
    task("t1", "Read chapter 4 before the midterm"),
    task("t2", "Midterm Exam"),
  ];
  const found = searchApp(app(tasks), "midterm").filter((item) => item.kind === "task");
  assert.equal(found[0].title, "Midterm Exam");
});

test("searches steps, and says which task they belong to", () => {
  const found = searchApp(app([task("t1", "Week 3 work", ["Read the risk section"])]), "risk section");
  const step = found.find((item) => item.kind === "step")!;
  assert.equal(step.title, "Read the risk section");
  assert.equal(step.context, "Week 3 work");
});

test("sinks finished work below live work", () => {
  const tasks = [task("t1", "Quiz 4", [], true), task("t2", "Quiz 4 retake")];
  const found = searchApp(app(tasks), "quiz 4").filter((item) => item.kind === "task");
  assert.equal(found[0].title, "Quiz 4 retake");
});

test("finds a course by its code as well as its name", () => {
  const byCode = searchApp(app([]), "engr 502");
  assert.ok(byCode.some((item) => item.kind === "course"));
  const byName = searchApp(app([]), "project management");
  assert.ok(byName.some((item) => item.kind === "course"));
});

test("finds a reading and links straight into it", () => {
  const found = searchApp(app([]), "risk management").find((item) => item.kind === "document")!;
  assert.equal(found.href, "/reader/d1");
});

test("finds the app's own pages, so navigation needs no mouse", () => {
  const found = searchApp(app([]), "settings");
  assert.equal(found[0].kind, "page");
  assert.equal(found[0].href, "/settings");
});

test("keeps the list short enough to read", () => {
  const many = Array.from({ length: 40 }, (_, i) => task(`t${i}`, `Quiz ${i}`));
  assert.equal(searchApp(app(many), "quiz").length, 12);
});
