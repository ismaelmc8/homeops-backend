/**
 * Entorno mínimo para pruebas: borra progreso, elimina zonas/tareas actuales
 * y crea 2 zonas + 4 tareas. Conserva usuarios, hogar y premios del catálogo.
 *
 * Uso:
 *   node scripts/reset-minimal-test.js --yes
 *   node scripts/reset-minimal-test.js --home-id=3 --yes
 *   npm run db:reset-minimal -- --yes
 */
import "../src/config/loadEnv.js";
import { pool } from "../src/config/db.js";

const args = process.argv.slice(2);
const homeIdArg = args.find((a) => a.startsWith("--home-id="));
const TARGET_HOME_ID = homeIdArg ? Number(homeIdArg.split("=")[1]) : null;
const FORCE = args.includes("--yes");

const ZONES = [
  { name: "Cocina", icon: "🍳", gridCol: 1, gridRow: 1, dirtLevel: 1 },
  { name: "Salón", icon: "🛋️", gridCol: 2, gridRow: 1, dirtLevel: 1 },
];

/** 4 tareas sencillas: 2 por zona */
const TASKS = [
  {
    zone: "Cocina",
    name: "Fregar platos",
    taskType: "micro",
    durationMin: 5,
    frequencyIdealDays: 1,
    frequencyToleranceDays: 1,
    frequencyCriticalDays: 3,
    isMicro: true,
  },
  {
    zone: "Cocina",
    name: "Limpiar encimera",
    taskType: "recurrent_light",
    durationMin: 10,
    frequencyIdealDays: 2,
    frequencyToleranceDays: 1,
    frequencyCriticalDays: 5,
  },
  {
    zone: "Salón",
    name: "Recoger mesa",
    taskType: "micro",
    durationMin: 5,
    frequencyIdealDays: 1,
    frequencyToleranceDays: 1,
    frequencyCriticalDays: 3,
    isMicro: true,
  },
  {
    zone: "Salón",
    name: "Aspirar salón",
    taskType: "recurrent_light",
    durationMin: 15,
    frequencyIdealDays: 4,
    frequencyToleranceDays: 2,
    frequencyCriticalDays: 8,
  },
];

function todayDateStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function resolveHomeId() {
  if (TARGET_HOME_ID) {
    const [rows] = await pool.query("SELECT id, name FROM homes WHERE id = ?", [TARGET_HOME_ID]);
    if (!rows[0]) throw new Error(`No existe hogar con id ${TARGET_HOME_ID}`);
    return rows[0];
  }
  const [homes] = await pool.query("SELECT id, name FROM homes ORDER BY id");
  if (!homes.length) throw new Error("No hay hogares.");
  if (homes.length > 1) {
    throw new Error(
      "Varios hogares: indica --home-id=N. Hogares: " +
        homes.map((h) => `${h.id}=${h.name}`).join(", ")
    );
  }
  return homes[0];
}

