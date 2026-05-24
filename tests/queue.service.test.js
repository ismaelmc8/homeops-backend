import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isRecoveryMode,
  isMicroTask,
  passesRecoveryFilter,
  aggregateByZone,
  buildSessionSuggestion,
  buildKanbanColumns,
  RECOVERY_INACTIVE_DAYS,
  COLUMN_LIMIT,
} from "../src/services/queue.service.js";

const task = (overrides) => ({
  id: 1,
  name: "Limpiar",
  zoneId: 10,
  zoneName: "Baño",
  durationMin: 5,
  priority: 50,
  column: "today",
  isMicro: false,
  taskType: "recurrent_light",
  ...overrides,
});

test("isRecoveryMode after inactive period", () => {
  const old = new Date(Date.now() - (RECOVERY_INACTIVE_DAYS + 1) * 86400000);
  assert.equal(isRecoveryMode(old), true);
  assert.equal(isRecoveryMode(new Date()), false);
  assert.equal(isRecoveryMode(null), false);
});

test("isMicroTask detects micro type and flag", () => {
  assert.equal(isMicroTask({ isMicro: true }), true);
  assert.equal(isMicroTask({ taskType: "micro" }), true);
  assert.equal(isMicroTask({ task_type: "micro" }), true);
  assert.equal(isMicroTask({ taskType: "recurrent_light" }), false);
});

test("passesRecoveryFilter allows critical and micro only", () => {
  assert.equal(passesRecoveryFilter(task({ column: "critical" }), "critical"), true);
  assert.equal(passesRecoveryFilter(task({ isMicro: true }), "today"), true);
  assert.equal(passesRecoveryFilter(task(), "today"), false);
});

test("aggregateByZone groups tasks", () => {
  const items = [
    task({ id: 1, zoneId: 1, zoneName: "Baño" }),
    task({ id: 2, zoneId: 1, zoneName: "Baño" }),
    task({ id: 3, zoneId: 2, zoneName: "Cocina" }),
  ];
  const agg = aggregateByZone(items);
  assert.equal(agg.length, 2);
  assert.equal(agg[0].zoneName, "Baño");
  assert.equal(agg[0].count, 2);
});

test("buildSessionSuggestion picks tasks up to ~15 min", () => {
  const pending = [
    task({ id: 1, priority: 90, durationMin: 10, zoneName: "Baño" }),
    task({ id: 2, priority: 80, durationMin: 8, zoneName: "Cocina" }),
    task({ id: 3, priority: 70, durationMin: 20, zoneName: "Salón" }),
  ];
  const s = buildSessionSuggestion(pending);
  assert.ok(s);
  assert.ok(s.totalMin >= 10);
  assert.ok(s.label.includes("Baño"));
});

test("buildKanbanColumns applies recovery and micro filters", () => {
  const enriched = [
    task({ id: 1, column: "critical", priority: 100 }),
    task({ id: 2, column: "today", priority: 80, isMicro: true, taskType: "micro" }),
    task({ id: 3, column: "today", priority: 70 }),
    task({ id: 4, column: "recommended", priority: 60 }),
    task({ id: 5, column: "recent", priority: 0 }),
  ];

  const recovery = buildKanbanColumns(enriched, { recoveryMode: true });
  assert.equal(recovery.columns.critical.length, 1);
  assert.equal(recovery.columns.today.length, 1);
  assert.equal(recovery.columns.recommended.length, 0);

  const micro = buildKanbanColumns(enriched, { microOnly: true });
  assert.equal(micro.columns.critical.length, 0);
  assert.equal(micro.columns.today.length, 1);
});

test("buildKanbanColumns limits items per column", () => {
  const enriched = Array.from({ length: COLUMN_LIMIT + 3 }, (_, i) =>
    task({ id: i + 1, column: "next", priority: i })
  );
  const result = buildKanbanColumns(enriched);
  assert.equal(result.columns.next.length, COLUMN_LIMIT);
  assert.equal(result.columns.nextMore, 3);
});
