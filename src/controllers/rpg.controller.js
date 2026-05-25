import * as rpgService from "../services/rpg.service.js";

export async function profile(req, res, next) {
  try {
    const data = await rpgService.getRpgProfile(req.user.id, req.user.homeId);
    res.json(data);
  } catch (e) {
    next(e);
  }
}

export async function setSpecialization(req, res, next) {
  try {
    const data = await rpgService.setSpecialization(req.user.id, req.body.specialization);
    res.json(data);
  } catch (e) {
    next(e);
  }
}

export async function equipTitle(req, res, next) {
  try {
    const data = await rpgService.equipTitle(req.user.id, req.body.titleKey ?? null);
    res.json(data);
  } catch (e) {
    next(e);
  }
}

export async function purchase(req, res, next) {
  try {
    const data = await rpgService.purchaseShopItem(req.user.id, req.params.key);
    res.json(data);
  } catch (e) {
    next(e);
  }
}

export async function equipCosmetic(req, res, next) {
  try {
    const data = await rpgService.equipCosmetic(req.user.id, req.body.cosmeticKey ?? null);
    res.json(data);
  } catch (e) {
    next(e);
  }
}

export async function revokeSessions(req, res, next) {
  try {
    const data = await rpgService.revokeAllSessions(req.user.id);
    res.json(data);
  } catch (e) {
    next(e);
  }
}
