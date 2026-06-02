/**
 * E11 — Presión de suciedad por tarea (0–5). La zona resume MAX(tareas activas).
 */

export const DIRT_LABELS = [
  "Óptimo",
  "Estable",
  "Acumulación",
  "Sucio",
  "Crítico",
  "Colapso",
];

const MS_PER_DAY = 86400000;

export function daysSinceCompletion(lastCompletedAt, now = Date.now()) {
  if (!lastCompletedAt) return null;
  return (now - new Date(lastCompletedAt).getTime()) / MS_PER_DAY;
}

function daysSinceCreated(task, now = Date.now()) {
  const ref = task.created_at ?? task.createdAt;
  if (!ref) return 0;
  return (now - new Date(ref).getTime()) / MS_PER_DAY;
}

function freq(task, key, fallback) {
  const v = task[key] ?? task[key.replace(/_([a-z])/g, (_, c) => c.toUpperCase())];
  return Number(v) || fallback;
}

/**
 * ok | tolerance | late | critical (misma semántica que Kanban E3)
 */
export function taskScheduleStatus(task, now = Date.now()) {
  const ideal = freq(task, "frequency_ideal_days", 1);
  const tolerance = freq(task, "frequency_tolerance_days", 0);
  const critical = freq(task, "frequency_critical_days", 0);

  const lastAt = task.last_completed_at ?? task.lastCompletedAt;
  let daysSince = daysSinceCompletion(lastAt, now);

  if (daysSince === null) {
    daysSince = daysSinceCreated(task, now);
  }

  const overdue = daysSince - ideal;

  if (overdue <= 0) return "ok";
  if (overdue <= tolerance) return "tolerance";
  if (overdue <= critical) return "late";
  return "critical";
}

/**
 * Presión 0–5 de una tarea según calendario (ideal / tolerancia / crítico).
 * Nunca hecha: mínimo 2 (acumulación), no colapso inmediato.
 */
export function taskPressure(task, now = Date.now()) {
  const ideal = freq(task, "frequency_ideal_days", 1);
  const tolerance = freq(task, "frequency_tolerance_days", 0);
  const critical = freq(task, "frequency_critical_days", 0);

  const lastAt = task.last_completed_at ?? task.lastCompletedAt;
  const daysSinceDone = daysSinceCompletion(lastAt, now);

  if (daysSinceDone === null) {
    const age = daysSinceCreated(task, now);
    const overdue = age - ideal;
    if (overdue <= 0) return 2;
    if (overdue <= tolerance) return 2;
    if (overdue <= critical) return 3;
    return 5;
  }

  const overdue = daysSinceDone - ideal;

  if (overdue <= 0) {
    return daysSinceDone < ideal * 0.5 ? 0 : 1;
  }
  if (overdue <= tolerance) return 2;
  if (overdue <= critical) {
    const span = Math.max(1, critical - tolerance);
    const step = (overdue - tolerance) / span;
    return Math.min(4, 3 + Math.floor(step));
  }
  return 5;
}

export function dirtLabelForPressure(pressure) {
  const p = Math.max(0, Math.min(5, Math.round(pressure)));
  return DIRT_LABELS[p] ?? DIRT_LABELS[1];
}

/** Agrupa tareas activas por zona y devuelve líder (MAX presión) por zone_id. */
export function leadersByZone(tasks, now = Date.now()) {
  const map = new Map();
  for (const t of tasks) {
    if (t.active === 0 || t.active === false) continue;
    const zoneId = t.zone_id ?? t.zoneId;
    const pressure = taskPressure(t, now);
    const name = t.name;
    const cur = map.get(zoneId);
    if (!cur || pressure > cur.pressure) {
      map.set(zoneId, { zoneId, taskName: name, taskId: t.id, pressure });
    }
  }
  return map;
}
