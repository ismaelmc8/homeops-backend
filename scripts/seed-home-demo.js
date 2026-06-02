/**
 * Configuración inicial de ejemplo para un hogar existente.
 * No crea ni renombra estancias; solo ajusta mapa, suciedad, premios, metas y smart.
 *
 * Uso:
 *   node scripts/seed-home-demo.js
 *   node scripts/seed-home-demo.js --home-id=3
 *   npm run db:seed-demo
 */
import "../src/config/loadEnv.js";
import { pool } from "../src/config/db.js";
import * as goalModel from "../src/models/goal.model.js";
import { ZONE_ICONS, DEFAULT_ZONE_ICON } from "../src/constants/visualization.js";

const args = process.argv.slice(2);
const homeIdArg = args.find((a) => a.startsWith("--home-id="));
const TARGET_HOME_ID = homeIdArg ? Number(homeIdArg.split("=")[1]) : null;

/** Disposición del mapa (3 columnas) — mismas estancias, posiciones de ejemplo. */
const ZONE_LAYOUT = {
  Pasillo:    { gridCol: 2, gridRow: 1, icon: "🚪", dirtLevel: 2 },
  Cocina:     { gridCol: 1, gridRow: 1, icon: "🍳", dirtLevel: 2 },
  Comedor:    { gridCol: 3, gridRow: 1, icon: "🍽️", dirtLevel: 2 },
  Dormitorio: { gridCol: 1, gridRow: 2, icon: "🛏️", dirtLevel: 1 },
  Baño:       { gridCol: 3, gridRow: 2, icon: "🚿", dirtLevel: 3 },
  Despacho:   { gridCol: 2, gridRow: 2, icon: "💼", dirtLevel: 1 },
  Vestidor:   { gridCol: 2, gridRow: 3, icon: "👔", dirtLevel: 1 },
};

/** Premios de ejemplo (monedas orientadas a ~2–4 tareas medias). */
const REWARDS_CATALOG = [
  { name: "Elegir película", cost: 50 },
  { name: "Noche de pizza", cost: 80 },
  { name: "Día sin tareas pesadas", cost: 100 },
  { name: "Comprar algo online (pequeño)", cost: 120 },
  { name: "Salida al cine / plan salida", cost: 150 },
  { name: "Fin de semana sin cocinar", cost: 200 },
];

/** Objetivo semanal piloto (admin). */
const WEEKLY_GOAL_DEMO = {
  goalType: "completions_count",
  targetValue: 12,
  rewardCoins: 60,
  customLabel: "Semana piloto: 12 tareas en equipo",
};

function zoneIcon(name) {
  const key = (name || "").toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
  for (const [k, icon] of Object.entries(ZONE_ICONS)) {
    if (key.includes(k)) return icon;
  }
  return DEFAULT_ZONE_ICON;
}

async function resolveHomeId() {
  if (TARGET_HOME_ID) {
    const [rows] = await pool.query("SELECT id, name FROM homes WHERE id = ?", [TARGET_HOME_ID]);
    if (!rows[0]) throw new Error(`No existe hogar con id ${TARGET_HOME_ID}`);
    return rows[0];
  }
  const [homes] = await pool.query("SELECT id, name FROM homes ORDER BY id");
  if (!homes.length) throw new Error("No hay hogares en la base de datos.");
  if (homes.length > 1) {
    console.log("[demo] Varios hogares encontrados; usa --home-id=N");
    for (const h of homes) console.log(`  - id ${h.id}: ${h.name}`);
  }
  return homes[0];
}

async function applyZoneDemo(homeId) {
  const [zones] = await pool.query(
    "SELECT id, name FROM zones WHERE home_id = ?",
    [homeId]
  );
  let updated = 0;
  for (const z of zones) {
    const cfg = ZONE_LAYOUT[z.name];
    if (!cfg) {
      console.warn(`[demo]   zona sin layout predefinido: «${z.name}» (se omite)`);
      continue;
    }
    await pool.query(
      `UPDATE zones SET dirt_level = ?, grid_col = ?, grid_row = ?, map_icon = ? WHERE id = ?`,
      [cfg.dirtLevel, cfg.gridCol, cfg.gridRow, cfg.icon || zoneIcon(z.name), z.id]
    );
    updated++;
  }
  const today = new Date().toISOString().slice(0, 10);
  await pool.query("UPDATE homes SET last_deterioration_at = ? WHERE id = ?", [today, homeId]);
  return { zones: zones.length, updated };
}

