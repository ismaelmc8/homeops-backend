import * as zoneModel from "../models/zone.model.js";
import { NotFoundError } from "../exceptions/NotFoundError.js";
import { syncZoneDirtFromTasks } from "../services/zoneDirt.service.js";

export async function list(req, res, next) {
  try {
    await syncZoneDirtFromTasks(req.user.homeId);
    const zones = await zoneModel.listByHome(req.user.homeId);
    res.json(zones);
  } catch (e) {
    next(e);
  }
}

export async function create(req, res, next) {
  try {
    const { name, dirtLevel, dailyIncrement } = req.body;
    const zone = await zoneModel.create({
      homeId: req.user.homeId,
      name,
      dirtLevel: dirtLevel ?? 1,
      dailyIncrement: dailyIncrement ?? 1,
    });
    res.status(201).json(zone);
  } catch (e) {
    next(e);
  }
}

export async function update(req, res, next) {
  try {
    const data = {};
    if (req.body.name !== undefined) data.name = req.body.name;
    if (req.body.dirtLevel !== undefined) data.dirt_level = req.body.dirtLevel;
    if (req.body.dailyIncrement !== undefined) data.daily_increment = req.body.dailyIncrement;
    const zone = await zoneModel.update(Number(req.params.id), req.user.homeId, data);
    if (!zone) throw new NotFoundError("Zona no encontrada.");
    res.json(zone);
  } catch (e) {
    next(e);
  }
}

export async function remove(req, res, next) {
  try {
    const ok = await zoneModel.remove(Number(req.params.id), req.user.homeId);
    if (!ok) throw new NotFoundError("Zona no encontrada.");
    res.status(204).send();
  } catch (e) {
    next(e);
  }
}
