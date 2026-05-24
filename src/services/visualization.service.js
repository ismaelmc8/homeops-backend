import { pool } from "../config/db.js";
import * as zoneModel from "../models/zone.model.js";
import * as taskModel from "../models/task.model.js";
import { kanbanColumn } from "./rewardEngine.js";
import {
  DIRT_LABELS,
  ZONE_ICONS,
  DEFAULT_ZONE_ICON,
  HEATMAP_DEFAULT_DAYS,
  HEATMAP_MAX_DAYS,
} from "../constants/visualization.js";

function zoneIcon(name) {
  const key = (name || "").toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
  for (const [k, icon] of Object.entries(ZONE_ICONS)) {
    if (key.includes(k)) return icon;
  }
  return DEFAULT_ZONE_ICON;
}

function stabilityPercent(dirtLevel) {
  return Math.round(((5 - Math.min(5, Math.max(0, dirtLevel))) / 5) * 100);
}

function daysSinceCompletion(lastCompletedAt) {
  if (!lastCompletedAt) return null;
  return (Date.now() - new Date(lastCompletedAt).getTime()) / (1000 * 60 * 60 * 24);
}

/** Riesgo de caos 0–100 (más alto = peor). No afecta monedas. */
export function computeChaosRisk(zones, tasks) {
  if (!zones.length) return 0;

  let score = 0;
  for (const z of zones) {
    const d = z.dirt_level ?? 0;
    if (d >= 5) score += 18;
    else if (d >= 4) score += 14;
    else if (d >= 3) score += 9;
    else if (d >= 2) score += 4;
    else if (d >= 1) score += 1;
  }

  const zoneMap = Object.fromEntries(zones.map((z) => [z.id, z]));
  for (const t of tasks) {
    if (t.snoozed_until && new Date(t.snoozed_until) > new Date()) continue;
    const zone = zoneMap[t.zone_id] ?? { dirt_level: t.zone_dirt_level ?? 0 };
    const col = kanbanColumn(t, zone);
    if (col === "critical") score += 6;
    else if (col === "today") {
      const days = daysSinceCompletion(t.last_completed_at);
      if (days === null && (zone.dirt_level ?? 0) >= 3) score += 4;
      else score += 2;
    }
  }

  return Math.min(100, Math.round(score));
}

/** Distribución en grid si no hay posiciones guardadas. */
export function assignDefaultGridPositions(zones) {
  const cols = 3;
  return zones.map((z, i) => {
    if (z.grid_col > 0 || z.grid_row > 0) {
      return { col: z.grid_col, row: z.grid_row };
    }
    return { col: (i % cols) + 1, row: Math.floor(i / cols) + 1 };
  });
}

export async function getVisualizationOverview(homeId) {
  const zones = await zoneModel.listByHome(homeId);
  const tasks = await taskModel.listByHome(homeId);
  const positions = assignDefaultGridPositions(zones);

  const zoneCards = zones.map((z, i) => {
    const zoneTasks = tasks.filter((t) => t.zone_id === z.id);
    const pending = zoneTasks.filter((t) => {
      if (t.snoozed_until && new Date(t.snoozed_until) > new Date()) return false;
      return kanbanColumn(t, z) !== "recent";
    });
    const critical = pending.filter((t) => kanbanColumn(t, z) === "critical").length;

    return {
      id: z.id,
      name: z.name,
      dirtLevel: z.dirt_level,
      dirtLabel: DIRT_LABELS[z.dirt_level] ?? DIRT_LABELS[0],
      stabilityPercent: stabilityPercent(z.dirt_level),
      icon: z.map_icon || zoneIcon(z.name),
      gridCol: positions[i].col,
      gridRow: positions[i].row,
      taskCount: zoneTasks.length,
      pendingCount: pending.length,
      criticalCount: critical,
    };
  });

  const stableZones = zones.filter((z) => z.dirt_level <= 1).length;
  const globalStabilityPercent = zones.length
    ? Math.round((stableZones / zones.length) * 100)
    : 100;

  const [xpRow] = await pool.query(
    `SELECT COALESCE(SUM(xp), 0) AS homeXp, COUNT(*) AS members
     FROM users WHERE home_id = ? AND status = 'active'`,
    [homeId]
  );

  const chaosRisk = computeChaosRisk(zones, tasks);

  return {
    zones: zoneCards,
    chaosRisk,
    globalStabilityPercent,
    stableZonesPercent: globalStabilityPercent,
    stableZonesCount: stableZones,
    totalZones: zones.length,
    homeXp: xpRow[0]?.homeXp ?? 0,
    activeMembers: xpRow[0]?.members ?? 0,
    pendingTasksTotal: tasks.filter((t) => {
      const z = zones.find((x) => x.id === t.zone_id);
      if (!z) return false;
      if (t.snoozed_until && new Date(t.snoozed_until) > new Date()) return false;
      return kanbanColumn(t, z) !== "recent";
    }).length,
  };
}

