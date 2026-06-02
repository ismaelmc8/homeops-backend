import { kanbanColumn } from "../services/rewardEngine.js";
import { taskPressure } from "./taskPressure.js";

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
      if (days === null && taskPressure(t) >= 3) score += 4;
      else score += 2;
    }
  }

  return Math.min(100, Math.round(score));
}
