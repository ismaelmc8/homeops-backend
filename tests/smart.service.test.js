import { test } from "node:test";
import assert from "node:assert/strict";
import {
  predictZoneDirtLevel,
  computeOptimalHours,
  isOptimalWindowNow,
  detectBurnout,
  applySmartPriorityBoost,
  pickNextBestTask,
  suggestAssignee,
} from "../src/services/smart.service.js";
import { buildKanbanColumns } from "../src/services/queue.service.js";
import { BURNOUT_COLUMN_LIMIT } from "../src/constants/smart.js";

test("predictZoneDirtLevel degrades with insufficient data", () => {
  const zone = { id: 1, name: "Baño", dirt_level: 2, daily_increment: 1 };
  const pred = predictZoneDirtLevel(zone, { completions: 1 }, 2);
  assert.equal(pred.insufficientData, true);
  assert.equal(pred.confidence, "low");
  assert.ok(pred.reason.includes("Pocos datos"));
});

test("predictZoneDirtLevel uses history when enough completions", () => {
  const zone = { id: 1, name: "Baño", dirt_level: 2, daily_increment: 1 };
  const pred = predictZoneDirtLevel(zone, { completions: 10 }, 2);
  assert.equal(pred.insufficientData, false);
  assert.ok(pred.projectedLevel >= 0);
  assert.ok(pred.reason.includes("10 limpiezas"));
});

test("computeOptimalHours picks top hours", () => {
  const result = computeOptimalHours([
    { hour: 10, c: 5 },
    { hour: 18, c: 8 },
    { hour: 9, c: 3 },
  ]);
  assert.deepEqual(result.hours, [18, 10, 9]);
  assert.ok(result.label.includes("18:00"));
});

test("isOptimalWindowNow matches current hour", () => {
  const h = new Date().getHours();
  assert.equal(isOptimalWindowNow({ hours: [h] }), true);
  assert.equal(isOptimalWindowNow({ hours: [(h + 1) % 24] }), false);
});

test("detectBurnout triggers on high fatigue", () => {
  const r = detectBurnout({
    fatiguePoints: 7,
    fatigueLimit: 8,
    recentCompletions: [],
  });
  assert.equal(r.active, true);
  assert.ok(r.suggestion);
});

test("applySmartPriorityBoost adds reasons in optimal window", () => {
  const task = { scheduleStatus: "ok", isMicro: true };
  const zone = { id: 1, name: "Cocina", dirt_level: 1 };
  const ctx = {
    autoPriorityEnabled: true,
    optimalHoursEnabled: true,
    inOptimalWindow: true,
    predictionsByZone: {},
  };
  const { priority, smartReasons } = applySmartPriorityBoost(50, task, zone, ctx);
  assert.ok(priority > 50);
  assert.ok(smartReasons.some((r) => r.includes("horario")));
});

test("pickNextBestTask returns top priority with reasons", () => {
  const next = pickNextBestTask([
    { id: 1, name: "A", zoneName: "Baño", durationMin: 5, priority: 60, smartReasons: ["Riesgo"] },
    { id: 2, name: "B", zoneName: "Cocina", durationMin: 10, priority: 40 },
  ]);
  assert.equal(next.taskId, 1);
  assert.deepEqual(next.reasons, ["Riesgo"]);
});

test("suggestAssignee picks member with fewer completions", () => {
  const s = suggestAssignee(
    [
      { user_id: 1, name: "Ana", c: 2 },
      { user_id: 2, name: "Luis", c: 5 },
    ],
    { id: 10, name: "Fregar" }
  );
  assert.equal(s.userId, 1);
  assert.ok(s.reason.includes("Ana"));
});

test("buildKanbanColumns respects custom column limit (burnout)", () => {
  const enriched = Array.from({ length: 6 }, (_, i) => ({
    id: i + 1,
    name: `T${i}`,
    zoneId: 1,
    zoneName: "Baño",
    durationMin: 5,
    priority: i,
    column: "next",
    isMicro: true,
    taskType: "micro",
  }));
  const result = buildKanbanColumns(enriched, { columnLimit: BURNOUT_COLUMN_LIMIT });
  assert.equal(result.columns.next.length, BURNOUT_COLUMN_LIMIT);
  assert.equal(result.columns.nextMore, 6 - BURNOUT_COLUMN_LIMIT);
});
