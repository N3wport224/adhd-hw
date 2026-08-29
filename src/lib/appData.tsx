"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { blocksFromParagraphs } from "@/lib/documents/blocks";
import { EMPTY_DATA, localDataStore } from "@/lib/storage";
import { useLatestRef } from "@/lib/useLatestRef";
import { createId } from "@/lib/utils";
import type {
  TaskSource,
  AppData,
  Course,
  CourseDraft,
  StudyDocument,
  StudyDocumentDraft,
  SubTask,
  Task,
  TaskDraft,
} from "@/types";

interface AppDataValue {
  data: AppData;
  /** False until the persisted data has been read on the client. */
  ready: boolean;
  addCourse(draft: CourseDraft): Course;
  updateCourse(id: string, patch: Partial<CourseDraft>): void;
  removeCourse(id: string): void;
  addTask(draft: TaskDraft): Task;
  /**
   * Adds many tasks at once, skipping any that duplicate a task already
   * imported from the same document.
   */
  importTasks(drafts: TaskDraft[]): { added: number; skipped: number };
  updateTask(id: string, patch: Partial<Omit<Task, "id" | "createdAt">>): void;
  removeTask(id: string): void;
  setSubtasks(taskId: string, subtasks: SubTask[]): void;
  /** Assigns one step its own day, or clears it. */
  setSubtaskDay(taskId: string, subtaskId: string, plannedFor: string | null): void;
  toggleSubtask(taskId: string, subtaskId: string): void;
  addDocument(draft: StudyDocumentDraft): StudyDocument;
  updateDocument(
    id: string,
    patch: Partial<Omit<StudyDocument, "id" | "createdAt">>,
  ): void;
  removeDocument(id: string): void;
  /** Non-null when the last write failed — usually the disk quota. */
  saveError: string | null;
  /** Wholesale replacement, for importing a backup or starting over. */
  replaceAll(data: AppData): void;
  /**
   * The one destructive thing just done, if it can still be taken back.
   *
   * One step, not a stack. "How far back am I?" is its own load, and the
   * mistake you want to undo is almost always the last thing you did.
   */
  undoable: { label: string } | null;
  undo(): void;
  dismissUndo(): void;
}

/**
 * How far two readings of the same deadline may sit apart.
 *
 * A syllabus files a week's work under the Friday; the course feed files it
 * under the Sunday it is actually due. Both are describing one quiz.
 */
const SAME_WORK_DAYS = 4;

/** A title with the punctuation and spacing that two sources disagree about removed. */
function sameThing(title: string) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const AppDataContext = createContext<AppDataValue | null>(null);

