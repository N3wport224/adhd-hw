import assert from "node:assert/strict";
import { test } from "node:test";
import { REMIND_AFTER_DAYS, backupIsOverdue, daysSince, describeLastBackup } from "@/lib/backupReminder";

const DAY = 86_400_000;
const now = Date.UTC(2026, 8, 20, 12);

test("counts whole days since the last backup", () => {
  assert.equal(daysSince(now - 3 * DAY, now), 3);
  assert.equal(daysSince(now, now), 0);
  assert.equal(daysSince(null, now), null);
});

test("says nothing when there is nothing to lose", () => {
  // A reminder to back up an empty app is pure noise.
  assert.equal(backupIsOverdue(null, false, now), false);
  assert.equal(backupIsOverdue(now - 40 * DAY, false, now), false);
});

test("speaks up once a backup is old, or was never made", () => {
  assert.equal(backupIsOverdue(null, true, now), true);
  assert.equal(backupIsOverdue(now - REMIND_AFTER_DAYS * DAY, true, now), true);
  assert.equal(backupIsOverdue(now - (REMIND_AFTER_DAYS - 1) * DAY, true, now), false);
  assert.equal(backupIsOverdue(now - DAY, true, now), false);
});

test("describes the age in plain words", () => {
  assert.equal(describeLastBackup(null, now), "Never backed up on this device");
  assert.equal(describeLastBackup(now, now), "Backed up today");
  assert.equal(describeLastBackup(now - DAY, now), "Backed up yesterday");
  assert.equal(describeLastBackup(now - 9 * DAY, now), "Backed up 9 days ago");
});
