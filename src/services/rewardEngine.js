/**
 * Motor de monedas MVP — bonus preventivo (E1).
 * @param {{ difficulty: number, durationMin: number, dirtLevel: number }} params
 * @returns {{ base: number, preventiveMultiplier: number, coins: number, breakdown: object }}
 */
export function calculateCoins({ difficulty, durationMin, dirtLevel }) {
  const base = difficulty * 2 + durationMin / 10;
  let preventiveMultiplier = 1;
  let accumulationPenalty = 0;

  if (dirtLevel <= 1) preventiveMultiplier = 2.5; // +150%
  else if (dirtLevel === 2) preventiveMultiplier = 1.75; // +75%
  else if (dirtLevel === 3) preventiveMultiplier = 1.25; // +25%
  else if (dirtLevel === 4) preventiveMultiplier = 1;
  else {
    preventiveMultiplier = 1;
    accumulationPenalty = 0.5; // -50% on base
  }

  const afterPreventive = base * preventiveMultiplier;
  const coins = Math.max(1, Math.round(afterPreventive * (1 - accumulationPenalty)));

  return {
    base: Math.round(base * 100) / 100,
    preventiveMultiplier,
    accumulationPenalty,
    coins,
    breakdown: {
      base,
      preventiveMultiplier,
      accumulationPenalty,
      formula: "Base = dificultad×2 + duración/10; bonus preventivo por nivel suciedad",
    },
  };
}

export function dirtReductionForTaskType(taskType) {
  const map = {
    micro: 1,
    recurrent_light: 1,
    recurrent_heavy: 2,
    deep: 4,
    eventual: 2,
  };
  return map[taskType] ?? 2;
}

export function computePriority(task, zone) {
  const dirt = zone?.dirt_level ?? 0;
  const risk = dirt >= 4 ? 100 : dirt >= 3 ? 60 : dirt * 10;
  const impact = dirt * 8;
  let timeScore = 0;
  if (task.last_completed_at) {
    const daysSince =
      (Date.now() - new Date(task.last_completed_at).getTime()) / (1000 * 60 * 60 * 24);
    const overdue = daysSince - task.frequency_ideal_days;
    if (overdue > task.frequency_critical_days) timeScore = 80;
    else if (overdue > task.frequency_tolerance_days) timeScore = 40;
    else if (overdue > 0) timeScore = 20;
  } else {
    timeScore = 30;
  }
  return risk + impact + timeScore;
}

export function kanbanColumn(task, zone) {
  const dirt = zone?.dirt_level ?? 0;
  const daysSince = task.last_completed_at
    ? (Date.now() - new Date(task.last_completed_at).getTime()) / (1000 * 60 * 60 * 24)
    : Infinity;
  const overdueCritical = daysSince > task.frequency_ideal_days + task.frequency_critical_days;
  const overdueTolerance = daysSince > task.frequency_ideal_days + task.frequency_tolerance_days;

  if (dirt >= 4 || overdueCritical) return "critical";
  if (daysSince <= task.frequency_ideal_days + 0.5) return "today";
  if (!overdueTolerance && daysSince <= task.frequency_ideal_days + task.frequency_tolerance_days)
    return "today";
  return "next";
}

export const DIRT_LABELS = [
  "Óptimo",
  "Estable",
  "Acumulación",
  "Sucio",
  "Crítico",
  "Colapso",
];
