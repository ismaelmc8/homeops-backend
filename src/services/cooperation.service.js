import * as coopModel from "../models/coop.model.js";
import * as userModel from "../models/user.model.js";

export const COOP_BONUS_RATE = 0.15;
export const COOP_WINDOW_HOURS = 48;

export function computeCoopBonus(baseCoins) {
  return Math.max(0, Math.round(baseCoins * COOP_BONUS_RATE));
}

/**
 * Registra participación y aplica +15% cuando hay 2+ miembros distintos en el ciclo.
 */
export async function processCooperativeCompletion(
  { taskId, userId, baseCoins, completionId, isCooperative },
  conn
) {
  if (!isCooperative) {
    return { coopBonusCoins: 0, coopActivated: false, messages: [] };
  }

  let cycle = await coopModel.findOpenCycle(taskId, conn);
  if (!cycle) {
    cycle = await coopModel.createCycle(taskId, COOP_WINDOW_HOURS, conn);
  }

  await coopModel.addParticipant(cycle.id, userId, completionId, conn);
  const participants = await coopModel.listParticipants(cycle.id, conn);

  if (participants.length < 2) {
    return { coopBonusCoins: 0, coopActivated: false, messages: [] };
  }

  const messages = ["¡Bonus cooperativo +15%! Varios miembros participaron en esta tarea."];
  let currentBonus = 0;

  for (const p of participants) {
    if (p.coop_bonus_coins > 0) continue;
    const bonus = computeCoopBonus(p.coins_earned);
    if (bonus <= 0) continue;

    await coopModel.setParticipantBonus(cycle.id, p.user_id, bonus, conn);
    await coopModel.updateCompletionCoopBonus(p.completion_id, bonus, conn);
    await userModel.addCoins(p.user_id, bonus, conn);

    if (p.user_id === userId) {
      currentBonus = bonus;
    }
  }

  return {
    coopBonusCoins: currentBonus,
    coopActivated: true,
    messages,
  };
}
