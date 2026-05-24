import { pool } from "../config/db.js";

export async function listByHome(homeId) {
  const [rows] = await pool.query(
    `SELECT t.*, z.name AS zone_name
     FROM task_templates t
     LEFT JOIN zones z ON z.id = t.zone_id
     WHERE t.home_id = ?
     ORDER BY t.name`,
    [homeId]
  );
  return rows;
}

export async function findById(id, homeId) {
  const [rows] = await pool.query(
    `SELECT t.*, z.name AS zone_name
     FROM task_templates t
     LEFT JOIN zones z ON z.id = t.zone_id
     WHERE t.id = ? AND t.home_id = ?`,
    [id, homeId]
  );
  return rows[0] ?? null;
}

export async function create(data) {
  const [r] = await pool.query(
    `INSERT INTO task_templates (
      home_id, name, zone_id, task_type, difficulty, duration_min,
      frequency_ideal_days, frequency_tolerance_days, frequency_critical_days,
      dirt_reduction, is_micro, is_cooperative
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.homeId,
      data.name,
      data.zoneId ?? null,
      data.taskType,
      data.difficulty,
      data.durationMin,
      data.frequencyIdealDays,
      data.frequencyToleranceDays,
      data.frequencyCriticalDays,
      data.dirtReduction,
      data.isMicro ? 1 : 0,
      data.isCooperative ? 1 : 0,
    ]
  );
  return findById(r.insertId, data.homeId);
}

export async function update(id, homeId, data) {
  const map = {
    name: data.name,
    zone_id: data.zoneId,
    task_type: data.taskType,
    difficulty: data.difficulty,
    duration_min: data.durationMin,
    frequency_ideal_days: data.frequencyIdealDays,
    frequency_tolerance_days: data.frequencyToleranceDays,
    frequency_critical_days: data.frequencyCriticalDays,
    dirt_reduction: data.dirtReduction,
    is_micro: data.isMicro !== undefined ? (data.isMicro ? 1 : 0) : undefined,
    is_cooperative:
      data.isCooperative !== undefined ? (data.isCooperative ? 1 : 0) : undefined,
  };
  const fields = [];
  const vals = [];
  for (const [col, val] of Object.entries(map)) {
    if (val !== undefined) {
      fields.push(`${col} = ?`);
      vals.push(val);
    }
  }
  if (!fields.length) return findById(id, homeId);
  vals.push(id, homeId);
  await pool.query(`UPDATE task_templates SET ${fields.join(", ")} WHERE id = ? AND home_id = ?`, vals);
  return findById(id, homeId);
}

export async function remove(id, homeId) {
  const [r] = await pool.query("DELETE FROM task_templates WHERE id = ? AND home_id = ?", [id, homeId]);
  return r.affectedRows > 0;
}
