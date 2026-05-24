import { test } from "node:test";
import assert from "node:assert/strict";
import { computeMetricsFromCompletions } from "../src/services/metrics.service.js";

test("computeMetricsFromCompletions preventive percent from completions", () => {
  const completions = [
    { zone_dirt_at_completion: 0, duration_actual: 10, user_id: 1 },
    { zone_dirt_at_completion: 1, duration_actual: 8, user_id: 1 },
    { zone_dirt_at_completion: 3, duration_actual: 12, user_id: 2 },
  ];
  const zones = [
    { dirt_level: 0 },
    { dirt_level: 1 },
    { dirt_level: 4 },
  ];

  const m = computeMetricsFromCompletions(completions, zones);
  assert.equal(m.preventivePercent, 67);
  assert.equal(m.avgDurationMin, 10);
  assert.equal(m.stabilityPercent, 67);
  assert.equal(m.completionsInPeriod, 3);
  assert.equal(m.contributorCount, 2);
});

test("computeMetricsFromCompletions empty period defaults", () => {
  const m = computeMetricsFromCompletions([], [{ dirt_level: 1 }]);
  assert.equal(m.preventivePercent, 100);
  assert.equal(m.avgDurationMin, null);
  assert.equal(m.stabilityPercent, 100);
});
