import * as healthService from "../services/health.service.js";

export async function getHealth(req, res, next) {
  try {
    const body = await healthService.getHealthStatus();
    const code = body.db ? 200 : 503;
    res.status(code).json(body);
  } catch (e) {
    next(e);
  }
}
