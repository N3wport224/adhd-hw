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
import type { AppData, Course, CourseDraft, Task, TaskDraft } from "@/types";

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
}

const AppDataContext = createContext<AppDataValue | null>(null);

export function AppDataProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<AppData>(EMPTY_DATA);
  const [ready, setReady] = useState(false);
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
    void localDataStore.save(data);
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

  const value = useMemo<AppDataValue>(
    () => ({
      data,
      ready,
      addCourse,
      updateCourse,
      removeCourse,
      addTask,
      updateTask,
      removeTask,
    }),
    [data, ready, addCourse, updateCourse, removeCourse, addTask, updateTask, removeTask],
  );

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData() {
  const value = useContext(AppDataContext);
  if (!value) throw new Error("useAppData must be used inside <AppDataProvider>");
  return value;
}

export function useCourse(courseId: string | null | undefined) {
  const { data } = useAppData();
  return useMemo(
    () => data.courses.find((course) => course.id === courseId) ?? null,
    [data.courses, courseId],
  );
}
