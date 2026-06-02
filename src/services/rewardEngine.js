import { taskPressure } from "../utils/taskPressure.js";

/**
 * Motor de recompensas HomeOps (E1 + E2)
 *
 * Orden de aplicación (monedas):
 * 1. Base = dificultad×2 + duración/10
 * 2. × Multiplicador preventivo (suciedad) + penalización acumulación (nivel 5)
 * 3. + Bonus racha (hitos 3/7/14/30 en tareas recurrentes)
 * 4. + Bonus eficiencia (+10% / +20% si hay duration_actual)
 * 5. − Penalización fatiga suave (−20% si > 10 pts/día)
 *
 * XP = monedas finales × multiplicador XP (×2 preventivo / ×1 normal / ×0.5 crítico)
 * Fatiga suave también reduce XP un −20%.
 */

export const FATIGUE_LIMIT = 10;
export const FATIGUE_SOFT_PENALTY = 0.2;
export const RECURRENT_TASK_TYPES = new Set(["recurrent_light", "recurrent_heavy", "micro"]);

export function isRecurrentTask(taskType) {
  return RECURRENT_TASK_TYPES.has(taskType);
}

export function shouldBreakStreak({
  dirtLevel,
  daysSinceCompletion,
  frequencyIdealDays,
  frequencyCriticalDays,
}) {
  if (dirtLevel > 3) return true;
  if (
    daysSinceCompletion != null &&
    daysSinceCompletion > frequencyIdealDays + frequencyCriticalDays
  ) {
    return true;
  }
  return false;
}

export function isIdealWindow(daysSinceCompletion, frequencyIdealDays) {
  return daysSinceCompletion === null || daysSinceCompletion <= frequencyIdealDays;
}

export function streakMilestoneBonus(newStreak) {
  if (newStreak === 3) return { bonus: 5, milestone: 3, achievement: false };
  if (newStreak === 7) return { bonus: 15, milestone: 7, achievement: false };
  if (newStreak === 14) return { bonus: 35, milestone: 14, achievement: false };
  if (newStreak === 30) return { bonus: 0, milestone: 30, achievement: true };
  return { bonus: 0, milestone: null, achievement: false };
}

export function computeNewStreak({
  isRecurrent,
  currentStreak,
  dirtLevel,
  daysSinceCompletion,
  frequencyIdealDays,
  frequencyCriticalDays,
}) {
  if (!isRecurrent) {
    return {
      newStreak: 0,
      streakBroken: false,
      streakBonus: 0,
      milestone: null,
      achievement: false,
    };
  }

  if (
    shouldBreakStreak({
      dirtLevel,
      daysSinceCompletion,
      frequencyIdealDays,
      frequencyCriticalDays,
    })
  ) {
    return {
      newStreak: 0,
      streakBroken: currentStreak > 0,
      streakBonus: 0,
      milestone: null,
      achievement: false,
    };
  }

  if (!isIdealWindow(daysSinceCompletion, frequencyIdealDays)) {
    return {
      newStreak: currentStreak,
      streakBroken: false,
      streakBonus: 0,
      milestone: null,
      achievement: false,
    };
  }

  const newStreak = currentStreak + 1;
  const { bonus, milestone, achievement } = streakMilestoneBonus(newStreak);
  return {
    newStreak,
    streakBroken: false,
    streakBonus: bonus,
    milestone,
    achievement,
  };
}

export function fatiguePointsForDifficulty(difficulty) {
  const map = { 1: 1, 2: 2, 3: 3, 4: 5, 5: 8 };
  const d = Math.min(5, Math.max(1, Math.round(Number(difficulty) || 2)));
  return map[d] ?? 2;
}

export function calculateEfficiencyBonus(subtotalBeforeBonus, durationMin, durationActualMin) {
  if (durationActualMin == null || durationActualMin <= 0 || !durationMin) {
    return { bonus: 0, percent: 0, ratio: null };
  }
  const ratio = durationActualMin / durationMin;
  if (ratio <= 0.85) return { bonus: Math.round(subtotalBeforeBonus * 0.2), percent: 20, ratio };
  if (ratio <= 1.0) return { bonus: Math.round(subtotalBeforeBonus * 0.1), percent: 10, ratio };
  return { bonus: 0, percent: 0, ratio };
}

export function xpTierForDirt(dirtLevel) {
  if (dirtLevel <= 1) return 2;
  if (dirtLevel <= 3) return 1;
  return 0.5;
}

