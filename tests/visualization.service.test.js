import { test } from "node:test";
import assert from "node:assert/strict";
import {
  computeChaosRisk,
  assignDefaultGridPositions,
} from "../src/services/visualization.service.js";

test("computeChaosRisk rises with dirty zones", () => {
  const clean = computeChaosRisk(
    [{ id: 1, dirt_level: 0 }, { id: 2, dirt_level: 1 }],
    []
  );
  const dirty = computeChaosRisk(
    [{ id: 1, dirt_level: 5 }, { id: 2, dirt_level: 5 }],
    []
  );
  assert.ok(dirty > clean);
  assert.ok(dirty >= 30);
});

test("computeChaosRisk capped at 100", () => {
  const zones = Array.from({ length: 10 }, (_, i) => ({ id: i + 1, dirt_level: 5 }));
  const tasks = Array.from({ length: 20 }, (_, i) => ({
    id: i + 1,
    zone_id: 1,
    last_completed_at: null,
    frequency_ideal_days: 1,
    frequency_tolerance_days: 0,
    frequency_critical_days: 0,
    task_type: "recurrent_light",
  }));
  assert.equal(computeChaosRisk(zones, tasks), 100);
});

test("assignDefaultGridPositions uses saved coords when set", () => {
  const zones = [
    { grid_col: 2, grid_row: 1 },
    { grid_col: 0, grid_row: 0 },
  ];
  const pos = assignDefaultGridPositions(zones);
  assert.deepEqual(pos[0], { col: 2, row: 1 });
  assert.equal(pos[1].col, 2);
});
