import assert from "node:assert/strict";
import { test } from "node:test";
import {
  addMonths,
  describeWeek,
  dayKeyOf,
  groupByDay,
  monthGrid,
  nextDayWithWork,
  startOfWeek,
  toDayKey,
  weekDays,
} from "@/lib/schedule";
import type { Task } from "@/types";

const local = (y: number, m: number, d: number) => new Date(y, m - 1, d);

function task(id: string, dueAt: string | null, title = id): Task {
  return {
    id,
    courseId: null,
    title,
    notes: "",
    dueAt,
    status: "todo",
    subtasks: [],
    pomodorosCompleted: 0,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
  };
}

test("keys a date by its local calendar day", () => {
  assert.equal(toDayKey(local(2026, 10, 12)), "2026-10-12");
  assert.equal(toDayKey(local(2026, 1, 5)), "2026-01-05");
});

test("groups a due date under the local day it was picked, not the UTC one", () => {
  // Stored the way the app stores it: the instant of local midnight.
  const stored = local(2026, 10, 12).toISOString();
  assert.equal(dayKeyOf(stored), "2026-10-12");
});

test("a week runs Sunday to Saturday around its anchor", () => {
  // 2026-10-12 is a Monday.
  const days = weekDays(local(2026, 10, 12), local(2026, 10, 12));
  assert.equal(days.length, 7);
  assert.equal(days[0].key, "2026-10-11");
  assert.equal(days[6].key, "2026-10-17");
});

test("marks today, and only today", () => {
  const days = weekDays(local(2026, 10, 12), local(2026, 10, 14));
  assert.deepEqual(days.filter((day) => day.isToday).map((day) => day.key), ["2026-10-14"]);
});

test("startOfWeek is stable on a day that is already Sunday", () => {
  assert.equal(toDayKey(startOfWeek(local(2026, 10, 11))), "2026-10-11");
});

test("a month grid is whole weeks, padded either side", () => {
  const cells = monthGrid(local(2026, 10, 1), local(2026, 10, 1));
  assert.equal(cells.length % 7, 0);
  // October 2026 starts on a Thursday, so the grid opens on Sept 27.
  assert.equal(cells[0].key, "2026-09-27");
  assert.equal(cells[0].inCurrentMonth, false);
  assert.ok(cells.at(-1)!.key >= "2026-10-31");
  assert.equal(cells.filter((c) => c.inCurrentMonth).length, 31);
});

test("a month grid never runs past six weeks", () => {
  for (const month of [1, 2, 3, 5, 8, 12]) {
    const cells = monthGrid(local(2026, month, 1), local(2026, 1, 1));
    assert.ok(cells.length <= 42, `month ${month} produced ${cells.length} cells`);
  }
});

test("stepping months does not skip one from the 31st", () => {
  assert.equal(toDayKey(addMonths(local(2026, 1, 31), 1)), "2026-02-01");
  assert.equal(toDayKey(addMonths(local(2026, 12, 15), 1)), "2027-01-01");
  assert.equal(toDayKey(addMonths(local(2026, 1, 15), -1)), "2025-12-01");
});

test("describes a week without ever producing a partial-format string", () => {
  // Sep 6-12 2026 sits inside one month; Sep 27 - Oct 3 crosses one;
  // Dec 27 2026 - Jan 2 2027 crosses the year.
  const within = describeWeek(local(2026, 9, 8));
  const acrossMonth = describeWeek(local(2026, 9, 30));
  const acrossYear = describeWeek(local(2026, 12, 30));

  for (const text of [within, acrossMonth, acrossYear]) {
    assert.doesNotMatch(text, /\(day:/, `partial format leaked into "${text}"`);
    assert.match(text, /2026|2027/);
  }
  assert.equal(within, "Sep 6 – 12, 2026");
  assert.equal(acrossMonth, "Sep 27 – Oct 3, 2026");
  assert.equal(acrossYear, "Dec 27, 2026 – Jan 2, 2027");
});

test("groups tasks by day and ignores undated ones", () => {
  const grouped = groupByDay([
    task("a", local(2026, 10, 12).toISOString()),
    task("b", local(2026, 10, 12).toISOString()),
    task("c", local(2026, 10, 14).toISOString()),
    task("d", null),
  ]);
  assert.deepEqual([...grouped.keys()].sort(), ["2026-10-12", "2026-10-14"]);
  assert.equal(grouped.get("2026-10-12")!.length, 2);
});

test("finds the next day that still has unfinished work", () => {
  const done = { ...task("x", local(2026, 10, 8).toISOString()), status: "done" as const };
  const grouped = groupByDay([
    task("past", local(2026, 9, 1).toISOString()),
    done,
    task("later", local(2026, 10, 12).toISOString()),
  ]);
  // The nearer day holds only a completed task, so it is skipped.
  assert.equal(nextDayWithWork("2026-10-01", grouped), "2026-10-12");
  // Days before the cutoff are never suggested.
  assert.equal(nextDayWithWork("2026-11-01", grouped), null);
  // The cutoff day itself counts.
  assert.equal(nextDayWithWork("2026-10-12", grouped), "2026-10-12");
});

test("orders a day's tasks predictably", () => {
  const day = local(2026, 10, 12).toISOString();
  const grouped = groupByDay([task("b", day, "Zebra"), task("a", day, "Apple")]);
  assert.deepEqual(grouped.get("2026-10-12")!.map((t) => t.title), ["Apple", "Zebra"]);
});