/** Núcleo preventivo E1 */
export function calculatePreventive({ difficulty, durationMin, dirtLevel }) {
  const base = difficulty * 2 + durationMin / 10;
  let preventiveMultiplier = 1;
  let accumulationPenalty = 0;

  if (dirtLevel <= 1) preventiveMultiplier = 2.5;
  else if (dirtLevel === 2) preventiveMultiplier = 1.75;
  else if (dirtLevel === 3) preventiveMultiplier = 1.25;
  else if (dirtLevel === 4) preventiveMultiplier = 1;
  else {
    preventiveMultiplier = 1;
    accumulationPenalty = 0.5;
  }

  const afterPreventive = base * preventiveMultiplier * (1 - accumulationPenalty);

  return {
    base: Math.round(base * 100) / 100,
    preventiveMultiplier,
    accumulationPenalty,
    afterPreventive,
  };
}

/** E1 — compatibilidad tests y callers simples */
export function calculateCoins({ difficulty, durationMin, dirtLevel }) {
  const preventive = calculatePreventive({ difficulty, durationMin, dirtLevel });
  const coins = Math.max(1, Math.round(preventive.afterPreventive));

  return {
    base: preventive.base,
    preventiveMultiplier: preventive.preventiveMultiplier,
    accumulationPenalty: preventive.accumulationPenalty,
    coins,
    breakdown: {
      base: preventive.base,
      preventiveMultiplier: preventive.preventiveMultiplier,
      accumulationPenalty: preventive.accumulationPenalty,
      formula: "Base = dificultad×2 + duración/10; bonus preventivo por nivel suciedad",
    },
  };
}

/**
 * Motor unificado E2
 */
