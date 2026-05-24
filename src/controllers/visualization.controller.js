import * as visualizationService from "../services/visualization.service.js";
import { NotFoundError } from "../exceptions/NotFoundError.js";

export async function overview(req, res, next) {
  try {
    const data = await visualizationService.getVisualizationOverview(req.user.homeId);
    res.json(data);
  } catch (e) {
    next(e);
  }
}

export async function zoneDetail(req, res, next) {
  try {
    const data = await visualizationService.getZoneDetail(
      req.user.homeId,
      Number(req.params.zoneId)
    );
    if (!data) throw new NotFoundError("Zona no encontrada.");
    res.json(data);
  } catch (e) {
    next(e);
  }
}

export async function heatmap(req, res, next) {
  try {
    const days = req.query.days ? Number(req.query.days) : undefined;
    const data = await visualizationService.getHeatmap(req.user.homeId, days);
    res.json(data);
  } catch (e) {
    next(e);
  }
}

export async function updateLayout(req, res, next) {
  try {
    const layouts = req.body?.zones ?? req.body?.layouts ?? [];
    const data = await visualizationService.updateZoneMapLayout(
      req.user.homeId,
      layouts
    );
    res.json(data);
  } catch (e) {
    next(e);
  }
}
