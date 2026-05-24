import { test } from "node:test";
import assert from "node:assert/strict";
import {
  computeCoopBonus,
  COOP_BONUS_RATE,
} from "../src/services/cooperation.service.js";
import { detectImbalance } from "../src/services/balanceMetrics.service.js";
import { getEventCoinMultiplier, SPEEDRUN_MULTIPLIER } from "../src/services/event.service.js";
import { calculateReward } from "../src/services/rewardEngine.js";

test("computeCoopBonus is 15% of base coins", () => {
  assert.equal(computeCoopBonus(100), 15);
  assert.equal(COOP_BONUS_RATE, 0.15);
});

test("detectImbalance flags when one member has >= 70%", () => {
  const a = detectImbalance({ 1: 75, 2: 25 });
  assert.equal(a.imbalanced, true);
  const b = detectImbalance({ 1: 55, 2: 45 });
  assert.equal(b.imbalanced, false);
});

test("getEventCoinMultiplier speedrun for short tasks", () => {
  const r = getEventCoinMultiplier({ event_type: "speedrun" }, 10);
  assert.equal(r.multiplier, SPEEDRUN_MULTIPLIER);
  const long = getEventCoinMultiplier({ event_type: "speedrun" }, 20);
  assert.equal(long.multiplier, 1);
});

test("calculateReward applies event multiplier", () => {
  const base = calculateReward({
    difficulty: 2,
    durationMin: 10,
    dirtLevel: 1,
    eventMultiplier: 1,
  });
  const boosted = calculateReward({
    difficulty: 2,
    durationMin: 10,
    dirtLevel: 1,
    eventMultiplier: 1.5,
  });
  assert.ok(boosted.coins > base.coins);
});