export function calculateReward({
  difficulty,
  durationMin,
  dirtLevel,
  durationActualMin = null,
  currentStreak = 0,
  taskType = "recurrent_light",
  daysSinceCompletion = null,
  frequencyIdealDays = 2,
  frequencyCriticalDays = 3,
  fatiguePointsBefore = 0,
  fatiguePointsAdded = 0,
  eventMultiplier = 1,
  baseBuffMultiplier = 1,
  rpgModifiers = null,
}) {
  const preventive = calculatePreventive({ difficulty, durationMin, dirtLevel });
  const afterPreventive = Math.round(preventive.afterPreventive);

  const streak = computeNewStreak({
    isRecurrent: isRecurrentTask(taskType),
    currentStreak,
    dirtLevel,
    daysSinceCompletion,
    frequencyIdealDays,
    frequencyCriticalDays,
  });

  const efficiency = calculateEfficiencyBonus(
    afterPreventive,
    durationMin,
    durationActualMin
  );

  const subtotal = afterPreventive + streak.streakBonus + efficiency.bonus;

  const fatigueAfter = fatiguePointsBefore + fatiguePointsAdded;
  const fatiguePenaltyApplied = fatigueAfter > FATIGUE_LIMIT;
  const fatigueWarning =
    fatiguePointsBefore <= FATIGUE_LIMIT && fatigueAfter > FATIGUE_LIMIT;

  let fatiguePenalty = 0;
  if (fatiguePenaltyApplied) {
    fatiguePenalty = Math.round(subtotal * FATIGUE_SOFT_PENALTY);
  }

  let coins = Math.max(1, subtotal - fatiguePenalty);
  const eventBonus =
    eventMultiplier > 1 ? Math.round(coins * (eventMultiplier - 1)) : 0;
  coins = Math.max(1, coins + eventBonus);
  const baseBuffBonus =
    baseBuffMultiplier > 1 ? Math.round(coins * (baseBuffMultiplier - 1)) : 0;
  coins = Math.max(1, coins + baseBuffBonus);

  const xpTier = xpTierForDirt(dirtLevel);
  let xp = Math.max(1, Math.round(coins * xpTier));
  if (fatiguePenaltyApplied) {
    xp = Math.max(1, Math.round(xp * (1 - FATIGUE_SOFT_PENALTY)));
  }

  let fatiguePointsAddedAdjusted = fatiguePointsAdded;
  if (rpgModifiers?.fatiguePointsMultiplier < 1) {
    fatiguePointsAddedAdjusted = Math.max(
      0,
      Math.round(fatiguePointsAdded * rpgModifiers.fatiguePointsMultiplier)
    );
  }

  if (rpgModifiers) {
    coins = Math.max(
      1,
      Math.round(coins * rpgModifiers.specCoinMult * rpgModifiers.qualityCoinMult)
    );
    xp = Math.max(1, Math.round(xp * rpgModifiers.specXpMult * rpgModifiers.qualityXpMult));
  }

  const messages = [];
  if (streak.streakBroken) {
    messages.push("Racha reiniciada: la zona necesitaba más cuidado de lo habitual.");
  } else if (streak.achievement) {
    messages.push("¡Logro especial! Racha de 30 en esta tarea.");
  } else if (streak.milestone) {
    messages.push(`¡Racha de ${streak.milestone}! Bonus de monedas.`);
  }
  if (fatigueWarning) {
    messages.push("Fatiga alta: considera un descanso. Recompensa −20% a partir de ahora hoy.");
  } else if (fatiguePenaltyApplied) {
    messages.push("Fatiga elevada hoy: −20% monedas y XP.");
  }
  if (efficiency.percent > 0) {
    messages.push(`Bonus eficiencia +${efficiency.percent}%.`);
  }
  if (eventBonus > 0) {
    messages.push(`Evento activo: +${Math.round((eventMultiplier - 1) * 100)}% monedas.`);
  }
  if (baseBuffBonus > 0) {
    messages.push(`Base viva: +${Math.round((baseBuffMultiplier - 1) * 100)}% monedas.`);
  }
  if (rpgModifiers?.qualityCoinMult > 1) {
    messages.push("Bonus calidad por buena valoración.");
  }
  if (rpgModifiers?.specCoinMult > 1) {
    messages.push("Bonus de especialización aplicado.");
  }

  return {
    coins,
    xp,
    newStreak: streak.newStreak,
    streakBroken: streak.streakBroken,
    streakMilestone: streak.milestone,
    streakAchievement: streak.achievement,
    streakBonus: streak.streakBonus,
    fatiguePoints: fatiguePointsBefore + fatiguePointsAddedAdjusted,
    fatigueWarning,
    fatiguePenaltyApplied,
    efficiencyPercent: efficiency.percent,
    messages,
    breakdown: {
      base: preventive.base,
      preventiveMultiplier: preventive.preventiveMultiplier,
      accumulationPenalty: preventive.accumulationPenalty,
      afterPreventive,
      streakBonus: streak.streakBonus,
      newStreak: streak.newStreak,
      efficiencyBonus: efficiency.bonus,
      efficiencyRatio: efficiency.ratio,
      fatiguePenalty,
      fatiguePointsBefore,
      fatiguePointsAdded: fatiguePointsAddedAdjusted,
      fatiguePointsAfter: fatiguePointsBefore + fatiguePointsAddedAdjusted,
      rpgModifiers: rpgModifiers ?? null,
      eventMultiplier,
      eventBonus,
      baseBuffMultiplier,
      baseBuffBonus,
      xpTier,
      coins,
      xp,
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

export function computePriority(task, zone, { recoveryMode = false } = {}) {
  const pressure = taskPressure(task);
  const risk = pressure >= 5 ? 100 : pressure >= 4 ? 80 : pressure >= 3 ? 60 : pressure * 12;
  const impact = pressure * 8;
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
  let score = risk + impact + timeScore;
  if (recoveryMode && (task.is_micro || task.task_type === "micro")) {
    score += 25;
  }
  return score;
}

/**
 * Columnas Kanban E3 (documentadas en queue.service.js):
 * recent | critical | today | recommended | next
 */
export function kanbanColumn(task, zone = null) {
  const pressure = taskPressure(task);
  const daysSince = task.last_completed_at
    ? (Date.now() - new Date(task.last_completed_at).getTime()) / (1000 * 60 * 60 * 24)
    : null;

  const ideal = Number(task.frequency_ideal_days) || 1;
  const tolerance = Number(task.frequency_tolerance_days) || 0;
  const criticalDays = Number(task.frequency_critical_days) || 0;

  if (task.last_completed_at && daysSince < ideal) {
    return "recent";
  }

  if (pressure >= 5 || (daysSince != null && daysSince > ideal + criticalDays)) {
    return "critical";
  }

  if (!task.last_completed_at) {
    if (pressure >= 3) return "today";
    if (pressure <= 1) return "next";
    return "recommended";
  }

  const overdue = daysSince - ideal;

  if (overdue > tolerance) {
    return "today";
  }

  if (overdue >= 0 && overdue <= tolerance) {
    if (pressure <= 1 && overdue < 1) return "next";
    return "recommended";
  }

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
