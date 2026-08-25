import assert from "node:assert/strict";
import { test } from "node:test";
import {
  BackupError,
  createBackup,
  mergeBackup,
  parseBackup,
} from "@/lib/backup";
import type { AppData, Course, StudyDocument, Task } from "@/types";

let counter = 0;
const nextId = () => `new-${(counter += 1)}`;
const resetIds = () => {
  counter = 0;
};

const NOW = "2026-09-01T00:00:00.000Z";

function course(id: string, name: string, code = ""): Course {
  return {
    id,
    name,
    code,
    instructor: "",
    meetingInfo: "",
    color: "sage",
    icon: "book",
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function task(id: string, title: string, courseId: string | null = null): Task {
  return {
    id,
    courseId,
    title,
    notes: "",
    dueAt: null,
    status: "todo",
    subtasks: [],
    pomodorosCompleted: 0,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function doc(id: string, title: string, courseId: string | null = null): StudyDocument {
  return {
    id,
    courseId,
    title,
    fileName: `${title}.pdf`,
    kind: "pdf",
    fileSize: 100,
    paragraphs: ["Body."],
    pageCount: 1,
    lastSentenceIndex: 0,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

const EMPTY: AppData = { courses: [], tasks: [], documents: [] };

test("a backup round-trips through parse", () => {
  const data: AppData = {
    courses: [course("c1", "Cognitive Psychology", "PSY 310")],
    tasks: [task("t1", "Problem set 1", "c1")],
    documents: [doc("d1", "syllabus", "c1")],
  };
  const parsed = parseBackup(JSON.stringify(createBackup(data)));
  assert.equal(parsed.version, 1);
  assert.deepEqual(parsed.data, data);
});

test("rejects files that are not backups", () => {
  assert.throws(() => parseBackup("not json at all"), BackupError);
  assert.throws(() => parseBackup("[1, 2, 3]"), BackupError);
  assert.throws(() => parseBackup(JSON.stringify({ version: 1 })), BackupError);
  assert.throws(
    () => parseBackup(JSON.stringify({ version: 1, data: { courses: [] } })),
    BackupError,
  );
});

test("refuses a backup from a newer version rather than guessing", () => {
  const future = JSON.stringify({ version: 99, exportedAt: NOW, data: EMPTY });
  assert.throws(() => parseBackup(future), /newer version/);
});

test("merging into an empty store brings everything across", () => {
  resetIds();
  const incoming: AppData = {
    courses: [course("c1", "Cognitive Psychology", "PSY 310")],
    tasks: [task("t1", "Problem set 1", "c1")],
    documents: [doc("d1", "syllabus", "c1")],
  };
  const report = mergeBackup(EMPTY, incoming, nextId);
  assert.deepEqual(report.added, { courses: 1, tasks: 1, documents: 1 });
  assert.deepEqual(report.skipped, { courses: 0, tasks: 0, documents: 0 });
});

test("gives every imported record a fresh id and remaps its course", () => {
  resetIds();
  const incoming: AppData = {
    courses: [course("c1", "Cognitive Psychology")],
    tasks: [task("t1", "Problem set 1", "c1")],
    documents: [doc("d1", "syllabus", "c1")],
  };
  const { data } = mergeBackup(EMPTY, incoming, nextId);
  const newCourseId = data.courses[0].id;
  assert.notEqual(newCourseId, "c1");
  assert.equal(data.tasks[0].courseId, newCourseId);
  assert.equal(data.documents[0].courseId, newCourseId);
  assert.notEqual(data.tasks[0].id, "t1");
});

test("importing the same backup twice changes nothing the second time", () => {
  resetIds();
  const incoming: AppData = {
    courses: [course("c1", "Cognitive Psychology", "PSY 310")],
    tasks: [task("t1", "Problem set 1", "c1")],
    documents: [doc("d1", "syllabus", "c1")],
  };
  const first = mergeBackup(EMPTY, incoming, nextId);
  const second = mergeBackup(first.data, incoming, nextId);

  assert.deepEqual(second.added, { courses: 0, tasks: 0, documents: 0 });
  assert.deepEqual(second.skipped, { courses: 1, tasks: 1, documents: 1 });
  assert.equal(second.data.courses.length, 1);
  assert.equal(second.data.tasks.length, 1);
  assert.equal(second.data.documents.length, 1);
});

test("attaches to a course that already exists rather than duplicating it", () => {
  resetIds();
  const current: AppData = { courses: [course("mine", "Cognitive Psychology", "PSY 310")], tasks: [], documents: [] };
  const incoming: AppData = {
    courses: [course("theirs", "cognitive psychology", "psy 310")],
    tasks: [task("t1", "New assignment", "theirs")],
    documents: [],
  };
  const { data, added, skipped } = mergeBackup(current, incoming, nextId);

  assert.equal(skipped.courses, 1);
  assert.equal(added.tasks, 1);
  assert.equal(data.courses.length, 1);
  assert.equal(data.tasks[0].courseId, "mine");
});

test("keeps two tasks with the same title under different courses", () => {
  resetIds();
  const incoming: AppData = {
    courses: [course("a", "Maths"), course("b", "Physics")],
    tasks: [task("t1", "Problem set 1", "a"), task("t2", "Problem set 1", "b")],
    documents: [],
  };
  const { added, data } = mergeBackup(EMPTY, incoming, nextId);
  assert.equal(added.tasks, 2);
  assert.notEqual(data.tasks[0].courseId, data.tasks[1].courseId);
});

test("repoints a syllabus source at the document this import created", () => {
  resetIds();
  const imported = task("t1", "Midterm", "c1");
  const incoming: AppData = {
    courses: [course("c1", "Maths")],
    documents: [doc("d1", "syllabus", "c1")],
    tasks: [{ ...imported, source: { kind: "syllabus", documentId: "d1", excerpt: "Midterm Oct 7" } }],
  };
  const { data } = mergeBackup(EMPTY, incoming, nextId);
  assert.equal(data.tasks[0].source?.documentId, data.documents[0].id);
});

test("gives subtasks fresh ids too", () => {
  resetIds();
  const withSteps: Task = {
    ...task("t1", "Essay"),
    subtasks: [{ id: "s1", title: "Outline", done: false, estimatedMinutes: null }],
  };
  const { data } = mergeBackup(EMPTY, { ...EMPTY, tasks: [withSteps] }, nextId);
  assert.notEqual(data.tasks[0].subtasks[0].id, "s1");
  assert.equal(data.tasks[0].subtasks[0].title, "Outline");
});

test("leaves what is already here untouched", () => {
  resetIds();
  const current: AppData = { courses: [], tasks: [task("mine", "My own task")], documents: [] };
  const { data } = mergeBackup(current, { ...EMPTY, tasks: [task("t1", "Imported")] }, nextId);
  assert.equal(data.tasks.length, 2);
  assert.equal(data.tasks[0].id, "mine");
});
