import assert from "node:assert/strict";
import { test } from "node:test";
import { describePlan, planStepDays } from "@/lib/stepPlanner";

// 2026-08-31 is a Monday, so weekend handling is exercised within one window.
const MONDAY = "2026-08-31";
const FRIDAY = "2026-09-04";
const NEXT_FRIDAY = "2026-09-11";

const plan = (count: number, options: Partial<Parameters<typeof planStepDays>[1]> = {}) =>
  planStepDays(count, { from: MONDAY, due: NEXT_FRIDAY, perDay: 2, ...options });

test("gives every step a day", () => {
  const { days } = plan(5);
  assert.equal(days.length, 5);
  for (const day of days) assert.match(day, /^\d{4}-\d{2}-\d{2}$/);
});

test("starts today, so there is always something to do now", () => {
  assert.equal(plan(5).days[0], MONDAY);
  assert.equal(plan(1).days[0], MONDAY);
});

test("never plans anything after the deadline", () => {
  for (const count of [1, 3, 7, 20, 50]) {
    const { days } = plan(count);
    assert.ok(days.every((day) => day <= NEXT_FRIDAY), `count ${count} overran the deadline`);
  }
});

test("keeps to the requested pace when there is room", () => {
  // Six steps at two a day is three days of work, not six days of one.
  const summary = plan(6, { perDay: 2 });
  assert.equal(summary.busiestDay, 2);
  assert.equal(summary.daysUsed, 3);
  assert.equal(summary.crowded, false);
});

test("one a day means one a day", () => {
  const summary = plan(4, { perDay: 1 });
  assert.equal(summary.busiestDay, 1);
  assert.equal(summary.daysUsed, 4);
  assert.deepEqual(summary.days, ["2026-08-31", "2026-09-01", "2026-09-02", "2026-09-03"]);
});

test("packs tighter when the deadline is closer than the pace allows", () => {
  // Ten steps, two a day, but only five days until Friday.
  const summary = planStepDays(10, { from: MONDAY, due: FRIDAY, perDay: 2 });
  assert.ok(summary.days.every((day) => day <= FRIDAY));
  assert.equal(summary.busiestDay, 2);

  // Twenty steps into the same five days has to exceed the requested pace.
  const crowded = planStepDays(20, { from: MONDAY, due: FRIDAY, perDay: 2 });
  assert.equal(crowded.crowded, true);
  assert.ok(crowded.busiestDay >= 4);
  assert.ok(crowded.days.every((day) => day <= FRIDAY));
});

test("reports the buffer left before the deadline", () => {
  const summary = plan(6, { perDay: 2 });
  // Three days of work starting Monday the 31st finishes Wednesday the 2nd,
  // nine days before the deadline on the 11th.
  assert.deepEqual(summary.days.at(-1), "2026-09-02");
  assert.equal(summary.daysSpare, 9);
});

test("plans forward when there is no deadline", () => {
  const summary = planStepDays(5, { from: MONDAY, due: null, perDay: 2 });
  assert.equal(summary.days[0], MONDAY);
  assert.equal(summary.busiestDay, 2);
  assert.equal(summary.daysSpare, null);
});

test("plans forward when the deadline has already passed", () => {
  const summary = planStepDays(3, { from: MONDAY, due: "2026-08-01", perDay: 1 });
  assert.equal(summary.days[0], MONDAY);
  assert.ok(summary.days.every((day) => day >= MONDAY));
});

test("skips weekends when asked", () => {
  const summary = planStepDays(6, { from: MONDAY, due: NEXT_FRIDAY, perDay: 1, skipWeekends: true });
  const weekdays = summary.days.map((day) => new Date(`${day}T00:00:00`).getDay());
  assert.ok(weekdays.every((weekday) => weekday !== 0 && weekday !== 6));
  assert.equal(summary.days.length, 6);
});

test("still plans when the whole window is a weekend", () => {
  // Saturday to Sunday with weekends skipped leaves nothing; plan forward.
  const summary = planStepDays(2, {
    from: "2026-09-05",
    due: "2026-09-06",
    perDay: 1,
    skipWeekends: true,
  });
  assert.equal(summary.days.length, 2);
  const weekdays = summary.days.map((day) => new Date(`${day}T00:00:00`).getDay());
  assert.ok(weekdays.every((weekday) => weekday !== 0 && weekday !== 6));
});

test("days come out in order", () => {
  const { days } = plan(9, { perDay: 2 });
  const sorted = [...days].sort();
  assert.deepEqual(days, sorted);
});

test("handles nothing to plan", () => {
  const summary = planStepDays(0, { from: MONDAY, due: NEXT_FRIDAY, perDay: 2 });
  assert.deepEqual(summary.days, []);
  assert.equal(describePlan(summary), "Nothing to plan.");
});

test("describes the plan in words", () => {
  assert.match(describePlan(plan(4, { perDay: 1 })), /^One a day over 4 days, finishing \d+ days early\.$/);
  assert.match(describePlan(plan(6, { perDay: 2 })), /^Up to 2 a day over 3 days/);
  assert.match(
    describePlan(planStepDays(5, { from: MONDAY, due: null, perDay: 2 })),
    /over 3 days\.$/,
  );
});
