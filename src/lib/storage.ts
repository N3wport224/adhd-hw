import type { AppData } from "@/types";

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
const DB_VERSION = 1;
const STORE_NAME = "app";
const RECORD_KEY = "data";

/** Pre-IndexedDB storage location, read once so early data is not stranded. */
const LEGACY_STORAGE_KEY = "adhd-hw:v1";

function isAppData(value: unknown): value is AppData {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<AppData>;
  return (
    Array.isArray(candidate.courses) &&
    Array.isArray(candidate.tasks) &&
    Array.isArray(candidate.documents)
  );
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not available in this browser"));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open the database"));
    // Private-mode Firefox resolves neither callback; don't hang the app on it.
    request.onblocked = () => reject(new Error("The database is blocked by another tab"));
  });
}

function readRecord(db: IDBDatabase): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(RECORD_KEY);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not read saved data"));
  });
}

function writeRecord(db: IDBDatabase, data: AppData): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(data, RECORD_KEY);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("Could not save your changes"));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("Could not save your changes"));
  });
}

/** Reads the pre-IndexedDB record, if one is still sitting in localStorage. */
function readLegacyData(): AppData | null {
  try {
    const raw = window.localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isAppData(parsed) ? parsed : null;
  } catch {
    return null;
  }
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
      const stored = await readRecord(db);
      if (isAppData(stored)) return stored;

      // First run on this browser. Adopt any pre-IndexedDB data, then retire it.
      const legacy = readLegacyData();
      if (legacy) {
        await writeRecord(db, legacy);
        try {
          window.localStorage.removeItem(LEGACY_STORAGE_KEY);
        } catch {
          // Leaving the old copy behind is harmless — it is only read when
          // IndexedDB has nothing.
        }
        return legacy;
      }
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
      await writeRecord(db, data);
    } finally {
      db.close();
    }
  },
};
