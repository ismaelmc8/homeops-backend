import * as userModel from "../models/user.model.js";
import * as taskService from "../services/task.service.js";

export async function walletMe(req, res, next) {
  try {
    const coins = await userModel.getWallet(req.user.id);
    res.json({ coins });
  } catch (e) {
    next(e);
  }
}

export async function metricsSummary(req, res, next) {
  try {
    const data = await taskService.getMetricsSummary(req.user.homeId);
    res.json(data);
  } catch (e) {
    next(e);
  }
}
