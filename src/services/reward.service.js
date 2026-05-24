import { BadRequestError } from "../exceptions/BadRequestError.js";
import { NotFoundError } from "../exceptions/NotFoundError.js";
import * as rewardModel from "../models/reward.model.js";
import * as redemptionModel from "../models/redemption.model.js";
import * as userModel from "../models/user.model.js";
import { withTransaction } from "./home.service.js";

function sanitizeRedemption(row, currentUserId = null) {
  const userId = row.user_id ?? null;
  return {
    id: row.id,
    rewardId: row.reward_id,
    rewardName: row.reward_name,
    coinsSpent: row.coins_spent,
    redeemedAt: row.redeemed_at,
    userId,
    userName: row.user_name?.trim() || "Miembro",
    isMine: currentUserId != null && userId === currentUserId,
  };
}

export async function listCatalog(homeId) {
  return rewardModel.listByHome(homeId, { activeOnly: true });
}

export async function listMyRedemptions(userId) {
  const rows = await redemptionModel.listByUser(userId);
  return rows.map((r) => sanitizeRedemption(r, userId));
}

export async function listHomeRedemptions(homeId, currentUserId) {
  const rows = await redemptionModel.listByHome(homeId);
  return rows.map((r) => sanitizeRedemption(r, currentUserId));
}

export async function redeemReward(userId, homeId, rewardId) {
  const reward = await rewardModel.findByIdForHome(rewardId, homeId);
  if (!reward) throw new NotFoundError("Recompensa no encontrada.");
  if (!reward.active) {
    throw new BadRequestError("Esta recompensa ya no está disponible.");
  }

  const coins = await userModel.getWallet(userId);
  if (coins < reward.cost_coins) {
    throw new BadRequestError(
      `No tienes monedas suficientes. Necesitas ${reward.cost_coins} y tienes ${coins}.`
    );
  }

  await withTransaction(async (conn) => {
    const ok = await userModel.deductCoins(userId, reward.cost_coins, conn);
    if (!ok) {
      throw new BadRequestError("No tienes monedas suficientes.");
    }
    await redemptionModel.create(
      {
        userId,
        rewardId: reward.id,
        rewardName: reward.name,
        coinsSpent: reward.cost_coins,
      },
      conn
    );
  });

  const wallet = await userModel.getWallet(userId);
  return {
    message: `Has canjeado «${reward.name}».`,
    rewardName: reward.name,
    coinsSpent: reward.cost_coins,
    wallet,
  };
}
