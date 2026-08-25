/**
 * Core domain model.
 *
 * Every entity carries plain, serialisable fields only — the local storage
 * adapter and a future Supabase adapter both persist these shapes as-is.
 * Dates are ISO-8601 strings so they survive JSON round-trips.
 */

export type ISODateString = string;

/** Keys into COURSE_COLORS — stored instead of raw hex so themes can restyle. */
export type CourseColorKey =
  | "sage"
  | "sky"
  | "lavender"
  | "clay"
  | "amber"
  | "rose"
  | "teal"
  | "slate";

/** Keys into COURSE_ICONS. */
export type CourseIconKey =
  | "book"
  | "flask"
  | "calculator"
  | "globe"
  | "palette"
  | "code"
  | "heart"
  | "scale";

export interface Course {
  id: string;
  name: string;
  /** Short code shown on compact chips, e.g. "PSY 210". */
  code: string;
  instructor: string;
  /** Free-text for now; the syllabus parser will populate this later. */
  meetingInfo: string;
  color: CourseColorKey;
  icon: CourseIconKey;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

/** Fields a user actually edits; ids and timestamps are assigned by the store. */
export type CourseDraft = Omit<Course, "id" | "createdAt" | "updatedAt">;

export interface SubTask {
  id: string;
  title: string;
  done: boolean;
  /** Rough size, used to suggest how many pomodoros a step needs. */
  estimatedMinutes: number | null;
}

export type TaskStatus = "todo" | "in_progress" | "done";

export interface Task {
  id: string;
  courseId: string | null;
  title: string;
  notes: string;
  dueAt: ISODateString | null;
  status: TaskStatus;
  subtasks: SubTask[];
  /** Completed pomodoro count, for the visual timer. */
  pomodorosCompleted: number;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export type TaskDraft = Omit<
  Task,
  "id" | "createdAt" | "updatedAt" | "pomodorosCompleted"
>;

export type DocumentKind = "pdf" | "docx" | "text";

export interface StudyDocument {
  id: string;
  courseId: string | null;
  title: string;
  kind: DocumentKind;
  /** Extracted plain text, chunked into paragraphs for the read-aloud pane. */
  paragraphs: string[];
  /** Paragraph index the reader last stopped on. */
  lastParagraphIndex: number;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

/** Everything the app persists, in one serialisable envelope. */
export interface AppData {
  courses: Course[];
  tasks: Task[];
  documents: StudyDocument[];
}
