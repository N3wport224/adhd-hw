"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * How the reading pane is set: size, measure and typeface.
 *
 * Kept in localStorage rather than the document store because it is a
 * property of the person reading, not of anything they own — it should
 * follow them across every document on this device and never sync anywhere.
 */

export const TEXT_SIZES = ["small", "medium", "large", "huge"] as const;
export const LINE_WIDTHS = ["narrow", "normal", "wide"] as const;
export const TYPEFACES = ["sans", "serif"] as const;

export type TextSize = (typeof TEXT_SIZES)[number];
export type LineWidth = (typeof LINE_WIDTHS)[number];
export type Typeface = (typeof TYPEFACES)[number];

export interface ReaderSettings {
  textSize: TextSize;
  lineWidth: LineWidth;
  typeface: Typeface;
  /** Wider letter and word spacing, which some readers find easier to track. */
  looseSpacing: boolean;
}

export const DEFAULT_READER_SETTINGS: ReaderSettings = {
  textSize: "medium",
  lineWidth: "normal",
  typeface: "sans",
  looseSpacing: false,
};

const STORAGE_KEY = "adhd-hw:reader";

function isSettings(value: unknown): value is ReaderSettings {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<ReaderSettings>;
  return (
    TEXT_SIZES.includes(candidate.textSize as TextSize) &&
    LINE_WIDTHS.includes(candidate.lineWidth as LineWidth) &&
    TYPEFACES.includes(candidate.typeface as Typeface) &&
    typeof candidate.looseSpacing === "boolean"
  );
}

/**
 * localStorage is the source of truth, cached here so every read returns the
 * same object. `useSyncExternalStore` needs a referentially stable snapshot —
 * parsing JSON afresh on each call would hand React a new object every render
 * and spin it forever.
 */
let cached: ReaderSettings | null = null;
const listeners = new Set<() => void>();

function readStored(): ReaderSettings {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (isSettings(parsed)) return parsed;
    }
  } catch {
    // A corrupt or unreadable preference is not worth failing a page over.
  }
  return DEFAULT_READER_SETTINGS;
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

function getSnapshot(): ReaderSettings {
  if (cached === null) cached = readStored();
  return cached;
}

// The server has no stored preference, so it renders the defaults and the
// client corrects after hydration without a mismatch.
function getServerSnapshot(): ReaderSettings {
  return DEFAULT_READER_SETTINGS;
}

function write(next: ReaderSettings) {
  cached = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Private mode: the setting still applies for this session.
  }
  for (const listener of listeners) listener();
}

export function useReaderSettings() {
  const settings = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const update = useCallback((patch: Partial<ReaderSettings>) => {
    write({ ...getSnapshot(), ...patch });
  }, []);

  const reset = useCallback(() => write(DEFAULT_READER_SETTINGS), []);

  return { settings, update, reset };
}

/** Tailwind classes for a given setting, applied to the reading pane. */
export const TEXT_SIZE_CLASS: Record<TextSize, string> = {
  small: "text-base",
  medium: "text-lg",
  large: "text-xl",
  huge: "text-2xl",
};

export const LINE_WIDTH_CLASS: Record<LineWidth, string> = {
  // Measured in characters, which is what actually governs readability —
  // a fixed pixel width means something different at every text size.
  narrow: "max-w-[52ch]",
  normal: "max-w-[65ch]",
  wide: "max-w-[78ch]",
};

export const TYPEFACE_CLASS: Record<Typeface, string> = {
  sans: "font-sans",
  serif: "font-serif",
};

export const TEXT_SIZE_LABELS: Record<TextSize, string> = {
  small: "Small",
  medium: "Medium",
  large: "Large",
  huge: "Huge",
};

export const LINE_WIDTH_LABELS: Record<LineWidth, string> = {
  narrow: "Narrow",
  normal: "Normal",
  wide: "Wide",
};

export const TYPEFACE_LABELS: Record<Typeface, string> = {
  sans: "Sans",
  serif: "Serif",
};
