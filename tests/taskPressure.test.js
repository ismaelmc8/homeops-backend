import test from "node:test";
import assert from "node:assert/strict";
import {
  taskPressure,
  taskScheduleStatus,
  leadersByZone,
  dirtLabelForPressure,
} from "../src/utils/taskPressure.js";
import { kanbanColumn, computePriority } from "../src/services/rewardEngine.js";

const day = 86400000;
const now = Date.now();

test("taskPressure: dentro de ideal es baja", () => {
  const task = {
    last_completed_at: new Date(now - 1 * day),
    frequency_ideal_days: 7,
    frequency_tolerance_days: 2,
    frequency_critical_days: 7,
    created_at: new Date(now - 30 * day),
  };
  assert.ok(taskPressure(task, now) <= 1);
  assert.equal(taskScheduleStatus(task, now), "ok");
});

test("taskPressure: suelo semanal atrasado sube más que campana mensual reciente", () => {
  const floor = {
    name: "Aspirar",
    last_completed_at: new Date(now - 14 * day),
    frequency_ideal_days: 5,
    frequency_tolerance_days: 2,
    frequency_critical_days: 7,
    created_at: new Date(now - 60 * day),
  };
  const hood = {
    name: "Campana",
    last_completed_at: new Date(now - 10 * day),
    frequency_ideal_days: 30,
    frequency_tolerance_days: 7,
    frequency_critical_days: 60,
    created_at: new Date(now - 60 * day),
  };
  assert.ok(taskPressure(floor, now) > taskPressure(hood, now));
});

test("taskPressure: nunca hecha empieza en 2 no en 5", () => {
  const task = {
    last_completed_at: null,
    frequency_ideal_days: 30,
    frequency_tolerance_days: 7,
    frequency_critical_days: 60,
    created_at: new Date(now - 2 * day),
  };
  assert.equal(taskPressure(task, now), 2);
});

test("leadersByZone: zona = MAX de tareas", () => {
  const tasks = [
    {
      id: 1,
      zone_id: 10,
      name: "Aspirar",
      active: 1,
      last_completed_at: new Date(now - 14 * day),
      frequency_ideal_days: 5,
      frequency_tolerance_days: 2,
      frequency_critical_days: 7,
      created_at: new Date(now - 100 * day),
    },
    {
      id: 2,
      zone_id: 10,
      name: "Campana",
      active: 1,
      last_completed_at: new Date(now - 5 * day),
      frequency_ideal_days: 30,
      frequency_tolerance_days: 7,
      frequency_critical_days: 60,
      created_at: new Date(now - 100 * day),
    },
  ];
  const map = leadersByZone(tasks, now);
  const lead = map.get(10);
  assert.equal(lead.taskName, "Aspirar");
  assert.ok(lead.pressure >= 3);
});

test("kanbanColumn: nunca hecha con presión 2 va a recomendado", () => {
  const task = {
    last_completed_at: null,
    frequency_ideal_days: 2,
    frequency_tolerance_days: 1,
    frequency_critical_days: 3,
    created_at: new Date(now - 2 * day),
  };
  assert.equal(kanbanColumn(task), "recommended");
});

test("kanbanColumn: ignora zona sucia si la tarea está al día", () => {
  const task = {
    last_completed_at: new Date(now - 1 * day),
    frequency_ideal_days: 7,
    frequency_tolerance_days: 2,
    frequency_critical_days: 7,
    created_at: new Date(now - 30 * day),
  };
  assert.equal(kanbanColumn(task, { dirt_level: 5 }), "recent");
});

test("computePriority: tarea muy atrasada prioriza sobre tarea al día", () => {
  const late = {
    last_completed_at: new Date(now - 20 * day),
    frequency_ideal_days: 5,
    frequency_tolerance_days: 2,
    frequency_critical_days: 7,
    created_at: new Date(now - 100 * day),
    is_micro: false,
    task_type: "recurrent_light",
  };
  const fresh = {
    last_completed_at: new Date(now - 1 * day),
    frequency_ideal_days: 5,
    frequency_tolerance_days: 2,
    frequency_critical_days: 7,
    created_at: new Date(now - 100 * day),
    is_micro: false,
    task_type: "recurrent_light",
  };
  assert.ok(computePriority(late) > computePriority(fresh));
});

test("dirtLabelForPressure", () => {
  assert.equal(dirtLabelForPressure(0), "Óptimo");
  assert.equal(dirtLabelForPressure(5), "Colapso");
});
