import * as smartModel from "../models/smart.model.js";
import * as zoneModel from "../models/zone.model.js";
import * as userModel from "../models/user.model.js";
import {
  MIN_COMPLETIONS_FOR_PREDICTION,
  PREDICTION_HISTORY_DAYS,
  OPTIMAL_HOURS_HISTORY_DAYS,
  BURNOUT_LOOKBACK_DAYS,
  BURNOUT_FATIGUE_THRESHOLD,
  BURNOUT_SLOW_RATIO,
  BURNOUT_COLUMN_LIMIT,
  DEFAULT_COLUMN_LIMIT,
  SMART_AUTOMATIONS,
} from "../constants/smart.js";

function formatSettings(row) {
  return {
    silenceMode: !!row.silence_mode,
    notificationsEnabled: !!row.notifications_enabled,
    predictionsEnabled: !!row.predictions_enabled,
    nextTaskEnabled: !!row.next_task_enabled,
    autoPriorityEnabled: !!row.auto_priority_enabled,
    optimalHoursEnabled: !!row.optimal_hours_enabled,
    burnoutGuardEnabled: !!row.burnout_guard_enabled,
    assigneeSuggestionsEnabled: !!row.assignee_suggestions_enabled,
    quietHoursStart: row.quiet_hours_start ?? 22,
    quietHoursEnd: row.quiet_hours_end ?? 8,
    dailyNotificationCap: row.daily_notification_cap ?? 3,
  };
}

