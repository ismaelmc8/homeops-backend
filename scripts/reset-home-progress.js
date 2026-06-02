/**
 * Borra progreso e historial de un hogar. Conserva:
 *   - homes, zones, users, tasks, rewards (catálogo)
 *
 * Elimina / pone a cero: completados, monedas, XP, rachas, fatiga, canjes,
 * kudos, metas semanales, eventos, boss, RPG, smart notifications, coop, etc.
 *
 * Uso:
 *   node scripts/reset-home-progress.js --home-id=3
 *   npm run db:reset-progress -- --home-id=3
 */
import "../src/config/loadEnv.js";
import { pool } from "../src/config/db.js";

const args = process.argv.slice(2);
const homeIdArg = args.find((a) => a.startsWith("--home-id="));
const TARGET_HOME_ID = homeIdArg ? Number(homeIdArg.split("=")[1]) : null;
const FORCE = args.includes("--yes");

/** Fecha local (evita desfase UTC en last_deterioration_at). */
function todayDateStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

async function resolveHomeId() {
  if (TARGET_HOME_ID) {
    const [rows] = await pool.query("SELECT id, name FROM homes WHERE id = ?", [
      TARGET_HOME_ID,
    ]);
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

async function resetHomeProgress(homeId) {
  const conn = await pool.getConnection();
  const stats = {};

  try {
    await conn.beginTransaction();

    const [users] = await conn.query(
      "SELECT id FROM users WHERE home_id = ?",
      [homeId]
    );
    const userIds = users.map((u) => u.id);
    if (!userIds.length) throw new Error("El hogar no tiene usuarios.");

    const [tasks] = await conn.query(
      "SELECT id FROM tasks WHERE home_id = ?",
      [homeId]
    );
    const taskIds = tasks.map((t) => t.id);

    const phUsers = userIds.map(() => "?").join(",");
    const phTasks = taskIds.length ? taskIds.map(() => "?").join(",") : "0";

    // —— Completados y dependencias ——
    if (taskIds.length) {
      const [kudos] = await conn.query(
        `DELETE k FROM kudos k
         INNER JOIN task_completions c ON c.id = k.completion_id
         INNER JOIN tasks t ON t.id = c.task_id
         WHERE t.home_id = ?`,
        [homeId]
      );
      stats.kudos = kudos.affectedRows ?? 0;

      const [bonus] = await conn.query(
        `DELETE d FROM daily_preventive_bonus d
         INNER JOIN users u ON u.id = d.user_id
         WHERE u.home_id = ?`,
        [homeId]
      );
      stats.dailyPreventiveBonus = bonus.affectedRows ?? 0;

      const [comps] = await conn.query(
        `DELETE c FROM task_completions c
         INNER JOIN tasks t ON t.id = c.task_id
         WHERE t.home_id = ?`,
        [homeId]
      );
      stats.completions = comps.affectedRows ?? 0;
    } else {
      stats.kudos = 0;
      stats.dailyPreventiveBonus = 0;
      stats.completions = 0;
    }

    const [redemptions] = await conn.query(
      `DELETE rr FROM reward_redemptions rr
       INNER JOIN users u ON u.id = rr.user_id
       WHERE u.home_id = ?`,
      [homeId]
    );
    stats.redemptions = redemptions.affectedRows ?? 0;

    const [streaks] = await conn.query(
      `DELETE s FROM streaks s
       INNER JOIN users u ON u.id = s.user_id
       WHERE u.home_id = ?`,
      [homeId]
    );
    stats.streaks = streaks.affectedRows ?? 0;

    const [fatigue] = await conn.query(
      `DELETE f FROM daily_fatigue f
       INNER JOIN users u ON u.id = f.user_id
       WHERE u.home_id = ?`,
      [homeId]
    );
    stats.fatigue = fatigue.affectedRows ?? 0;

    const [microGoals] = await conn.query(
      "DELETE FROM user_micro_goals WHERE home_id = ?",
      [homeId]
    );
    stats.microGoals = microGoals.affectedRows ?? 0;

    // —— Cooperación en tareas ——
    if (taskIds.length) {
      const [coopParts] = await conn.query(
        `DELETE p FROM task_coop_participants p
         INNER JOIN task_coop_cycles cy ON cy.id = p.cycle_id
         WHERE cy.task_id IN (${phTasks})`,
        taskIds
      );
      stats.coopParticipants = coopParts.affectedRows ?? 0;

      const [coopCycles] = await conn.query(
        `DELETE FROM task_coop_cycles WHERE task_id IN (${phTasks})`,
        taskIds
      );
      stats.coopCycles = coopCycles.affectedRows ?? 0;

      const [assignees] = await conn.query(
        `DELETE FROM task_assignees WHERE task_id IN (${phTasks})`,
        taskIds
      );
      stats.assignees = assignees.affectedRows ?? 0;
    }

    // —— Meta / eventos / smart ——
    const tablesByHome = [
      ["smart_notifications", "smartNotifications"],
      ["smart_notification_daily", "smartNotificationDaily"],
      ["home_events", "events"],
      ["home_weekly_goals", "weeklyGoals"],
      ["home_daily_missions", "dailyMissions"],
      ["home_boss_missions", "bossMissions"],
      ["home_season_progress", "seasonProgress"],
      ["task_templates", "taskTemplates"],
    ];
    for (const [table, key] of tablesByHome) {
      const [r] = await conn.query(
        `DELETE FROM ${table} WHERE home_id = ?`,
        [homeId]
      );
      stats[key] = r.affectedRows ?? 0;
    }

    // —— RPG por usuario ——
    const [achievements] = await conn.query(
      `DELETE FROM user_achievements WHERE user_id IN (${phUsers})`,
      userIds
    );
    stats.achievements = achievements.affectedRows ?? 0;

    const [buffs] = await conn.query(
      `DELETE FROM user_active_buffs WHERE user_id IN (${phUsers})`,
      userIds
    );
    stats.buffs = buffs.affectedRows ?? 0;

    const [cosmetics] = await conn.query(
      `DELETE FROM user_cosmetics_owned WHERE user_id IN (${phUsers})`,
      userIds
    );
    stats.cosmetics = cosmetics.affectedRows ?? 0;

    const [rpgPrefs] = await conn.query(
      `DELETE FROM user_rpg_prefs WHERE user_id IN (${phUsers})`,
      userIds
    );
    stats.rpgPrefs = rpgPrefs.affectedRows ?? 0;

    const [smartPrefs] = await conn.query(
      `DELETE FROM user_smart_prefs WHERE user_id IN (${phUsers})`,
      userIds
    );
    stats.smartPrefs = smartPrefs.affectedRows ?? 0;

    // —— Monedas y XP ——
    const [wallets] = await conn.query(
      `UPDATE wallets SET coins = 0 WHERE user_id IN (${phUsers})`,
      userIds
    );
    stats.walletsReset = wallets.affectedRows ?? 0;

    const [xp] = await conn.query(
      `UPDATE users SET xp = 0, last_active_at = NULL WHERE home_id = ?`,
      [homeId]
    );
    stats.usersReset = xp.affectedRows ?? 0;

    // —— Estado de tareas y zonas ——
    const [tasksUpd] = await conn.query(
      `UPDATE tasks SET last_completed_at = NULL, snoozed_until = NULL, is_boss = 0
       WHERE home_id = ?`,
      [homeId]
    );
    stats.tasksReset = tasksUpd.affectedRows ?? 0;

    const [zonesUpd] = await conn.query(
      "UPDATE zones SET dirt_level = 1 WHERE home_id = ?",
      [homeId]
    );
    stats.zonesReset = zonesUpd.affectedRows ?? 0;

    const today = todayDateStr();
    await conn.query(
      "UPDATE homes SET last_deterioration_at = ? WHERE id = ?",
      [today, homeId]
    );

    await conn.commit();
    return stats;
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
    console.log(
      `[reset] ATENCIÓN: se borrará todo el progreso de «${home.name}» (id ${home.id}).`
    );
    console.log("[reset] Se conservan: casa, zonas, usuarios, tareas y catálogo de premios.");
    console.log("[reset] Ejecuta con --yes para confirmar.");
    process.exit(1);
  }

  console.log(`[reset] Reiniciando progreso de «${home.name}» (id ${home.id})…`);
  const stats = await resetHomeProgress(home.id);

  console.log("[reset] Resumen:");
  for (const [k, v] of Object.entries(stats)) {
    console.log(`  ${k}: ${v}`);
  }
  console.log("[reset] Listo. Recarga la app.");
  await pool.end();
}

main().catch((err) => {
  console.error("[reset] Error:", err.message);
  process.exit(1);
});
