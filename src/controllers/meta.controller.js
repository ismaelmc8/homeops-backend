import * as metaService from "../services/meta.service.js";

export async function dashboard(req, res, next) {
  try {
    const data = await metaService.getMetaDashboard(req.user.homeId, req.user.id);
    res.json(data);
  } catch (e) {
    next(e);
  }
}

export async function updateSettings(req, res, next) {
  try {
    const data = await metaService.updateMetaSettings(
      req.user.homeId,
      req.user.id,
      req.body
    );
    res.json(data);
  } catch (e) {
    next(e);
  }
}