async function applyRewards(homeId) {
  const [existing] = await pool.query(
    "SELECT LOWER(TRIM(name)) AS n FROM rewards WHERE home_id = ? AND active = 1",
    [homeId]
  );
  const names = new Set(existing.map((r) => r.n));
  let inserted = 0;
  for (const item of REWARDS_CATALOG) {
    const key = item.name.toLowerCase().trim();
    if (names.has(key)) continue;
    await pool.query(
      "INSERT INTO rewards (home_id, name, cost_coins) VALUES (?, ?, ?)",
      [homeId, item.name, item.cost]
    );
    names.add(key);
    inserted++;
    console.log(`[demo]   + premio: ${item.name} (${item.cost} 🪙)`);
  }
  return inserted;
}

async function applySocial(homeId) {
  await pool.query(
    "UPDATE homes SET social_mvp_enabled = 1, social_ranking_enabled = 1 WHERE id = ?",
    [homeId]
  );
}

async function applySmartSettings(homeId, userIds) {
  await pool.query(
    `INSERT INTO home_smart_settings (
      home_id, silence_mode, notifications_enabled, predictions_enabled,
      next_task_enabled, auto_priority_enabled, optimal_hours_enabled,
      burnout_guard_enabled, assignee_suggestions_enabled,
      quiet_hours_start, quiet_hours_end, daily_notification_cap
    ) VALUES (?, 0, 1, 1, 1, 1, 1, 1, 1, 22, 8, 3)
    ON DUPLICATE KEY UPDATE
      notifications_enabled = 1,
      predictions_enabled = 1,
      next_task_enabled = 1,
      auto_priority_enabled = 1,
      optimal_hours_enabled = 1,
      burnout_guard_enabled = 1,
      assignee_suggestions_enabled = 1`,
    [homeId]
  );
  for (const uid of userIds) {
    await pool.query(
      "INSERT INTO user_smart_prefs (user_id, low_energy_mode) VALUES (?, 0) ON DUPLICATE KEY UPDATE low_energy_mode = low_energy_mode",
      [uid]
    );
  }
}

async function applyWeeklyGoal(homeId) {
  const row = await goalModel.getOrCreateCurrent(homeId);
  await goalModel.updateCurrentGoal(homeId, {
    goalType: WEEKLY_GOAL_DEMO.goalType,
    targetValue: WEEKLY_GOAL_DEMO.targetValue,
    rewardCoins: WEEKLY_GOAL_DEMO.rewardCoins,
    customLabel: WEEKLY_GOAL_DEMO.customLabel,
    setByAdmin: true,
  });
  await pool.query(
    "UPDATE home_weekly_goals SET claimed_at = NULL WHERE id = ?",
    [row.id]
  );
  return WEEKLY_GOAL_DEMO;
}

async function clearBossMissions(homeId) {
  const [r] = await pool.query(
    "UPDATE home_boss_missions SET status = 'completed', completed_at = NOW() WHERE home_id = ? AND status = 'active'",
    [homeId]
  );
  return r.affectedRows ?? 0;
}

async function seedTasksIfSparse(homeId) {
  const [rows] = await pool.query(
    "SELECT COUNT(*) AS c FROM tasks WHERE home_id = ? AND active = 1",
    [homeId]
  );
  if (rows[0].c >= 20) {
    console.log(`[demo]   tareas: ${rows[0].c} activas (no se añaden más)`);
    return 0;
  }
  console.log(`[demo]   pocas tareas (${rows[0].c}); ejecuta: npm run db:seed-tasks`);
  return 0;
}

async function main() {
  const home = await resolveHomeId();
  const homeId = home.id;
  console.log(`[demo] Configurando hogar «${home.name}» (id ${homeId})…`);

  const [users] = await pool.query(
    "SELECT id FROM users WHERE home_id = ? AND status = 'active'",
    [homeId]
  );
  const userIds = users.map((u) => u.id);

  const zoneResult = await applyZoneDemo(homeId);
  console.log(`[demo] Zonas: ${zoneResult.updated}/${zoneResult.zones} con mapa y suciedad de ejemplo`);

  const rewardsAdded = await applyRewards(homeId);
  console.log(`[demo] Premios: ${rewardsAdded} nuevos`);

  await applySocial(homeId);
  console.log("[demo] Social: MVP y ranking amistoso activados");

  await applySmartSettings(homeId, userIds);
  console.log(`[demo] Smart: ajustes del hogar + prefs para ${userIds.length} usuario(s)`);

  const goal = await applyWeeklyGoal(homeId);
  console.log(`[demo] Objetivo semanal: ${goal.customLabel} (${goal.targetValue} tareas, ${goal.rewardCoins} 🪙)`);

  const bosses = await clearBossMissions(homeId);
  if (bosses > 0) console.log(`[demo] Boss cerrados: ${bosses}`);

  await seedTasksIfSparse(homeId);

  console.log("[demo] Listo. Recarga la app para ver el estado piloto.");
  await pool.end();
}

main().catch((err) => {
  console.error("[demo] Error:", err.message);
  process.exit(1);
});