async function wipeAndSeedMinimal(homeId) {
  const conn = await pool.getConnection();
  const stats = { zonesDeleted: 0, tasksDeleted: 0, zonesCreated: 0, tasksCreated: 0 };

  try {
    await conn.beginTransaction();

    const [users] = await conn.query("SELECT id FROM users WHERE home_id = ?", [homeId]);
    const userIds = users.map((u) => u.id);
    if (!userIds.length) throw new Error("El hogar no tiene usuarios.");

    const [tasksBefore] = await conn.query("SELECT id FROM tasks WHERE home_id = ?", [homeId]);
    const taskIds = tasksBefore.map((t) => t.id);
    stats.tasksDeleted = taskIds.length;

    const phUsers = userIds.map(() => "?").join(",");

    // —— Progreso e historial ——
    if (taskIds.length) {
      await conn.query(
        `DELETE pr FROM completion_peer_ratings pr
         INNER JOIN task_completions c ON c.id = pr.completion_id
         INNER JOIN tasks t ON t.id = c.task_id
         WHERE t.home_id = ?`,
        [homeId]
      );
      await conn.query(
        `DELETE k FROM kudos k
         INNER JOIN task_completions c ON c.id = k.completion_id
         INNER JOIN tasks t ON t.id = c.task_id
         WHERE t.home_id = ?`,
        [homeId]
      );
      await conn.query(
        `DELETE d FROM daily_preventive_bonus d
         INNER JOIN users u ON u.id = d.user_id WHERE u.home_id = ?`,
        [homeId]
      );
      await conn.query(
        `DELETE c FROM task_completions c
         INNER JOIN tasks t ON t.id = c.task_id WHERE t.home_id = ?`,
        [homeId]
      );
      const phTasks = taskIds.map(() => "?").join(",");
      await conn.query(
        `DELETE p FROM task_coop_participants p
         INNER JOIN task_coop_cycles cy ON cy.id = p.cycle_id
         WHERE cy.task_id IN (${phTasks})`,
        taskIds
      );
      await conn.query(`DELETE FROM task_coop_cycles WHERE task_id IN (${phTasks})`, taskIds);
      await conn.query(`DELETE FROM task_assignees WHERE task_id IN (${phTasks})`, taskIds);
      await conn.query(`DELETE FROM streaks WHERE task_id IN (${phTasks})`, taskIds);
    }

    await conn.query(
      `DELETE rr FROM reward_redemptions rr
       INNER JOIN users u ON u.id = rr.user_id WHERE u.home_id = ?`,
      [homeId]
    );
    await conn.query(
      `DELETE f FROM daily_fatigue f
       INNER JOIN users u ON u.id = f.user_id WHERE u.home_id = ?`,
      [homeId]
    );
    await conn.query("DELETE FROM user_micro_goals WHERE home_id = ?", [homeId]);

    for (const table of [
      "smart_notifications",
      "smart_notification_daily",
      "home_events",
      "home_weekly_goals",
      "home_daily_missions",
      "home_boss_missions",
      "home_season_progress",
      "task_templates",
    ]) {
      await conn.query(`DELETE FROM ${table} WHERE home_id = ?`, [homeId]);
    }

    await conn.query(`DELETE FROM user_achievements WHERE user_id IN (${phUsers})`, userIds);
    await conn.query(`DELETE FROM user_active_buffs WHERE user_id IN (${phUsers})`, userIds);
    await conn.query(`DELETE FROM user_cosmetics_owned WHERE user_id IN (${phUsers})`, userIds);
    await conn.query(`DELETE FROM user_rpg_prefs WHERE user_id IN (${phUsers})`, userIds);
    await conn.query(`DELETE FROM user_smart_prefs WHERE user_id IN (${phUsers})`, userIds);
    await conn.query(`UPDATE wallets SET coins = 0 WHERE user_id IN (${phUsers})`, userIds);
    await conn.query(`UPDATE users SET xp = 0, last_active_at = NULL WHERE home_id = ?`, [homeId]);

    // —— Borrar todas las tareas y zonas del hogar ——
    const [delTasks] = await conn.query("DELETE FROM tasks WHERE home_id = ?", [homeId]);
    stats.tasksDeleted = delTasks.affectedRows ?? stats.tasksDeleted;

    const [delZones] = await conn.query("DELETE FROM zones WHERE home_id = ?", [homeId]);
    stats.zonesDeleted = delZones.affectedRows ?? 0;

    // —— Crear 2 zonas ——
    const zoneIds = {};
    for (const z of ZONES) {
      const [r] = await conn.query(
        `INSERT INTO zones (home_id, name, dirt_level, daily_increment, grid_col, grid_row, map_icon)
         VALUES (?, ?, ?, 0, ?, ?, ?)`,
        [homeId, z.name, z.dirtLevel, z.gridCol, z.gridRow, z.icon]
      );
      zoneIds[z.name] = r.insertId;
      stats.zonesCreated += 1;
    }

    // —— Crear 4 tareas ——
    for (const t of TASKS) {
      const zoneId = zoneIds[t.zone];
      if (!zoneId) throw new Error(`Zona no encontrada: ${t.zone}`);
      const isMicro = t.isMicro ?? t.taskType === "micro";
      await conn.query(
        `INSERT INTO tasks (
          home_id, zone_id, name, task_type, difficulty, duration_min,
          frequency_ideal_days, frequency_tolerance_days, frequency_critical_days,
          dirt_reduction, is_micro, is_cooperative, is_boss, active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 1)`,
        [
          homeId,
          zoneId,
          t.name,
          t.taskType,
          isMicro ? 1 : 2,
          t.durationMin,
          t.frequencyIdealDays,
          t.frequencyToleranceDays,
          t.frequencyCriticalDays,
          t.dirtReduction ?? 2,
          isMicro ? 1 : 0,
        ]
      );
      stats.tasksCreated += 1;
    }

    await conn.query("UPDATE homes SET last_deterioration_at = ? WHERE id = ?", [
      todayDateStr(),
      homeId,
    ]);

    await conn.commit();
    return { zoneIds, stats };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

async function main() {
  const home = await resolveHomeId();

  if (!FORCE) {
    console.log(`[minimal] ATENCIÓN: se reiniciará «${home.name}» (id ${home.id}) a entorno de prueba.`);
    console.log("[minimal] Se borrarán: progreso, historial, TODAS las zonas y tareas actuales.");
    console.log("[minimal] Se crearán: 2 zonas (Cocina, Salón) y 4 tareas.");
    console.log("[minimal] Se conservan: usuarios, hogar y catálogo de premios.");
    console.log("[minimal] Ejecuta con --yes para confirmar.");
    process.exit(1);
  }

  console.log(`[minimal] Preparando entorno de prueba en «${home.name}» (id ${home.id})…`);
  const { zoneIds, stats } = await wipeAndSeedMinimal(home.id);

  console.log("[minimal] Resumen:");
  console.log(`  zonas eliminadas: ${stats.zonesDeleted}`);
  console.log(`  tareas eliminadas: ${stats.tasksDeleted}`);
  console.log(`  zonas creadas: ${stats.zonesCreated}`);
  console.log(`  tareas creadas: ${stats.tasksCreated}`);
  console.log("[minimal] Zonas:");
  for (const z of ZONES) {
    console.log(`  · ${z.icon} ${z.name} (id ${zoneIds[z.name]})`);
  }
  console.log("[minimal] Tareas:");
  for (const t of TASKS) {
    console.log(`  · ${t.zone}: ${t.name} (~${t.durationMin} min)`);
  }
  console.log("[minimal] Listo. Recarga la app e inicia sesión con tus usuarios habituales.");
  await pool.end();
}

main().catch((err) => {
  console.error("[minimal] Error:", err.message);
  process.exit(1);
});
