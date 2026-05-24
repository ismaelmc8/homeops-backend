import * as userModel from "../models/user.model.js";
import * as taskService from "../services/task.service.js";
import { getAdminDashboardMetrics } from "../services/metrics.service.js";
import { getBalanceMetrics } from "../services/balanceMetrics.service.js";

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
    const data = await taskService.getMetricsSummary(req.user.homeId, req.user.id);
    res.json(data);
  } catch (e) {
    next(e);
  }
}

export async function metricsAdmin(req, res, next) {
  try {
    const data = await getAdminDashboardMetrics(req.user.homeId);
    res.json(data);
  } catch (e) {
    next(e);
  }
}

export async function metricsBalance(req, res, next) {
  try {
    const data = await getBalanceMetrics(req.user.homeId);
    res.json(data);
  } catch (e) {
    next(e);
  }
}
