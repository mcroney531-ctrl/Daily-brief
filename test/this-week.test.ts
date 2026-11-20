import { test } from "node:test";
import assert from "node:assert/strict";
import { shouldSendThisWeekOnly } from "../src/thisWeek.js";

const active = { active: true, text: "list", updatedAt: "" };
const inactive = { active: false, text: "list", updatedAt: "" };

test("active override sends This Week only by default (scheduled behavior unchanged)", () => {
  assert.equal(shouldSendThisWeekOnly(active, {}), true);
});

test("DAILY_BRIEF_FORCE_FULL=true bypasses an active override", () => {
  assert.equal(shouldSendThisWeekOnly(active, { DAILY_BRIEF_FORCE_FULL: "true" }), false);
});

test("anything other than exactly 'true' does not bypass", () => {
  for (const v of ["", "1", "TRUE", "yes", "false"]) {
    assert.equal(shouldSendThisWeekOnly(active, { DAILY_BRIEF_FORCE_FULL: v }), true, v);
  }
});

test("inactive or missing override always sends the full brief", () => {
  assert.equal(shouldSendThisWeekOnly(inactive, {}), false);
  assert.equal(shouldSendThisWeekOnly(null, {}), false);
});
