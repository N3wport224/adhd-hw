import type { AppData, Course, StudyDocument, Task } from "@/types";

/**
 * Export and import of everything the app holds.
 *
 * The data lives in one browser's IndexedDB and nowhere else. Browsers evict
 * that under storage pressure, and clearing site data wipes it outright — so
 * a term's courses, deadlines and readings can vanish without anyone doing
 * anything wrong. A file the student keeps is the only real answer.
 */

export const BACKUP_VERSION = 1;

export interface BackupFile {
  version: number;
  exportedAt: string;
  data: AppData;
}

export class BackupError extends Error {}

export function createBackup(data: AppData): BackupFile {
  return { version: BACKUP_VERSION, exportedAt: new Date().toISOString(), data };
}

export function backupFileName(now = new Date()) {
  return `steady-backup-${now.toISOString().slice(0, 10)}.json`;
}

function isAppData(value: unknown): value is AppData {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<AppData>;
  return (
    Array.isArray(candidate.courses) &&
    Array.isArray(candidate.tasks) &&
    Array.isArray(candidate.documents)
  );
}

/**
 * Reads a backup file, rejecting anything that is not one.
 *
 * Deliberately strict: importing a half-understood file over a term's work is
 * worse than refusing it, and the error has to say which of the two it is.
 */
export function parseBackup(text: string): BackupFile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new BackupError("That file is not readable. A backup is a .json file.");
  }

  if (typeof parsed !== "object" || parsed === null) {
    throw new BackupError("That file does not look like a Steady backup.");
  }

  const candidate = parsed as Partial<BackupFile>;
  if (!isAppData(candidate.data)) {
    throw new BackupError("That file does not look like a Steady backup.");
  }
  if (typeof candidate.version !== "number" || candidate.version > BACKUP_VERSION) {
    throw new BackupError(
      "That backup was made by a newer version of the app. Update before importing it.",
    );
  }

  return {
    version: candidate.version,
    exportedAt: typeof candidate.exportedAt === "string" ? candidate.exportedAt : "",
    data: candidate.data,
  };
}

export interface MergeReport {
  data: AppData;
  added: { courses: number; tasks: number; documents: number };
  skipped: { courses: number; tasks: number; documents: number };
}

const norm = (value: string | null | undefined) => (value ?? "").trim().toLowerCase();

const courseKey = (course: Course) => `${norm(course.name)}|${norm(course.code)}`;
const taskKey = (task: Task, courseId: string | null) =>
  `${courseId ?? ""}|${norm(task.title)}|${task.dueAt ?? ""}`;
const documentKey = (document: StudyDocument, courseId: string | null) =>
  `${courseId ?? ""}|${norm(document.title)}|${norm(document.fileName)}`;

/**
 * Adds a backup's contents to what is already here.
 *
 * Every imported record is given a fresh id and its references remapped, so
 * importing a backup taken on this same device can never collide with what it
 * was taken from. Anything that matches something already present is skipped
 * rather than duplicated — importing twice leaves you where one import did.
 */
export function mergeBackup(
  current: AppData,
  incoming: AppData,
  createId: () => string,
): MergeReport {
  const courses = [...current.courses];
  const tasks = [...current.tasks];
  const documents = [...current.documents];

  const existingCourses = new Map(courses.map((course) => [courseKey(course), course.id]));
  const existingTasks = new Set(tasks.map((task) => taskKey(task, task.courseId)));
  const existingDocuments = new Set(
    documents.map((document) => documentKey(document, document.courseId)),
  );

  const added = { courses: 0, tasks: 0, documents: 0 };
  const skipped = { courses: 0, tasks: 0, documents: 0 };

  // Old course id -> the id it should point at here, whether newly added or
  // already present under a different id.
  const courseIdMap = new Map<string, string>();

  for (const course of incoming.courses) {
    const key = courseKey(course);
    const existing = existingCourses.get(key);
    if (existing) {
      courseIdMap.set(course.id, existing);
      skipped.courses += 1;
      continue;
    }
    const id = createId();
    courseIdMap.set(course.id, id);
    existingCourses.set(key, id);
    courses.push({ ...course, id });
    added.courses += 1;
  }

  const remap = (courseId: string | null) =>
    courseId === null ? null : (courseIdMap.get(courseId) ?? null);

  // Documents before tasks, so a task's syllabus source points at the
  // document this import actually created.
  const documentIdMap = new Map<string, string>();
  for (const document of incoming.documents) {
    const courseId = remap(document.courseId);
    const key = documentKey(document, courseId);
    if (existingDocuments.has(key)) {
      skipped.documents += 1;
      continue;
    }
    const id = createId();
    documentIdMap.set(document.id, id);
    existingDocuments.add(key);
    documents.push({ ...document, id, courseId });
    added.documents += 1;
  }

  for (const task of incoming.tasks) {
    const courseId = remap(task.courseId);
    const key = taskKey(task, courseId);
    if (existingTasks.has(key)) {
      skipped.tasks += 1;
      continue;
    }
    existingTasks.add(key);
    tasks.push({
      ...task,
      id: createId(),
      courseId,
      subtasks: task.subtasks.map((step) => ({ ...step, id: createId() })),
      source: task.source
        ? { ...task.source, documentId: documentIdMap.get(task.source.documentId) ?? "" }
        : undefined,
    });
    added.tasks += 1;
  }

  return { data: { courses, tasks, documents }, added, skipped };
}

/** Rough size of a backup, for telling someone what they are about to save. */
export function estimateBackupBytes(data: AppData) {
  try {
    return new Blob([JSON.stringify(createBackup(data))]).size;
  } catch {
    return JSON.stringify(createBackup(data)).length;
  }
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