export async function getZoneDetail(homeId, zoneId) {
  const zone = await zoneModel.findById(zoneId, homeId);
  if (!zone) return null;

  const tasks = (await taskModel.listByHome(homeId)).filter((t) => t.zone_id === zoneId);
  const enriched = tasks.map((t) => {
    const col = kanbanColumn(t, zone);
    const days = daysSinceCompletion(t.last_completed_at);
    let scheduleStatus = "ok";
    if (days !== null) {
      const overdue = days - t.frequency_ideal_days;
      if (overdue > t.frequency_critical_days) scheduleStatus = "critical";
      else if (overdue > t.frequency_tolerance_days) scheduleStatus = "late";
    }
    const snoozed = t.snoozed_until && new Date(t.snoozed_until) > new Date();
    return {
      id: t.id,
      name: t.name,
      taskType: t.task_type,
      isMicro: !!t.is_micro,
      isCooperative: !!t.is_cooperative,
      durationMin: t.duration_min,
      column: snoozed ? "snoozed" : col,
      scheduleStatus,
      snoozedUntil: t.snoozed_until,
      lastCompletedAt: t.last_completed_at,
    };
  });

  const [history] = await pool.query(
    `SELECT c.id, c.completed_at, c.coins_earned, c.xp_earned, c.zone_dirt_at_completion,
            u.name AS user_name, t.name AS task_name
     FROM task_completions c
     JOIN tasks t ON t.id = c.task_id
     JOIN users u ON u.id = c.user_id
     WHERE t.zone_id = ? AND t.home_id = ?
     ORDER BY c.completed_at DESC
     LIMIT 12`,
    [zoneId, homeId]
  );

  return {
    zone: {
      id: zone.id,
      name: zone.name,
      dirtLevel: zone.dirt_level,
      dirtLabel: DIRT_LABELS[zone.dirt_level] ?? DIRT_LABELS[0],
      stabilityPercent: stabilityPercent(zone.dirt_level),
      icon: zone.map_icon || zoneIcon(zone.name),
    },
    tasks: enriched,
    recentCompletions: history.map((r) => ({
      id: r.id,
      completedAt: r.completed_at,
      taskName: r.task_name,
      userName: r.user_name,
      coinsEarned: r.coins_earned,
      xpEarned: r.xp_earned,
      dirtAtCompletion: r.zone_dirt_at_completion,
    })),
  };
}

export async function getHeatmap(homeId, days = HEATMAP_DEFAULT_DAYS) {
  const capped = Math.min(HEATMAP_MAX_DAYS, Math.max(7, Number(days) || HEATMAP_DEFAULT_DAYS));
  const zones = await zoneModel.listByHome(homeId);

  const [rows] = await pool.query(
    `SELECT DATE(c.completed_at) AS day, t.zone_id,
            COUNT(*) AS completions,
            ROUND(AVG(c.zone_dirt_at_completion), 1) AS avg_dirt
     FROM task_completions c
     JOIN tasks t ON t.id = c.task_id
     WHERE t.home_id = ? AND c.completed_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
     GROUP BY DATE(c.completed_at), t.zone_id
     ORDER BY day ASC`,
    [homeId, capped]
  );

  const daySet = new Set();
  const cells = rows.map((r) => {
    const d = r.day instanceof Date ? r.day.toISOString().slice(0, 10) : String(r.day).slice(0, 10);
    daySet.add(d);
    const intensity = Math.min(5, Math.round(Number(r.avg_dirt) || 0));
    return {
      day: d,
      zoneId: r.zone_id,
      completions: r.completions,
      intensity,
    };
  });

  const daysList = [...daySet].sort();
  if (!daysList.length) {
    const today = new Date().toISOString().slice(0, 10);
    daysList.push(today);
  }

  return {
    days: daysList,
    zones: zones.map((z) => ({ id: z.id, name: z.name, icon: z.map_icon || zoneIcon(z.name) })),
    cells,
    periodDays: capped,
  };
}

export async function updateZoneMapLayout(homeId, layouts) {
  for (const item of layouts) {
    await pool.query(
      `UPDATE zones SET grid_col = ?, grid_row = ?, map_icon = ?
       WHERE id = ? AND home_id = ?`,
      [
        item.gridCol ?? 0,
        item.gridRow ?? 0,
        item.mapIcon ?? null,
        item.zoneId,
        homeId,
      ]
    );
  }
  return getVisualizationOverview(homeId);
}
