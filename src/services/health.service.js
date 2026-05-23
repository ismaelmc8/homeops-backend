import * as healthModel from "../models/health.model.js";

export async function getHealthStatus() {
  const dbOk = await healthModel.pingDb();
  return { status: dbOk ? "ok" : "degraded", db: dbOk };
}