export function AppDataProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<AppData>(EMPTY_DATA);
  const [ready, setReady] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [undoable, setUndoable] = useState<{ label: string; data: AppData } | null>(null);
  // Lets callbacks read the newest data without becoming dependencies of it.
  const dataRef = useLatestRef(data);
  const undoRef = useLatestRef(undoable);

  /**
   * Every change to the store goes through here.
   *
   * Anything that declares a label can be taken back; anything that does not
   * clears whatever was outstanding. That second half is the safety: undo can
   * only ever restore the state from immediately before the last destructive
   * action, so an offer left on screen for ten minutes cannot swallow ten
   * minutes of work when it is finally clicked. Since nothing can have
   * changed while the offer stands, it needs no timeout either — and an undo
   * that expires in five seconds is no use to someone who notices the mistake
   * in twenty.
   *
   * The snapshot is a reference, not a copy. AppData is only ever replaced,
   * never edited in place, so holding the previous one costs nothing.
   */
  const mutate = useCallback(
    (updater: (prev: AppData) => AppData, undoLabel?: string) => {
      setUndoable(undoLabel ? { label: undoLabel, data: dataRef.current } : null);
      setData(updater);
    },
    [dataRef],
  );

  const undo = useCallback(() => {
    const snapshot = undoRef.current;
    if (!snapshot) return;
    setData(snapshot.data);
    setUndoable(null);
  }, [undoRef]);

  const dismissUndo = useCallback(() => setUndoable(null), []);
  // Guards the save effect so the first render never writes EMPTY_DATA over
  // whatever is already in storage.
  const loaded = useRef(false);

  useEffect(() => {
    let active = true;
    localDataStore.load().then((stored) => {
      if (!active) return;
      setData(stored);
      loaded.current = true;
      setReady(true);
    });
    return () => {
      active = false;
    };
    // Mount only. This is the one write that must not go through mutate — it
    // is storage arriving, not the student changing anything.
  }, []);

  useEffect(() => {
    if (!loaded.current) return;
    let active = true;
    localDataStore.save(data).then(
      () => {
        if (active) setSaveError(null);
      },
      (error: unknown) => {
        // Documents are large enough to hit the storage quota, and silently
        // losing an upload is worse than saying so.
        if (!active) return;
        setSaveError(
          error instanceof Error && /quota|storage/i.test(error.message)
            ? "There is no room left to save. Remove a document to free some up."
            : "Your last change could not be saved.",
        );
      },
    );
    return () => {
      active = false;
    };
  }, [data]);

  const addCourse = useCallback((draft: CourseDraft) => {
    const now = new Date().toISOString();
    const course: Course = { ...draft, id: createId(), createdAt: now, updatedAt: now };
    mutate((prev) => ({ ...prev, courses: [...prev.courses, course] }));
    return course;
  }, [mutate]);

  const updateCourse = useCallback((id: string, patch: Partial<CourseDraft>) => {
    mutate((prev) => ({
      ...prev,
      courses: prev.courses.map((course) =>
        course.id === id
          ? { ...course, ...patch, updatedAt: new Date().toISOString() }
          : course,
      ),
    }));
  }, [mutate]);

  const removeCourse = useCallback(
    (id: string) => {
      const name = dataRef.current.courses.find((course) => course.id === id)?.name;
      // Tasks and documents outlive their course — they are unfiled, not deleted,
      // so a mistaken course delete never destroys someone's work.
      mutate(
        (prev) => ({
          courses: prev.courses.filter((course) => course.id !== id),
          tasks: prev.tasks.map((task) =>
            task.courseId === id ? { ...task, courseId: null } : task,
          ),
          documents: prev.documents.map((doc) =>
            doc.courseId === id ? { ...doc, courseId: null } : doc,
          ),
        }),
        name ? `Deleted ${name}` : "Deleted a course",
      );
    },
    [mutate, dataRef],
  );

  const addTask = useCallback((draft: TaskDraft) => {
    const now = new Date().toISOString();
    const task: Task = {
      ...draft,
      id: createId(),
      pomodorosCompleted: 0,
      createdAt: now,
      updatedAt: now,
    };
    mutate((prev) => ({ ...prev, tasks: [...prev.tasks, task] }));
    return task;
  }, [mutate]);

  const importTasks = useCallback(
    (drafts: TaskDraft[]) => {
      // Deduplicated here rather than inside the state updater: React may run
      // an updater late or twice, and the counts reported back to the student
      // ("added 8, skipped 3") have to be the real ones.
      //
      // Re-scanning a syllabus, or topping up a term of lectures, should be
      // safe. A syllabus task is the same import if it came from the same
      // document and shares a title and due date; a weekly lecture task if it
      // covers the same week of the same course. Anything the student has
      // since edited no longer matches, and so is left alone — an edited task
      // is exactly the one that must not be silently replaced.
      const importKey = (
        source: TaskSource | undefined,
        task: { courseId: string | null; title: string; dueAt: string | null },
      ) =>
        source?.kind === "lectures"
          ? `lectures|${task.courseId}|${source.weekStart}`
          : source?.kind === "calendar"
            ? // The feed's own id, which survives the assignment being renamed
              // or its deadline moving.
              `calendar|${source.uid}`
            : `syllabus|${source?.kind === "syllabus" ? source.documentId : ""}|${task.title
                .trim()
                .toLowerCase()}|${task.dueAt ?? ""}`;

      const existing = new Set(
        dataRef.current.tasks
          .filter((task) => task.source !== undefined)
          .map((task) => importKey(task.source, task)),
      );

      // The keys above are per-source, which is right for topping one source
      // up — and useless across two. Scanning the syllabus and then importing
      // the course feed describes the same term twice, and every quiz landed
      // in the list a second time. So identity is also checked the way a
      // person would: same course, same name, around the same day.
      const already = dataRef.current.tasks
        .filter((task) => task.source !== undefined)
        .map((task) => ({
          courseId: task.courseId,
          name: sameThing(task.title),
          day: task.dueAt ? Date.parse(task.dueAt) : null,
        }));

      const describesSameWork = (draft: TaskDraft) => {
        const name = sameThing(draft.title);
        const day = draft.dueAt ? Date.parse(draft.dueAt) : null;
        return already.some(
          (task) =>
            task.courseId === draft.courseId &&
            task.name === name &&
            (task.day === null || day === null
              ? task.day === day
              : Math.abs(task.day - day) <= SAME_WORK_DAYS * 86_400_000),
        );
      };

      const now = new Date().toISOString();
      const fresh: Task[] = [];
      let skipped = 0;

      for (const draft of drafts) {
        const key = importKey(draft.source, draft);
        if (existing.has(key) || describesSameWork(draft)) {
          skipped += 1;
          continue;
        }
        existing.add(key);
        already.push({
          courseId: draft.courseId,
          name: sameThing(draft.title),
          day: draft.dueAt ? Date.parse(draft.dueAt) : null,
        });
        fresh.push({
          ...draft,
          id: createId(),
          // Steps get their own ids here too. A step is addressed by id when
          // it is ticked off, so a draft that arrives without one — or with
          // the same one on every step — would tick the wrong box.
          subtasks: draft.subtasks.map((step) => ({ ...step, id: createId() })),
          pomodorosCompleted: 0,
          createdAt: now,
          updatedAt: now,
        });
      }

      if (fresh.length > 0) {
        mutate((prev) => ({ ...prev, tasks: [...prev.tasks, ...fresh] }));
      }
      return { added: fresh.length, skipped };
    },
    [mutate, dataRef],
  );

  const updateTask = useCallback(
    (id: string, patch: Partial<Omit<Task, "id" | "createdAt">>) => {
      mutate((prev) => ({
        ...prev,
        tasks: prev.tasks.map((task) => {
          if (task.id !== id) return task;
          const now = new Date().toISOString();
          const next = { ...task, ...patch, updatedAt: now };
          // The same stamp the steps carry, for the same reason.
          if (patch.status !== undefined && patch.doneAt === undefined) {
            next.doneAt = patch.status === "done" ? now : null;
          }
          return next;
        }),
      }));
    },
    [mutate],
  );

  const removeTask = useCallback(
    (id: string) => {
      const title = dataRef.current.tasks.find((task) => task.id === id)?.title;
      mutate(
        (prev) => ({ ...prev, tasks: prev.tasks.filter((task) => task.id !== id) }),
        title ? `Deleted “${title}”` : "Deleted a task",
      );
    },
    [mutate, dataRef],
  );

  const setSubtasks = useCallback((taskId: string, subtasks: SubTask[]) => {
    mutate((prev) => ({
      ...prev,
      tasks: prev.tasks.map((task) =>
        task.id === taskId
          ? { ...task, subtasks, updatedAt: new Date().toISOString() }
          : task,
      ),
    }));
  }, [mutate]);

  const setSubtaskDay = useCallback(
    (taskId: string, subtaskId: string, plannedFor: string | null) => {
      mutate((prev) => ({
        ...prev,
        tasks: prev.tasks.map((task) =>
          task.id === taskId
            ? {
                ...task,
                subtasks: task.subtasks.map((step) =>
                  step.id === subtaskId ? { ...step, plannedFor } : step,
                ),
                updatedAt: new Date().toISOString(),
              }
            : task,
        ),
      }));
    },
    [mutate],
  );

  const toggleSubtask = useCallback((taskId: string, subtaskId: string) => {
    mutate((prev) => ({
      ...prev,
      tasks: prev.tasks.map((task) => {
        if (task.id !== taskId) return task;
        const now = new Date().toISOString();
        const subtasks = task.subtasks.map((step) =>
          step.id === subtaskId
            ? // Stamped when ticked and cleared when un-ticked, so a week can
              // be summed from a record rather than an impression.
              { ...step, done: !step.done, doneAt: step.done ? null : now }
            : step,
        );
        // Finishing the last step completes the task, and un-checking one
        // reopens it. Making someone tick the same box twice is exactly the
        // kind of friction that gets a tool abandoned.
        const allDone = subtasks.length > 0 && subtasks.every((step) => step.done);
        const status = allDone ? "done" : task.status === "done" ? "in_progress" : task.status;
        return {
          ...task,
          subtasks,
          status,
          doneAt: status === "done" ? (task.doneAt ?? now) : null,
          updatedAt: now,
        };
      }),
    }));
  }, [mutate]);

  const addDocument = useCallback((draft: StudyDocumentDraft) => {
    const now = new Date().toISOString();
    const document: StudyDocument = {
      ...draft,
      id: createId(),
      lastSentenceIndex: 0,
      createdAt: now,
      updatedAt: now,
    };
    mutate((prev) => ({ ...prev, documents: [...prev.documents, document] }));
    return document;
  }, [mutate]);

  const updateDocument = useCallback(
    (id: string, patch: Partial<Omit<StudyDocument, "id" | "createdAt">>) => {
      mutate((prev) => ({
        ...prev,
        documents: prev.documents.map((document) =>
          document.id === id
            ? { ...document, ...patch, updatedAt: new Date().toISOString() }
            : document,
        ),
      }));
    },
    [mutate],
  );

  const removeDocument = useCallback(
    (id: string) => {
      const title = dataRef.current.documents.find((document) => document.id === id)?.title;
      mutate(
        (prev) => ({
          ...prev,
          documents: prev.documents.filter((document) => document.id !== id),
        }),
        title ? `Removed “${title}”` : "Removed a document",
      );
    },
    [mutate, dataRef],
  );

  /**
   * Wholesale replacement — a backup import, or starting over.
   *
   * The most destructive thing the app can do, and so the one that most needs
   * taking back. "Delete everything" already asks twice; this is what catches
   * the person who meant it and then did not.
   */
  const replaceAll = useCallback(
    (next: AppData) => {
      const had = dataRef.current;
      const emptied =
        next.courses.length + next.tasks.length + next.documents.length === 0 &&
        had.courses.length + had.tasks.length + had.documents.length > 0;
      mutate(() => next, emptied ? "Deleted everything" : "Replaced everything with a backup");
    },
    [mutate, dataRef],
  );

  const value = useMemo<AppDataValue>(
    () => ({
      data,
      ready,
      saveError,
      replaceAll,
      addCourse,
      updateCourse,
      removeCourse,
      addTask,
      importTasks,
      updateTask,
      removeTask,
      setSubtasks,
      setSubtaskDay,
      toggleSubtask,
      addDocument,
      updateDocument,
      removeDocument,
      undoable: undoable ? { label: undoable.label } : null,
      undo,
      dismissUndo,
    }),
    [
      undoable, undo, dismissUndo,
      data, ready, saveError, replaceAll,
      addCourse, updateCourse, removeCourse,
      addTask, importTasks, updateTask, removeTask, setSubtasks, setSubtaskDay, toggleSubtask,
      addDocument, updateDocument, removeDocument,
    ],
  );

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData() {
  const value = useContext(AppDataContext);
  if (!value) throw new Error("useAppData must be used inside <AppDataProvider>");
  return value;
}

/**
 * A document's structure, synthesised for anything imported before blocks
 * existed so the reader never has to branch on which era a document is from.
 */
export function documentBlocks(document: StudyDocument) {
  return document.blocks ?? blocksFromParagraphs(document.paragraphs);
}

export function useDocument(documentId: string | null | undefined) {
  const { data } = useAppData();
  return useMemo(
    () => data.documents.find((document) => document.id === documentId) ?? null,
    [data.documents, documentId],
  );
}

export function useCourse(courseId: string | null | undefined) {
  const { data } = useAppData();
  return useMemo(
    () => data.courses.find((course) => course.id === courseId) ?? null,
    [data.courses, courseId],
  );
}
