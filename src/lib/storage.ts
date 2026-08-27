import type { AppData, StudyDocument } from "@/types";

/**
 * Persistence boundary.
 *
 * The app talks to this interface only, so swapping the local adapter for
 * Supabase later means adding one adapter rather than touching any component.
 */
export interface DataStore {
  load(): Promise<AppData>;
  /** Rejects if the write failed, so callers can tell the user. */
  save(data: AppData): Promise<void>;
}

export const EMPTY_DATA: AppData = { courses: [], tasks: [], documents: [] };

const DB_NAME = "adhd-hw";
/** v2 split documents into their own store; v1 kept everything in one record. */
const DB_VERSION = 2;
const CORE_STORE = "app";
const DOCUMENT_STORE = "documents";
const CORE_KEY = "data";

/** Pre-IndexedDB storage location, read once so early data is not stranded. */
const LEGACY_STORAGE_KEY = "adhd-hw:v1";

/** What the core record holds: everything small and frequently written. */
interface CoreRecord {
  courses: AppData["courses"];
  tasks: AppData["tasks"];
  /** Present only on records written before documents were split out. */
  documents?: StudyDocument[];
}

function isCoreRecord(value: unknown): value is CoreRecord {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<CoreRecord>;
  return Array.isArray(candidate.courses) && Array.isArray(candidate.tasks);
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not available in this browser"));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(CORE_STORE)) db.createObjectStore(CORE_STORE);
      if (!db.objectStoreNames.contains(DOCUMENT_STORE)) db.createObjectStore(DOCUMENT_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open the database"));
    // Private-mode Firefox resolves neither callback; don't hang the app on it.
    request.onblocked = () => reject(new Error("The database is blocked by another tab"));
  });
}

function readAll<T>(db: IDBDatabase, store: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const request = db.transaction(store, "readonly").objectStore(store).getAll();
    request.onsuccess = () => resolve(request.result as T[]);
    request.onerror = () => reject(request.error ?? new Error("Could not read saved data"));
  });
}

function readCore(db: IDBDatabase): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const request = db.transaction(CORE_STORE, "readonly").objectStore(CORE_STORE).get(CORE_KEY);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not read saved data"));
  });
}

/** Reads the pre-IndexedDB record, if one is still sitting in localStorage. */
function readLegacyData(): AppData | null {
  try {
    const raw = window.localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isCoreRecord(parsed)) return null;
    return { ...parsed, documents: parsed.documents ?? [] };
  } catch {
    return null;
  }
}

/**
 * The documents as they were last written, by id and by identity.
 *
 * Every mutation used to rewrite the whole store, so ticking one checkbox
 * re-serialised every reading a student had ever imported. Measured across a
 * realistic term that cost 12ms at 5MB, 75ms at 27MB and 200ms at 71MB — a
 * visible stutter on the single most common action in the app, growing with
 * material that has nothing to do with what changed.
 *
 * Document objects are replaced rather than mutated, so reference equality is
 * an exact test for "this one needs writing".
 */
let lastWritten = new Map<string, StudyDocument>();

function writeChanges(db: IDBDatabase, data: AppData): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([CORE_STORE, DOCUMENT_STORE], "readwrite");
    const core = transaction.objectStore(CORE_STORE);
    const documents = transaction.objectStore(DOCUMENT_STORE);

    core.put({ courses: data.courses, tasks: data.tasks } satisfies CoreRecord, CORE_KEY);

    const next = new Map(data.documents.map((document) => [document.id, document]));
    for (const document of data.documents) {
      if (lastWritten.get(document.id) !== document) documents.put(document, document.id);
    }
    for (const id of lastWritten.keys()) {
      if (!next.has(id)) documents.delete(id);
    }

    transaction.oncomplete = () => {
      // Only after the write lands, so a failure leaves the next save to
      // retry everything rather than assuming it succeeded.
      lastWritten = next;
      resolve();
    };
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("Could not save your changes"));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("Could not save your changes"));
  });
}

/**
 * IndexedDB rather than localStorage: a term's worth of extracted PDF text
 * runs to megabytes, and localStorage's ~5MB budget would start rejecting
 * uploads well before a student ran out of anything they'd recognise.
 */
export const localDataStore: DataStore = {
  async load() {
    if (typeof window === "undefined") return EMPTY_DATA;

    let db: IDBDatabase;
    try {
      db = await openDatabase();
    } catch {
      // No IndexedDB (private mode, locked-down browser): fall back to
      // whatever the legacy store holds so the app still opens.
      return readLegacyData() ?? EMPTY_DATA;
    }

    try {
      const core = await readCore(db);

      if (isCoreRecord(core)) {
        // A record written before the split still carries its documents; take
        // them from there and let the next save move them across.
        const documents = core.documents ?? (await readAll<StudyDocument>(db, DOCUMENT_STORE));
        const data = { courses: core.courses, tasks: core.tasks, documents };
        lastWritten = core.documents
          ? new Map()
          : new Map(documents.map((document) => [document.id, document]));
        return data;
      }

      // First run on this browser. Adopt any pre-IndexedDB data, then retire it.
      const legacy = readLegacyData();
      if (legacy) {
        await writeChanges(db, legacy);
        try {
          window.localStorage.removeItem(LEGACY_STORAGE_KEY);
        } catch {
          // Leaving the old copy behind is harmless — it is only read when
          // IndexedDB has nothing.
        }
        return legacy;
      }

      lastWritten = new Map();
      return EMPTY_DATA;
    } catch {
      return EMPTY_DATA;
    } finally {
      db.close();
    }
  },

  async save(data) {
    if (typeof window === "undefined") return;
    const db = await openDatabase();
    try {
      await writeChanges(db, data);
    } finally {
      db.close();
    }
  },
};
