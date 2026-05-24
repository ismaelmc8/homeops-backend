import * as rewardModel from "../models/reward.model.js";
import * as rewardService from "../services/reward.service.js";
import { NotFoundError } from "../exceptions/NotFoundError.js";

export async function list(req, res, next) {
  try {
    const catalog = req.query.catalog === "1";
    const rewards = catalog
      ? await rewardService.listCatalog(req.user.homeId)
      : await rewardModel.listByHome(req.user.homeId);
    res.json(rewards);
  } catch (e) {
    next(e);
  }
}

export async function redeem(req, res, next) {
  try {
    const result = await rewardService.redeemReward(
      req.user.id,
      req.user.homeId,
      Number(req.params.id)
    );
    res.json(result);
  } catch (e) {
    next(e);
  }
}

export async function listMyRedemptions(req, res, next) {
  try {
    const rows = await rewardService.listHomeRedemptions(req.user.homeId, req.user.id);
    res.json(rows);
  } catch (e) {
    next(e);
  }
}

export async function create(req, res, next) {
  try {
    const reward = await rewardModel.create({
      homeId: req.user.homeId,
      name: req.body.name,
      costCoins: req.body.costCoins,
    });
    res.status(201).json(reward);
  } catch (e) {
    next(e);
  }
}

export async function update(req, res, next) {
  try {
    const reward = await rewardModel.update(Number(req.params.id), req.user.homeId, {
      name: req.body.name,
      costCoins: req.body.costCoins,
      active: req.body.active,
    });
    if (!reward) throw new NotFoundError("Canje no encontrado.");
    res.json(reward);
  } catch (e) {
    next(e);
  }
}

export async function remove(req, res, next) {
  try {
    const ok = await rewardModel.remove(Number(req.params.id), req.user.homeId);
    if (!ok) throw new NotFoundError("Canje no encontrado.");
    res.status(204).send();
  } catch (e) {
    next(e);
  }
}
