import { BadRequestError } from "../exceptions/BadRequestError.js";
import { pool } from "../config/db.js";
import * as goalModel from "../models/goal.model.js";
import * as zoneModel from "../models/zone.model.js";
import * as userModel from "../models/user.model.js";
import { withTransaction } from "./home.service.js";

export async function computeGoalProgress(homeId, goal) {
  const weekStart = goal.week_start;
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  if (goal.goal_type === "zero_critical_zones") {
    const zones = await zoneModel.listByHome(homeId);
    const critical = zones.filter((z) => z.dirt_level >= 4).length;
    const met = critical === 0;
    return {
      current: met ? 1 : 0,
      target: 1,
      percent: met ? 100 : 0,
      met,
      label: "0 zonas en crítico",
    };
  }

  if (goal.goal_type === "coop_completions_count") {
    const [rows] = await pool.query(
      `SELECT COUNT(*) AS c FROM task_completions c
       JOIN tasks t ON t.id = c.task_id
       WHERE t.home_id = ? AND t.is_cooperative = 1
         AND c.completed_at >= ? AND c.completed_at < ?`,
      [homeId, weekStart, weekEnd.toISOString().slice(0, 10)]
    );
    const current = rows[0]?.c ?? 0;
    const target = goal.target_value;
    return {
      current,
      target,
      percent: target ? Math.min(100, Math.round((current / target) * 100)) : 100,
      met: current >= target,
      label: `${target} tareas cooperativas esta semana`,
    };
  }

  if (goal.goal_type === "micro_completions_count") {
    const [rows] = await pool.query(
      `SELECT COUNT(*) AS c FROM task_completions c
       JOIN tasks t ON t.id = c.task_id
       WHERE t.home_id = ? AND (t.is_micro = 1 OR t.task_type = 'micro')
         AND c.completed_at >= ? AND c.completed_at < ?`,
      [homeId, weekStart, weekEnd.toISOString().slice(0, 10)]
    );
    const current = rows[0]?.c ?? 0;
    const target = goal.target_value;
    return {
      current,
      target,
      percent: target ? Math.min(100, Math.round((current / target) * 100)) : 100,
      met: current >= target,
      label: `${target} microtareas esta semana`,
    };
  }

  const [rows] = await pool.query(
    `SELECT COUNT(*) AS c FROM task_completions c
     JOIN tasks t ON t.id = c.task_id
     WHERE t.home_id = ? AND c.completed_at >= ? AND c.completed_at < ?`,
    [homeId, weekStart, weekEnd.toISOString().slice(0, 10)]
  );
  const current = rows[0]?.c ?? 0;
  const target = goal.target_value;
  const percent = target ? Math.min(100, Math.round((current / target) * 100)) : 100;
  return {
    current,
    target,
    percent,
    met: current >= target,
    label: `${target} tareas completadas en la semana`,
  };
}

export async function getWeeklyGoal(homeId) {
  const goal = await goalModel.getOrCreateCurrent(homeId);
  const progress = await computeGoalProgress(homeId, goal);
  const label = goal.custom_label || progress.label;
  return {
    id: goal.id,
    weekStart: goal.week_start,
    goalType: goal.goal_type,
    targetValue: goal.target_value,
    rewardCoins: goal.reward_coins,
    claimed: !!goal.claimed_at,
    setByAdmin: !!goal.set_by_admin,
    customLabel: goal.custom_label,
    progress: { ...progress, label },
    canClaim: progress.met && !goal.claimed_at,
  };
}

export async function setWeeklyGoal(homeId, body) {
  const allowed = [
    "completions_count",
    "zero_critical_zones",
    "coop_completions_count",
    "micro_completions_count",
  ];
  if (!allowed.includes(body.goalType)) {
    throw new BadRequestError("Tipo de objetivo no válido.");
  }
  const goal = await goalModel.updateCurrentGoal(homeId, {
    goalType: body.goalType,
    targetValue: Math.max(1, Number(body.targetValue) || 10),
    rewardCoins: Math.max(10, Number(body.rewardCoins) || 50),
    customLabel: body.customLabel?.trim() || null,
    setByAdmin: true,
  });
  return getWeeklyGoal(homeId);
}

export async function claimWeeklyGoal(homeId, userId) {
  const goal = await goalModel.getOrCreateCurrent(homeId);
  if (goal.claimed_at) {
    throw new BadRequestError("El cofre de esta semana ya se abrió.");
  }

  const progress = await computeGoalProgress(homeId, goal);
  if (!progress.met) {
    throw new BadRequestError("El objetivo semanal aún no está cumplido.");
  }

  const [members] = await pool.query(
    "SELECT id FROM users WHERE home_id = ? AND status = 'active'",
    [homeId]
  );
  if (!members.length) throw new BadRequestError("No hay miembros activos.");

  const share = Math.max(1, Math.floor(goal.reward_coins / members.length));

  await withTransaction(async (conn) => {
    await goalModel.markClaimed(goal.id, conn);
    for (const m of members) {
      await userModel.addCoins(m.id, share, conn);
    }
  });

  const wallet = await userModel.getWallet(userId);
  return {
    message: `¡Cofre abierto! +${share} monedas para cada miembro activo.`,
    coinsPerMember: share,
    wallet,
  };
}
