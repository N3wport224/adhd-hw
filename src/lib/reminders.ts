"use client";

import { useEffect, useSyncExternalStore } from "react";
import { meetingsOnDay, stepsOnDay, toDayKey } from "@/lib/schedule";
import { useLatestRef } from "@/lib/useLatestRef";
import type { AppData } from "@/types";

/**
 * The one thing the app could not do: speak first.
 *
 * Everything else here is pull — it works if you remember to open it, which
 * is asking precisely the thing ADHD is worst at. Prospective memory, the
 * remembering to remember, is the deficit; a tool that waits to be visited
 * does not help with it.
 *
 * Honest limit: these fire only while a tab is open. Real push would need a
 * service worker and a server to push from, and this app has neither on
 * purpose — everything stays on the device.
 */

const STORAGE_KEY = "steady:reminders";
/** Minutes before a class to say something. */
const LEAD_MINUTES = 15;
/** After this hour, an untouched day is worth a nudge. */
const EVENING_HOUR = 19;
/** How often to look. A minute is plenty for something measured in hours. */
const CHECK_MS = 60_000;

let cached: boolean | undefined;
const listeners = new Set<() => void>();

function read(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "on";
  } catch {
    return false;
  }
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

function getSnapshot(): boolean {
  if (cached === undefined) cached = read();
  return cached;
}

/** The server has no preference and no Notification API; it renders as off. */
function getServerSnapshot(): boolean {
  return false;
}

export function remindersSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

/** Support never changes within a page, so there is nothing to listen to. */
function subscribeToNothing() {
  return () => {};
}

/**
 * The same answer, but safe to render with.
 *
 * Branching on `remindersSupported()` directly in a component makes the first
 * client paint disagree with the HTML the server sent — the server has no
 * Notification API — and React responds by throwing the whole tree away and
 * drawing it again. This says no until hydration is finished, then tells the
 * truth on the next paint.
 */
export function useRemindersSupported(): boolean {
  return useSyncExternalStore(subscribeToNothing, remindersSupported, getServerSnapshot);
}

export function useRemindersOn(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function setRemindersOn(on: boolean) {
  cached = on;
  try {
    window.localStorage.setItem(STORAGE_KEY, on ? "on" : "off");
  } catch {
    // A browser refusing storage still gets reminders for this session.
  }
  for (const listener of listeners) listener();
}

/** Asks the browser, and only turns the setting on if it says yes. */
export async function enableReminders(): Promise<NotificationPermission> {
  if (!remindersSupported()) return "denied";
  const permission =
    Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
  setRemindersOn(permission === "granted");
  return permission;
}

/** What a check found worth saying, if anything. */
export interface Reminder {
  /** Stable within a day, so the same thing is never said twice. */
  key: string;
  title: string;
  body: string;
}

function minutesUntil(day: string, time: string, now: Date): number {
  const [hour, minute] = time.split(":").map(Number);
  const at = new Date(`${day}T00:00:00`);
  at.setHours(hour, minute, 0, 0);
  return Math.round((at.getTime() - now.getTime()) / 60_000);
}

/**
 * What is worth saying right now.
 *
 * Kept pure so the rule — and the silence, which matters more — can be tested
 * without a browser or a clock.
 */
export function dueReminders(data: AppData, now = new Date()): Reminder[] {
  const day = toDayKey(now);
  const found: Reminder[] = [];

  for (const meeting of meetingsOnDay(data.courses, day)) {
    if (!meeting.startTime) continue;
    const away = minutesUntil(day, meeting.startTime, now);
    // A window, not a moment: a check every minute must not miss it, and must
    // not repeat it either.
    if (away > LEAD_MINUTES || away <= LEAD_MINUTES - 5) continue;
    found.push({
      key: `class|${day}|${meeting.course.id}`,
      title: `${meeting.course.code || meeting.course.name} starts in ${away} minutes`,
      body: meeting.location ? `In ${meeting.location}.` : "Time to head over.",
    });
  }

  const steps = stepsOnDay(data.tasks, day).filter((entry) => !entry.step.done);
  if (now.getHours() >= EVENING_HOUR && steps.length > 0) {
    found.push({
      key: `evening|${day}`,
      title: `${steps.length} ${steps.length === 1 ? "thing" : "things"} planned for today`,
      // Named rather than counted: "one thing" is a number, "read the first
      // half" is a thing you can picture starting.
      body: steps[0].step.title + (steps.length > 1 ? ` — and ${steps.length - 1} more.` : ""),
    });
  }

  return found;
}

/**
 * Watches the clock while a tab is open and says the things worth saying.
 *
 * What has already been said is remembered for the session only: the point is
 * not to repeat inside one sitting, and a new day says new things anyway.
 */
export function useReminders(data: AppData, ready: boolean) {
  const on = useRemindersOn();
  const dataRef = useLatestRef(data);

  useEffect(() => {
    if (!on || !ready || !remindersSupported() || Notification.permission !== "granted") return;

    const said = new Set<string>();
    const check = () => {
      for (const reminder of dueReminders(dataRef.current)) {
        if (said.has(reminder.key)) continue;
        said.add(reminder.key);
        try {
          new Notification(reminder.title, { body: reminder.body, tag: reminder.key });
        } catch {
          // Some browsers refuse construction outside a service worker; the
          // app carries on regardless.
        }
      }
    };

    const timer = window.setInterval(check, CHECK_MS);
    check();
    return () => window.clearInterval(timer);
  }, [on, ready, dataRef]);
}