function isInQuietHours(hour, start, end) {
  if (start === end) return false;
  if (start < end) return hour >= start && hour < end;
  return hour >= start || hour < end;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

/** Predicción lineal: suciedad actual + incremento diario − ritmo de limpieza histórico. */
export function predictZoneDirtLevel(zone, zoneStats, daysAhead = 2) {
  const current = Number(zone.dirt_level) || 0;
  const increment = Number(zone.daily_increment) || 1;
  const completions = zoneStats?.completions ?? 0;

  if (completions < MIN_COMPLETIONS_FOR_PREDICTION) {
    const projected = Math.min(
      5,
      Math.round((current + increment * daysAhead) * 10) / 10
    );
    return {
      zoneId: zone.id,
      zoneName: zone.name,
      currentLevel: current,
      projectedLevel: projected,
      daysAhead,
      confidence: "low",
      insufficientData: true,
      label:
        projected >= 3
          ? `${zone.name} ~ nivel ${Math.round(projected)} en ${daysAhead} días (estimación básica)`
          : null,
      reason:
        "Pocos datos históricos: usamos solo el ritmo de deterioro de la zona.",
    };
  }

  const cleaningPerDay = completions / PREDICTION_HISTORY_DAYS;
  const netDaily = increment - cleaningPerDay * 0.35;
  const projected = Math.min(
    5,
    Math.max(0, Math.round((current + netDaily * daysAhead) * 10) / 10)
  );

  let confidence = "medium";
  if (completions >= 12) confidence = "high";

  const daysToLevel3 =
    netDaily > 0 && current < 3
      ? Math.ceil((3 - current) / netDaily)
      : projected >= 3
        ? 0
        : null;

  return {
    zoneId: zone.id,
    zoneName: zone.name,
    currentLevel: current,
    projectedLevel: projected,
    daysAhead,
    daysToLevel3,
    confidence,
    insufficientData: false,
    label:
      projected >= 2.5
        ? `${zone.name} ~ nivel ${Math.round(projected)} en ${daysAhead} días`
        : null,
    reason: `Basado en ${completions} limpiezas en ${PREDICTION_HISTORY_DAYS} días y +${increment}/día de deterioro.`,
  };
}

export function computeOptimalHours(hourRows) {
  if (!hourRows.length) {
    return {
      hours: [],
      label: null,
      reason: "Aún no hay suficiente historial de horarios.",
    };
  }
  const sorted = [...hourRows].sort((a, b) => b.c - a.c);
  const top = sorted.slice(0, 3).map((r) => Number(r.hour));
  const label = top.length
    ? `Sueles actuar sobre las ${top.map((h) => `${h}:00`).join(", ")}`
    : null;
  return {
    hours: top,
    label,
    reason: `Calculado desde tus completados de los últimos ${OPTIMAL_HOURS_HISTORY_DAYS} días.`,
  };
}

export function isOptimalWindowNow(optimalHours) {
  if (!optimalHours?.hours?.length) return false;
  const h = new Date().getHours();
  return optimalHours.hours.includes(h);
}

export function detectBurnout({ fatiguePoints, fatigueLimit, recentCompletions }) {
  const reasons = [];
  let active = false;

  if (fatiguePoints >= BURNOUT_FATIGUE_THRESHOLD || fatiguePoints > fatigueLimit) {
    active = true;
    reasons.push("Fatiga elevada hoy.");
  }

  const withQuality = recentCompletions.filter(
    (c) => c.quality_rating != null && c.quality_rating >= 1
  );
  if (withQuality.length >= 2) {
    const avgQ =
      withQuality.reduce((s, c) => s + Number(c.quality_rating), 0) / withQuality.length;
    if (avgQ < 2.5) {
      active = true;
      reasons.push("Valoraciones recientes bajas (calidad).");
    }
  }

  const withDuration = recentCompletions.filter(
    (c) => c.duration_actual > 0 && c.duration_min > 0
  );
  if (withDuration.length >= 2) {
    const ratios = withDuration.map((c) => c.duration_actual / c.duration_min);
    const avgRatio = ratios.reduce((s, r) => s + r, 0) / ratios.length;
    if (avgRatio >= BURNOUT_SLOW_RATIO) {
      active = true;
      reasons.push("Las tareas recientes han tardado más de lo habitual.");
    }
  }

  const dirtyCompletions = recentCompletions.filter(
    (c) => c.zone_dirt_at_completion >= 3
  ).length;
  if (recentCompletions.length >= 3 && dirtyCompletions / recentCompletions.length >= 0.6) {
    active = true;
    reasons.push("Muchas tareas se completaron con la zona ya muy sucia.");
  }

  return {
    active,
    reasons,
    suggestion: active
      ? "Modo energía baja recomendado: solo microtareas visibles, sin mensajes negativos."
      : null,
  };
}

export function applySmartPriorityBoost(basePriority, task, zone, ctx) {
  if (!ctx.autoPriorityEnabled) {
    return { priority: basePriority, smartReasons: [] };
  }

  let boost = 0;
  const smartReasons = [];

  if (ctx.inOptimalWindow && ctx.optimalHoursEnabled) {
    boost += 5;
    smartReasons.push("Encaja con tu horario habitual de actividad.");
  }

  const pred = ctx.predictionsByZone?.[zone.id];
  if (pred?.daysToLevel3 != null && pred.daysToLevel3 <= 2) {
    boost += 8;
    smartReasons.push(`Predicción: ${zone.name} podría llegar a nivel 3 pronto.`);
  } else if (pred?.projectedLevel >= 3) {
    boost += 5;
    smartReasons.push(`Predicción: ${zone.name} empeorará en los próximos días.`);
  }

  if (zone.dirt_level <= 1 && task.isMicro) {
    boost += 3;
    smartReasons.push("Preventivo: zona limpia + microtarea rápida.");
  }

  if (task.scheduleStatus === "critical" || zone.dirt_level >= 4) {
    boost += 4;
    smartReasons.push("Riesgo alto en la zona.");
  }

  return { priority: basePriority + boost, smartReasons };
}

export function pickNextBestTask(pendingTasks) {
  if (!pendingTasks.length) return null;
  const sorted = [...pendingTasks].sort((a, b) => b.priority - a.priority);
  const best = sorted[0];
  return {
    taskId: best.id,
    name: best.name,
    zoneName: best.zoneName,
    durationMin: best.durationMin,
    reasons: best.smartReasons?.length
      ? best.smartReasons
      : ["Mayor prioridad según suciedad, plazos e impacto."],
  };
}

export function suggestAssignee(memberCounts, task) {
  if (!memberCounts.length) return null;
  const sorted = [...memberCounts].sort((a, b) => a.c - b.c);
  const pick = sorted[0];
  return {
    userId: pick.user_id,
    name: pick.name,
    completionsThisWeek: pick.c,
    reason: `${pick.name} lleva menos tareas esta semana (${pick.c}). Equilibrio sugerido, no obligatorio.`,
    taskId: task.id,
    taskName: task.name,
  };
}

export async function maybeCreateNotifications(homeId, userId, settings, ctx) {
  if (
    settings.silenceMode ||
    !settings.notificationsEnabled ||
    isInQuietHours(new Date().getHours(), settings.quietHoursStart, settings.quietHoursEnd)
  ) {
    return [];
  }

  const day = todayStr();
  const count = await smartModel.getDailyNotificationCount(homeId, userId, day);
  if (count >= settings.dailyNotificationCap) return [];

  const created = [];
  const tryInsert = async (payload) => {
    if (created.length + count >= settings.dailyNotificationCap) return;
    await smartModel.insertNotification({ homeId, userId, ...payload });
    await smartModel.incrementDailyNotificationCount(homeId, userId, day);
    created.push(payload);
  };

  for (const pred of ctx.predictions ?? []) {
    if (!pred.label || pred.projectedLevel < 3) continue;
    await tryInsert({
      kind: "zone_risk",
      title: "Riesgo en zona",
      body: pred.label,
      reason: pred.reason,
    });
    break;
  }

  for (const t of ctx.criticalTasks ?? []) {
    await tryInsert({
      kind: "window_closing",
      title: "Ventana por cerrar",
      body: `«${t.name}» en ${t.zoneName} está muy atrasada.`,
      reason: "El plazo crítico de la tarea se acerca o ya pasó.",
    });
    break;
  }

  if (ctx.inOptimalWindow && ctx.optimalHours?.label) {
    await tryInsert({
      kind: "optimal_window",
      title: "Buen momento",
      body: "Es una franja en la que sueles completar tareas.",
      reason: ctx.optimalHours.reason,
    });
  }

  return created;
}

export async function getSmartInsights(homeId, userId, {
  fatiguePoints = 0,
  fatigueLimit = 8,
  enrichedTasks = [],
  zones = [],
} = {}) {
  const settingsRow = await smartModel.getHomeSettings(homeId);
  const settings = formatSettings(settingsRow);
  const userPrefsRow = await smartModel.getUserPrefs(userId);
  const lowEnergyMode = !!userPrefsRow.low_energy_mode;

  const zoneStatsRows = await smartModel.getZoneCompletionStats(
    homeId,
    PREDICTION_HISTORY_DAYS
  );
  const statsByZone = Object.fromEntries(
    zoneStatsRows.map((r) => [r.zone_id, r])
  );

  const predictions =
    settings.predictionsEnabled
      ? zones.map((z) => predictZoneDirtLevel(z, statsByZone[z.id]))
      : [];

  const predictionsByZone = Object.fromEntries(
    predictions.map((p) => [p.zoneId, p])
  );

  const hourRows = settings.optimalHoursEnabled
    ? await smartModel.getCompletionHours(homeId, userId, OPTIMAL_HOURS_HISTORY_DAYS)
    : [];
  let optimalHours = computeOptimalHours(hourRows);
  if (!hourRows.length && settings.optimalHoursEnabled) {
    const homeHours = await smartModel.getHomeCompletionHours(
      homeId,
      OPTIMAL_HOURS_HISTORY_DAYS
    );
    optimalHours = computeOptimalHours(homeHours);
    if (homeHours.length) {
      optimalHours.reason = `Horario del hogar (últimos ${OPTIMAL_HOURS_HISTORY_DAYS} días).`;
    }
  }

  const inOptimalWindow = isOptimalWindowNow(optimalHours);

  const recentCompletions = await smartModel.getUserRecentCompletions(
    userId,
    BURNOUT_LOOKBACK_DAYS
  );
  const burnout = settings.burnoutGuardEnabled
    ? detectBurnout({ fatiguePoints, fatigueLimit, recentCompletions })
    : { active: false, reasons: [], suggestion: null };

  const autoPriorityEnabled = settings.autoPriorityEnabled;
  const pending = enrichedTasks.filter((t) => t.column !== "recent" && t.column !== "snoozed");

  const boosted = pending.map((t) => {
    const zone = zones.find((z) => z.id === t.zoneId) ?? {
      id: t.zoneId,
      name: t.zoneName,
      dirt_level: t.dirtLevel,
    };
    const { priority, smartReasons } = applySmartPriorityBoost(t.priority, t, zone, {
      autoPriorityEnabled,
      optimalHoursEnabled: settings.optimalHoursEnabled,
      inOptimalWindow,
      predictionsByZone,
    });
    return { ...t, priority, smartReasons };
  });

  const nextBestTask =
    settings.nextTaskEnabled ? pickNextBestTask(boosted) : null;

  const memberCounts = settings.assigneeSuggestionsEnabled
    ? await smartModel.getMemberCompletionCounts(homeId, 7)
    : [];
  const assigneeSuggestions = settings.assigneeSuggestionsEnabled
    ? pending
        .filter((t) => t.isCooperative && !t.assignees?.length)
        .slice(0, 3)
        .map((t) => suggestAssignee(memberCounts, t))
        .filter(Boolean)
    : [];

  const criticalTasks = pending.filter(
    (t) => t.scheduleStatus === "critical" || t.dirtLevel >= 4
  );

  const notifications = await maybeCreateNotifications(homeId, userId, settings, {
    predictions,
    criticalTasks,
    inOptimalWindow,
    optimalHours,
  });

  const columnLimit =
    settings.burnoutGuardEnabled && (burnout.active || lowEnergyMode)
      ? BURNOUT_COLUMN_LIMIT
      : DEFAULT_COLUMN_LIMIT;

  const feed = await smartModel.listNotifications(homeId, userId, 15);

  const taskBoosts = Object.fromEntries(
    boosted.map((t) => [
      t.id,
      { priority: t.priority, smartReasons: t.smartReasons ?? [] },
    ])
  );

  return {
    settings,
    automationsCatalog: SMART_AUTOMATIONS,
    userPrefs: { lowEnergyMode },
    predictions: predictions.filter((p) => p.label),
    optimalHours,
    inOptimalWindow,
    nextBestTask,
    assigneeSuggestions,
    burnout: {
      ...burnout,
      lowEnergyRecommended: burnout.active && settings.burnoutGuardEnabled,
    },
    columnLimit,
    effectiveMicroOnly: lowEnergyMode || (burnout.active && settings.burnoutGuardEnabled),
    notifications: feed.map((n) => ({
      id: n.id,
      kind: n.kind,
      title: n.title,
      body: n.body,
      reason: n.reason,
      createdAt: n.created_at,
      read: !!n.read_at,
    })),
    newNotifications: notifications,
    taskBoosts,
    engineNote:
      "Motor E9: reglas transparentes sobre tu historial local. Sin ML externo ni datos fuera del hogar.",
  };
}

export async function getAdminSettings(homeId) {
  const row = await smartModel.getHomeSettings(homeId);
  return {
    settings: formatSettings(row),
    automationsCatalog: SMART_AUTOMATIONS,
  };
}

export async function updateAdminSettings(homeId, body) {
  await smartModel.updateHomeSettings(homeId, body);
  return getAdminSettings(homeId);
}

export async function updateUserPreferences(userId, body) {
  await smartModel.updateUserPrefs(userId, body);
  const prefs = await smartModel.getUserPrefs(userId);
  return { lowEnergyMode: !!prefs.low_energy_mode };
}

export async function markRead(homeId, userId, notificationId) {
  await smartModel.markNotificationRead(notificationId, homeId, userId);
  return { ok: true };
}

export function getAutomationMatrix(settings) {
  return SMART_AUTOMATIONS.map((a) => ({
    key: a.key,
    label: a.label,
    enabled: !!settings[a.key],
  }));
}
