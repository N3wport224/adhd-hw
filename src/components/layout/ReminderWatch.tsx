"use client";

import { useAppData } from "@/lib/appData";
import { useReminders } from "@/lib/reminders";

/**
 * Renders nothing; watches the clock.
 *
 * Kept as its own component rather than a hook call inside AppShell so that a
 * change to a single task does not re-render the whole frame — the shell has
 * no business subscribing to the data it wraps.
 */
export function ReminderWatch() {
  const { data, ready } = useAppData();
  useReminders(data, ready);
  return null;
}
