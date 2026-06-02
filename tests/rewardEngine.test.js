import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateCoins,
  calculateReward,
  computeNewStreak,
  shouldBreakStreak,
  calculateEfficiencyBonus,
  fatiguePointsForDifficulty,
  FATIGUE_LIMIT,
  isRecurrentTask,
  kanbanColumn,
  computePriority,
} from "../src/services/rewardEngine.js";

const BASE = { difficulty: 2, durationMin: 10, dirtLevel: 1 };

test("preventive level 0-1 gives more coins than level 5", () => {
  const low = calculateCoins({ ...BASE, dirtLevel: 1 });
  const high = calculateCoins({ ...BASE, dirtLevel: 5, durationMin: 35 });
  assert.ok(low.coins > high.coins);
});

test("level 1 yields ~12 coins illustrative", () => {
  const r = calculateCoins(BASE);
  assert.ok(r.coins >= 12 && r.coins <= 13);
});

test("level 5 yields fewer coins than level 1", () => {
  const r5 = calculateCoins({ difficulty: 2, durationMin: 35, dirtLevel: 5 });
  assert.ok(r5.coins <= 7);
});

test("streak increments in ideal window for recurrent task", () => {
  const r = computeNewStreak({
    isRecurrent: true,
    currentStreak: 2,
    dirtLevel: 1,
    daysSinceCompletion: 1,
    frequencyIdealDays: 2,
    frequencyCriticalDays: 3,
  });
  assert.equal(r.newStreak, 3);
  assert.equal(r.streakBonus, 5);
  assert.equal(r.streakBroken, false);
});

test("streak breaks when dirt > 3", () => {
  const r = computeNewStreak({
    isRecurrent: true,
    currentStreak: 5,
    dirtLevel: 4,
    daysSinceCompletion: 1,
    frequencyIdealDays: 2,
    frequencyCriticalDays: 3,
  });
  assert.equal(r.newStreak, 0);
  assert.equal(r.streakBroken, true);
  assert.equal(r.streakBonus, 0);
});

test("streak breaks when critical frequency exceeded", () => {
  assert.ok(
    shouldBreakStreak({
      dirtLevel: 2,
      daysSinceCompletion: 10,
      frequencyIdealDays: 2,
      frequencyCriticalDays: 3,
    })
  );
});

test("streak milestone 7 gives +15 bonus", () => {
  const r = computeNewStreak({
    isRecurrent: true,
    currentStreak: 6,
    dirtLevel: 1,
    daysSinceCompletion: null,
    frequencyIdealDays: 2,
    frequencyCriticalDays: 3,
  });
  assert.equal(r.newStreak, 7);
  assert.equal(r.streakBonus, 15);
});

test("non-recurrent tasks have no streak", () => {
  assert.equal(isRecurrentTask("eventual"), false);
  const r = computeNewStreak({
    isRecurrent: false,
    currentStreak: 5,
    dirtLevel: 1,
    daysSinceCompletion: 0,
    frequencyIdealDays: 2,
    frequencyCriticalDays: 3,
  });
  assert.equal(r.newStreak, 0);
});

test("efficiency +20% when duration <= 85% expected", () => {
  const b = calculateEfficiencyBonus(10, 20, 15);
  assert.equal(b.percent, 20);
  assert.equal(b.bonus, 2);
});

test("efficiency +10% when duration <= 100% expected", () => {
  const b = calculateEfficiencyBonus(10, 20, 20);
  assert.equal(b.percent, 10);
  assert.equal(b.bonus, 1);
});

test("efficiency no bonus when very slow", () => {
  const b = calculateEfficiencyBonus(10, 20, 35);
  assert.equal(b.percent, 0);
  assert.equal(b.bonus, 0);
});

test("fatigue > limit applies -20% penalty", () => {
  const r = calculateReward({
    ...BASE,
    taskType: "recurrent_light",
    fatiguePointsBefore: FATIGUE_LIMIT,
    fatiguePointsAdded: fatiguePointsForDifficulty(2),
  });
  assert.ok(r.fatiguePenaltyApplied);
  assert.ok(r.fatigueWarning);
  const without = calculateReward({
    ...BASE,
    taskType: "recurrent_light",
    fatiguePointsBefore: 0,
    fatiguePointsAdded: 0,
  });
  assert.ok(r.coins < without.coins);
});

