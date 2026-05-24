import { test } from "node:test";
import assert from "node:assert/strict";
import {
  computeLivingBase,
  buildRecoveryPlan,
  getCurrentSeason,
} from "../src/services/meta.service.js";
import { calculateReward } from "../src/services/rewardEngine.js";
import { BOSS_REWARD_COINS } from "../src/constants/meta.js";

test("computeLivingBase radiant when all zones clean", () => {
  const zones = [{ dirt_level: 0 }, { dirt_level: 1 }];
  const base = computeLivingBase(zones, 10);
  assert.equal(base.state, "radiant");
  assert.equal(base.buffPercent, 10);
});

test("computeLivingBase recovery when zone collapsed", () => {
  const zones = [{ dirt_level: 5 }, { dirt_level: 2 }];
  const base = computeLivingBase(zones, 80);
  assert.equal(base.state, "recovery");
  assert.ok(base.alert);
});

test("buildRecoveryPlan suggests ~15 min per day max", () => {
  const plan = buildRecoveryPlan(75, [{ dirt_level: 5 }]);
  assert.ok(plan.days >= 3 && plan.days <= 7);
  assert.equal(plan.minutesPerDay, 15);
});

test("getCurrentSeason returns theme without resetting progress", () => {
  const s = getCurrentSeason(new Date("2026-02-15"));
  assert.ok(s.key);
  assert.ok(s.name);
  assert.ok(s.weekInSeason >= 1);
});

test("preventive micro beats boss one-shot rentability per minute", () => {
  const preventive = calculateReward({
    difficulty: 1,
    durationMin: 5,
    dirtLevel: 1,
    taskType: "micro",
  });
  const bossAtCollapse = calculateReward({
    difficulty: 4,
    durationMin: 45,
    dirtLevel: 5,
    taskType: "deep",
  });
  const preventivePerMin = preventive.coins / 5;
  const bossPerMin = (bossAtCollapse.coins + BOSS_REWARD_COINS) / 45;
  assert.ok(preventivePerMin > bossPerMin);
});
