import { test } from "node:test";
import assert from "node:assert/strict";
import {
  levelFromXp,
  rankForLevel,
  getRpgRewardModifiers,
} from "../src/services/rpg.service.js";
import { calculateReward } from "../src/services/rewardEngine.js";

test("levelFromXp increases with XP thresholds", () => {
  assert.equal(levelFromXp(0).level, 1);
  assert.equal(levelFromXp(120).level, 3);
  assert.ok(levelFromXp(50).progressPercent >= 0);
});

test("rankForLevel returns higher rank at higher levels", () => {
  assert.equal(rankForLevel(1).key, "apprentice");
  assert.equal(rankForLevel(10).key, "legend");
});

test("getRpgRewardModifiers boosts quality rating 4-5", () => {
  const m = getRpgRewardModifiers({
    specialization: null,
    qualityRating: 5,
    dirtLevel: 1,
    durationMin: 10,
    taskType: "micro",
    isCooperative: false,
    buffEffects: {},
  });
  assert.ok(m.qualityCoinMult > 1);
});

test("preventive specialization increases coins on clean zone", () => {
  const base = calculateReward({
    difficulty: 2,
    durationMin: 10,
    dirtLevel: 1,
    fatiguePointsBefore: 0,
    fatiguePointsAdded: 2,
  });
  const withSpec = calculateReward({
    difficulty: 2,
    durationMin: 10,
    dirtLevel: 1,
    fatiguePointsBefore: 0,
    fatiguePointsAdded: 2,
    rpgModifiers: getRpgRewardModifiers({
      specialization: "preventive",
      qualityRating: null,
      dirtLevel: 1,
      durationMin: 10,
      taskType: "recurrent_light",
      isCooperative: false,
      buffEffects: {},
    }),
  });
  assert.ok(withSpec.coins > base.coins);
});
