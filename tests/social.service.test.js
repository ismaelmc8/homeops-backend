import { test } from "node:test";
import assert from "node:assert/strict";
import { computeCoopBonus, COOP_BONUS_RATE } from "../src/services/cooperation.service.js";
import { DAILY_PREVENTIVE_BONUS_COINS } from "../src/constants/social.js";

test("DAILY_PREVENTIVE_BONUS_COINS is fixed amount", () => {
  assert.equal(DAILY_PREVENTIVE_BONUS_COINS, 8);
});

test("coop bonus rate unchanged for E4 compatibility", () => {
  assert.equal(computeCoopBonus(100), Math.round(100 * COOP_BONUS_RATE));
});
