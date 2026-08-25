import type { AppData } from "@/types";

/**
 * Persistence boundary.
 *
 * The app talks to this interface only, so swapping localStorage for Supabase
 * later means adding one adapter rather than touching any component.
 */
export interface DataStore {
  load(): Promise<AppData>;
  save(data: AppData): Promise<void>;
}

export const EMPTY_DATA: AppData = { courses: [], tasks: [], documents: [] };

const STORAGE_KEY = "adhd-hw:v1";

function isAppData(value: unknown): value is AppData {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<AppData>;
  return (
    Array.isArray(candidate.courses) &&
    Array.isArray(candidate.tasks) &&
    Array.isArray(candidate.documents)
  );
}

export const localDataStore: DataStore = {
  async load() {
    if (typeof window === "undefined") return EMPTY_DATA;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return EMPTY_DATA;
      const parsed: unknown = JSON.parse(raw);
      return isAppData(parsed) ? parsed : EMPTY_DATA;
    } catch {
      // A corrupt or unreadable store should never block the app from opening.
      return EMPTY_DATA;
    }
  },

  async save(data) {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // Quota or private-mode failures are non-fatal; the session stays usable.
    }
  },
};
