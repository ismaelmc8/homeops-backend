/**
 * E3 — Cola inteligente: agregación, sesión ~15 min, modo recuperación.
 *
 * Reglas de columna Kanban (ver también rewardEngine.kanbanColumn):
 * - recent:     recién completada (< frecuencia ideal) — oculta
 * - critical:   suciedad ≥4 o plazo crítico superado
 * - today:      nunca hecha (suciedad≥3) o atrasada (> tolerancia)
 * - recommended: ventana ideal/tolerancia (preventivo)
 * - next:       pendiente de baja urgencia (ideal alcanzado, zona limpia)
 */

export const RECOVERY_INACTIVE_DAYS = 3;
export const SESSION_TARGET_MIN = 15;
export const COLUMN_LIMIT = 5;

export function isRecoveryMode(lastActiveAt) {
  if (!lastActiveAt) return false;
  const days =
    (Date.now() - new Date(lastActiveAt).getTime()) / (1000 * 60 * 60 * 24);
  return days >= RECOVERY_INACTIVE_DAYS;
}

export function isMicroTask(task) {
  return !!task.isMicro || task.taskType === "micro" || task.task_type === "micro";
}

/** En modo recuperación solo micro + crítico visibles (no borra rachas). */
export function passesRecoveryFilter(task, column) {
  if (column === "critical") return true;
  return isMicroTask(task);
}

export function aggregateByZone(tasks) {
  const map = new Map();
  for (const t of tasks) {
    const key = t.zoneId ?? t.zone_id;
    if (!map.has(key)) {
      map.set(key, {
        zoneId: key,
        zoneName: t.zoneName ?? t.zone_name,
        count: 0,
        taskIds: [],
      });
    }
    const g = map.get(key);
    g.count += 1;
    g.taskIds.push(t.id);
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}

/**
 * Sugerencia fija ~15 min: prioridad alta, sin IA.
 * Tareas de columnas crítico → hoy → recomendado.
 */
export function buildSessionSuggestion(pendingTasks, targetMin = SESSION_TARGET_MIN) {
  const pool = [...pendingTasks].sort((a, b) => b.priority - a.priority);
  const picked = [];
  let totalMin = 0;

  for (const t of pool) {
    const dur = Number(t.durationMin ?? t.duration_min) || 5;
    if (picked.length > 0 && totalMin + dur > targetMin + 5) continue;
    if (picked.length === 0 || totalMin + dur <= targetMin + 3) {
      picked.push({
        id: t.id,
        name: t.name,
        zoneName: t.zoneName,
        durationMin: dur,
      });
      totalMin += dur;
    }
    if (totalMin >= targetMin - 2 && picked.length >= 1) break;
  }

  if (!picked.length) return null;

  const label = picked.map((t) => t.zoneName || t.name).join(" + ");
  return {
    totalMin,
    label,
    tasks: picked,
  };
}

export function applyColumnLimits(columns) {
  const slice = (key) => {
    const all = columns[key] ?? [];
    return {
      items: all.slice(0, COLUMN_LIMIT),
      more: Math.max(0, all.length - COLUMN_LIMIT),
    };
  };

  return {
    critical: slice("critical").items,
    today: slice("today").items,
    recommended: slice("recommended").items,
    next: slice("next").items,
    todayMore: slice("today").more,
    recommendedMore: slice("recommended").more,
    nextMore: slice("next").more,
  };
}

export function buildKanbanColumns(enriched, { recoveryMode = false, microOnly = false } = {}) {
  let pending = enriched.filter((t) => t.column !== "recent");

  if (recoveryMode) {
    pending = pending.filter((t) => passesRecoveryFilter(t, t.column));
  }
  if (microOnly) {
    pending = pending.filter((t) => isMicroTask(t));
  }

  const grouped = {
    critical: pending.filter((t) => t.column === "critical"),
    today: pending.filter((t) => t.column === "today"),
    recommended: pending.filter((t) => t.column === "recommended"),
    next: pending.filter((t) => t.column === "next"),
  };

  const limited = applyColumnLimits(grouped);
  const allPending = [
    ...grouped.critical,
    ...grouped.today,
    ...grouped.recommended,
    ...grouped.next,
  ];

  return {
    columns: {
      critical: limited.critical,
      today: limited.today,
      recommended: limited.recommended,
      next: limited.next,
      todayMore: limited.todayMore,
      recommendedMore: limited.recommendedMore,
      nextMore: limited.nextMore,
    },
    zoneAggregates: {
      critical: aggregateByZone(grouped.critical),
      today: aggregateByZone(grouped.today),
      recommended: aggregateByZone(grouped.recommended),
      next: aggregateByZone(grouped.next),
    },
    sessionSuggestion: buildSessionSuggestion(allPending),
  };
}
