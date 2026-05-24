import * as dailyBonusModel from "../models/dailyBonus.model.js";
import * as userModel from "../models/user.model.js";
import { DAILY_PREVENTIVE_BONUS_COINS } from "../constants/social.js";

/** Primera tarea preventiva del día (suciedad ≤1) → bonus único. */
export async function tryDailyPreventiveBonus(userId, completionId, zoneDirt, conn) {
  if (zoneDirt > 1) {
    return { dailyBonusCoins: 0, message: null };
  }
  const claimed = await dailyBonusModel.hasClaimedToday(userId, conn);
  if (claimed) {
    return { dailyBonusCoins: 0, message: null };
  }
  await dailyBonusModel.recordClaim(userId, completionId, DAILY_PREVENTIVE_BONUS_COINS, conn);
  await userModel.addCoins(userId, DAILY_PREVENTIVE_BONUS_COINS, conn);
  return {
    dailyBonusCoins: DAILY_PREVENTIVE_BONUS_COINS,
    message: `Bonus diario: +${DAILY_PREVENTIVE_BONUS_COINS} monedas por tu primera tarea preventiva hoy.`,
  };
}
