import * as zoneModel from "../models/zone.model.js";
import * as taskModel from "../models/task.model.js";
import { leadersByZone } from "../utils/taskPressure.js";

/**
 * Recalcula zones.dirt_level = MAX(presión de tareas activas en la zona).
 * Devuelve Map(zoneId → { pressure, taskName, taskId }).
 */
export async function syncZoneDirtFromTasks(homeId, conn = null) {
  const tasks = await taskModel.listByHome(homeId);
  const zones = await zoneModel.listByHome(homeId);
  const leaders = leadersByZone(tasks);

  for (const z of zones) {
    const lead = leaders.get(z.id);
    const level = lead ? lead.pressure : 0;
    if (z.dirt_level !== level) {
      await zoneModel.update(z.id, homeId, { dirt_level: level }, conn);
    }
  }

  return leaders;
}

export async function getZoneLeaders(homeId) {
  const tasks = await taskModel.listByHome(homeId);
  return leadersByZone(tasks);
}
