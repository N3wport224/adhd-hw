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
import { EMPTY_DATA, localDataStore } from "@/lib/storage";
import { createId } from "@/lib/utils";
import type {
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
  updateTask(id: string, patch: Partial<Omit<Task, "id" | "createdAt">>): void;
  removeTask(id: string): void;
  setSubtasks(taskId: string, subtasks: SubTask[]): void;
  toggleSubtask(taskId: string, subtaskId: string): void;
  addDocument(draft: StudyDocumentDraft): StudyDocument;
  updateDocument(
    id: string,
    patch: Partial<Omit<StudyDocument, "id" | "createdAt">>,
  ): void;
  removeDocument(id: string): void;
  /** Non-null when the last write failed — usually the disk quota. */
  saveError: string | null;
}

const AppDataContext = createContext<AppDataValue | null>(null);

export function AppDataProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<AppData>(EMPTY_DATA);
  const [ready, setReady] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
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
    setData((prev) => ({ ...prev, courses: [...prev.courses, course] }));
    return course;
  }, []);

  const updateCourse = useCallback((id: string, patch: Partial<CourseDraft>) => {
    setData((prev) => ({
      ...prev,
      courses: prev.courses.map((course) =>
        course.id === id
          ? { ...course, ...patch, updatedAt: new Date().toISOString() }
          : course,
      ),
    }));
  }, []);

  const removeCourse = useCallback((id: string) => {
    // Tasks and documents outlive their course — they are unfiled, not deleted,
    // so a mistaken course delete never destroys someone's work.
    setData((prev) => ({
      courses: prev.courses.filter((course) => course.id !== id),
      tasks: prev.tasks.map((task) =>
        task.courseId === id ? { ...task, courseId: null } : task,
      ),
      documents: prev.documents.map((doc) =>
        doc.courseId === id ? { ...doc, courseId: null } : doc,
      ),
    }));
  }, []);

  const addTask = useCallback((draft: TaskDraft) => {
    const now = new Date().toISOString();
    const task: Task = {
      ...draft,
      id: createId(),
      pomodorosCompleted: 0,
      createdAt: now,
      updatedAt: now,
    };
    setData((prev) => ({ ...prev, tasks: [...prev.tasks, task] }));
    return task;
  }, []);

  const updateTask = useCallback(
    (id: string, patch: Partial<Omit<Task, "id" | "createdAt">>) => {
      setData((prev) => ({
        ...prev,
        tasks: prev.tasks.map((task) =>
          task.id === id
            ? { ...task, ...patch, updatedAt: new Date().toISOString() }
            : task,
        ),
      }));
    },
    [],
  );

  const removeTask = useCallback((id: string) => {
    setData((prev) => ({ ...prev, tasks: prev.tasks.filter((task) => task.id !== id) }));
  }, []);

  const setSubtasks = useCallback((taskId: string, subtasks: SubTask[]) => {
    setData((prev) => ({
      ...prev,
      tasks: prev.tasks.map((task) =>
        task.id === taskId
          ? { ...task, subtasks, updatedAt: new Date().toISOString() }
          : task,
      ),
    }));
  }, []);

  const toggleSubtask = useCallback((taskId: string, subtaskId: string) => {
    setData((prev) => ({
      ...prev,
      tasks: prev.tasks.map((task) => {
        if (task.id !== taskId) return task;
        const subtasks = task.subtasks.map((step) =>
          step.id === subtaskId ? { ...step, done: !step.done } : step,
        );
        // Finishing the last step completes the task, and un-checking one
        // reopens it. Making someone tick the same box twice is exactly the
        // kind of friction that gets a tool abandoned.
        const allDone = subtasks.length > 0 && subtasks.every((step) => step.done);
        return {
          ...task,
          subtasks,
          status: allDone ? "done" : task.status === "done" ? "in_progress" : task.status,
          updatedAt: new Date().toISOString(),
        };
      }),
    }));
  }, []);

  const addDocument = useCallback((draft: StudyDocumentDraft) => {
    const now = new Date().toISOString();
    const document: StudyDocument = {
      ...draft,
      id: createId(),
      lastSentenceIndex: 0,
      createdAt: now,
      updatedAt: now,
    };
    setData((prev) => ({ ...prev, documents: [...prev.documents, document] }));
    return document;
  }, []);

  const updateDocument = useCallback(
    (id: string, patch: Partial<Omit<StudyDocument, "id" | "createdAt">>) => {
      setData((prev) => ({
        ...prev,
        documents: prev.documents.map((document) =>
          document.id === id
            ? { ...document, ...patch, updatedAt: new Date().toISOString() }
            : document,
        ),
      }));
    },
    [],
  );

  const removeDocument = useCallback((id: string) => {
    setData((prev) => ({
      ...prev,
      documents: prev.documents.filter((document) => document.id !== id),
    }));
  }, []);

  const value = useMemo<AppDataValue>(
    () => ({
      data,
      ready,
      saveError,
      addCourse,
      updateCourse,
      removeCourse,
      addTask,
      updateTask,
      removeTask,
      setSubtasks,
      toggleSubtask,
      addDocument,
      updateDocument,
      removeDocument,
    }),
    [
      data, ready, saveError,
      addCourse, updateCourse, removeCourse,
      addTask, updateTask, removeTask, setSubtasks, toggleSubtask,
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