test("XP uses preventive tier x2 for dirt 0-1", () => {
  const r = calculateReward({ ...BASE, dirtLevel: 0, taskType: "eventual" });
  assert.equal(r.breakdown.xpTier, 2);
  assert.ok(r.xp >= r.coins);
});

test("XP uses x0.5 tier for critical dirt", () => {
  const r = calculateReward({
    difficulty: 2,
    durationMin: 35,
    dirtLevel: 5,
    taskType: "eventual",
  });
  assert.equal(r.breakdown.xpTier, 0.5);
  assert.ok(r.xp <= r.coins);
});

test("completion without duration_actual skips efficiency bonus", () => {
  const r = calculateReward({
    ...BASE,
    durationActualMin: null,
    taskType: "recurrent_light",
  });
  assert.equal(r.breakdown.efficiencyBonus, 0);
});

test("calculateReward includes streak bonus in coins", () => {
  const r = calculateReward({
    ...BASE,
    currentStreak: 2,
    taskType: "recurrent_light",
    daysSinceCompletion: 1,
    frequencyIdealDays: 2,
    frequencyCriticalDays: 3,
  });
  assert.equal(r.breakdown.streakBonus, 5);
  assert.ok(r.coins > calculateCoins(BASE).coins);
});

test("kanbanColumn hides task completed within ideal window", () => {
  const task = {
    last_completed_at: new Date(),
    frequency_ideal_days: 2,
    frequency_tolerance_days: 1,
    frequency_critical_days: 3,
  };
  const zone = { dirt_level: 1 };
  assert.equal(kanbanColumn(task, zone), "recent");
});

test("kanbanColumn shows recommended when within tolerance after ideal", () => {
  const task = {
    last_completed_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    frequency_ideal_days: 2,
    frequency_tolerance_days: 1,
    frequency_critical_days: 3,
  };
  const zone = { dirt_level: 1 };
  assert.equal(kanbanColumn(task, zone), "recommended");
});

test("kanbanColumn shows today when past tolerance", () => {
  const task = {
    last_completed_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
    frequency_ideal_days: 2,
    frequency_tolerance_days: 1,
    frequency_critical_days: 3,
  };
  const zone = { dirt_level: 1 };
  assert.equal(kanbanColumn(task, zone), "today");
});

test("kanbanColumn shows never-completed task in recommended when dirt is moderate", () => {
  const task = {
    last_completed_at: null,
    frequency_ideal_days: 2,
    frequency_tolerance_days: 1,
    frequency_critical_days: 3,
  };
  const zone = { dirt_level: 2 };
  assert.equal(kanbanColumn(task, zone), "recommended");
});

test("kanbanColumn recommended vs next in ideal window", () => {
  const base = {
    last_completed_at: new Date(Date.now() - 2.5 * 24 * 60 * 60 * 1000),
    frequency_ideal_days: 2,
    frequency_tolerance_days: 1,
    frequency_critical_days: 3,
  };
  assert.equal(kanbanColumn(base, { dirt_level: 2 }), "recommended");
  assert.equal(
    kanbanColumn(
      {
        ...base,
        last_completed_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        frequency_tolerance_days: 1,
      },
      { dirt_level: 1 }
    ),
    "next"
  );
});

test("computePriority ranks very late task higher than on-time task", () => {
  const late = {
    last_completed_at: new Date(Date.now() - 20 * 86400000),
    frequency_ideal_days: 5,
    frequency_tolerance_days: 2,
    frequency_critical_days: 7,
    created_at: new Date(Date.now() - 100 * 86400000),
    is_micro: false,
    task_type: "recurrent_light",
  };
  const fresh = {
    last_completed_at: new Date(Date.now() - 1 * 86400000),
    frequency_ideal_days: 5,
    frequency_tolerance_days: 2,
    frequency_critical_days: 7,
    created_at: new Date(Date.now() - 100 * 86400000),
    is_micro: false,
    task_type: "recurrent_light",
  };
  assert.ok(computePriority(late) > computePriority(fresh));
});

test("computePriority boosts micro tasks in recovery mode", () => {
  const task = {
    last_completed_at: null,
    frequency_ideal_days: 2,
    frequency_tolerance_days: 1,
    frequency_critical_days: 3,
    is_micro: true,
    task_type: "micro",
  };
  const zone = { dirt_level: 2 };
  const normal = computePriority(task, zone, { recoveryMode: false });
  const recovery = computePriority(task, zone, { recoveryMode: true });
  assert.equal(recovery - normal, 25);
});
