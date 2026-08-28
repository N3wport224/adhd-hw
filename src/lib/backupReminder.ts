"use client";

import { useSyncExternalStore } from "react";

/**
 * When this device last wrote a backup.
 *
 * A per-device fact, so it lives in localStorage rather than in the data —
 * a backup file restored onto a second machine should not claim that machine
 * has been backed up.
 *
 * The point of tracking it at all: everything is in one browser, and a
 * cleared cache takes a term with it. The only defence is a file somewhere
 * else, and nobody remembers to make one unaided.
 */

const STORAGE_KEY = "steady:last-backup";

/** Long enough not to nag, short enough that losing that much would sting. */
export const REMIND_AFTER_DAYS = 14;

let cached: number | null | undefined;
const listeners = new Set<() => void>();

function read(): number | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
  } catch {
    // A browser refusing storage is not worth failing a page over.
    return null;
  }
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

function getSnapshot(): number | null {
  if (cached === undefined) cached = read();
  return cached;
}

/** The server has no localStorage, so it renders as "never" and corrects on hydration. */
function getServerSnapshot(): number | null {
  return null;
}

export function markBackedUp(at = Date.now()) {
  cached = at;
  try {
    window.localStorage.setItem(STORAGE_KEY, String(at));
  } catch {
    // Nothing to do: the backup itself still happened.
  }
  for (const listener of listeners) listener();
}

export function useLastBackup(): number | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function daysSince(at: number | null, now = Date.now()): number | null {
  if (at === null) return null;
  return Math.floor((now - at) / 86_400_000);
}

/**
 * Whether it is worth saying something.
 *
 * Only ever with data to lose — a reminder to back up an empty app is pure
 * noise — and only in plain words. A badge that never clears is the kind of
 * background dread this app exists to avoid.
 */
export function backupIsOverdue(at: number | null, hasData: boolean, now = Date.now()): boolean {
  if (!hasData) return false;
  const days = daysSince(at, now);
  return days === null || days >= REMIND_AFTER_DAYS;
}

/** "Backed up today", "Backed up 3 days ago", "Never backed up". */
export function describeLastBackup(at: number | null, now = Date.now()): string {
  const days = daysSince(at, now);
  if (days === null) return "Never backed up on this device";
  if (days <= 0) return "Backed up today";
  if (days === 1) return "Backed up yesterday";
  return `Backed up ${days} days ago`;
}
