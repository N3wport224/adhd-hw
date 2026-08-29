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

/** 0 = Sunday, matching `Date.prototype.getDay`. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/**
 * When and where a class meets, in a form the calendar can place.
 *
 * Times are local "HH:MM" on a 24-hour clock rather than instants: a class
 * meets at 9:30 every week regardless of what the clocks did in between.
 */
export interface MeetingPattern {
  days: Weekday[];
  startTime: string | null;
  endTime: string | null;
  location: string;
}

/** One row of a course's grading breakdown, e.g. "Midterms" at 40%. */
export interface GradeWeight {
  label: string;
  percent: number;
}

export interface Course {
  id: string;
  name: string;
  /** Short code shown on compact chips, e.g. "PSY 210". */
  code: string;
  instructor: string;
  meetingInfo: string;
  color: CourseColorKey;
  icon: CourseIconKey;
  /**
   * First day of the term. Syllabi write "Oct 12" and "Week 4" without a
   * year, so this is what those resolve against. Optional because courses
   * created before syllabus parsing existed do not have one.
   */
  termStart?: ISODateString | null;
  /** Last day of the term. Bounds how far class meetings repeat. */
  termEnd?: ISODateString | null;
  /** Extracted from the syllabus, or entered by hand. */
  gradingWeights?: GradeWeight[];
  /** Structured meeting times, when the syllabus gave enough to place them. */
  meetingPattern?: MeetingPattern | null;
  /** Free text — too varied across syllabi to be worth structuring. */
  officeHours?: string;
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
  /** When it was ticked off, so a week can be summed up honestly. */
  doneAt?: ISODateString | null;
  /**
   * The day this step is meant to be done, as a local calendar day
   * (YYYY-MM-DD).
   *
   * A deadline says when work is due; it never says when to start. Giving
   * each step its own day is what turns "read four chapters by Friday" into
   * something that shows up on a Tuesday.
   */
  plannedFor?: ISODateString | null;
}

export type TaskStatus = "todo" | "in_progress" | "done";

/**
 * Where a task came from.
 *
 * Tasks read out of a syllabus record the document they came from, so a
 * second scan of the same file recognises what it already created instead of
 * duplicating it. Weekly lecture tasks record the week instead, which does
 * the same job when a term is topped up after its dates change.
 */
export type TaskSource =
  | {
      kind: "syllabus";
      documentId: string;
      /** The syllabus line the task was read from, for "where did this come from?". */
      excerpt: string;
    }
  | {
      kind: "lectures";
      /** Sunday of the week this covers, as a local day key. */
      weekStart: ISODateString;
    }
  | {
      kind: "calendar";
      /** The feed's own identifier, so a re-import updates rather than duplicates. */
      uid: string;
    };

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
  /**
   * Minutes actually spent on this in finished focus blocks.
   *
   * Counted in minutes rather than blocks because a block is no longer a
   * fixed length — and because minutes are what an estimate is made of.
   */
  focusMinutes?: number;
  /** When the task was finished, for the same reason steps carry one. */
  doneAt?: ISODateString | null;
  /**
   * Where you got to, in your own words.
   *
   * Put something down four days ago and coming back means re-deciding rather
   * than resuming — the reader remembers its place, and until now a task did
   * not.
   */
  resumeNote?: string;
  /** Absent for tasks the student typed in themselves. */
  source?: TaskSource;
  /**
   * What it came back marked.
   *
   * Kept as the two numbers rather than a percentage because that is what a
   * marked paper says, and because "17 out of 20" survives a rubric changing
   * its total in a way "85%" does not.
   */
  score?: TaskScore | null;
  /**
   * Readings this task actually needs, by document id.
   *
   * A task and the chapter it is about were strangers: finding the reading
   * meant leaving the task, going to the library, and remembering what you
   * were doing. Every navigation step is somewhere to fall off.
   */
  documentIds?: string[];
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

/** A mark, as the marked thing states it. */
export interface TaskScore {
  earned: number;
  outOf: number;
}

export type TaskDraft = Omit<
  Task,
  "id" | "createdAt" | "updatedAt" | "pomodorosCompleted"
>;

export type DocumentKind = "pdf" | "docx" | "text";

/** What a run of text is, structurally, rather than only what it says. */
export type BlockKind = "heading" | "paragraph" | "listItem" | "quote";

/**
 * One structural unit of a document.
 *
 * Extraction used to hand back bare strings, which made a heading, a bullet
 * and a paragraph indistinguishable — so the reader rendered a wall of
 * uniform text and read it as one undifferentiated stream.
 */
export interface DocumentBlock {
  kind: BlockKind;
  text: string;
  /** 1–3 for headings, deepest first; nesting depth for list items. */
  level?: number;
  /** The list marker as written ("1.", "•"), so numbering survives. */
  marker?: string;
}

/** Something worth keeping out of a reading, with where it came from. */
export interface DocumentNote {
  id: string;
  /** The sentence it was taken from, so it can be found again. */
  sentenceIndex: number;
  /** What the document said. */
  quote: string;
  /** What you made of it. Optional — a bare highlight is a note too. */
  comment: string;
  createdAt: ISODateString;
}

export interface StudyDocument {
  id: string;
  courseId: string | null;
  /** Editable display name; starts as the file name without its extension. */
  title: string;
  /** Original file name, kept so the library can show what was uploaded. */
  fileName: string;
  kind: DocumentKind;
  /** Size of the source file in bytes. */
  fileSize: number;
  /**
   * Extracted text, still flat. Kept because the syllabus parser reads it and
   * because documents imported before structure existed only have this.
   */
  paragraphs: string[];
  /** Structured form of the same text. Absent on documents imported earlier. */
  blocks?: DocumentBlock[];
  /** Page count for PDFs; null for formats without pages. */
  pageCount: number | null;
  /**
   * Passages kept while reading.
   *
   * Reading and doing used to be different places: an hour in the reader
   * produced nothing you could point at, which is exactly when reading stops
   * happening.
   */
  notes?: DocumentNote[];
  /**
   * Sentence index the reader last stopped on, so reopening a document
   * resumes rather than restarting. Sentences are derived from `paragraphs`
   * at read time by a single shared splitter, so the index stays valid.
   */
  lastSentenceIndex: number;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export type StudyDocumentDraft = Omit<
  StudyDocument,
  "id" | "createdAt" | "updatedAt" | "lastSentenceIndex"
>;

/** Everything the app persists, in one serialisable envelope. */
export interface AppData {
  courses: Course[];
  tasks: Task[];
  documents: StudyDocument[];
}
