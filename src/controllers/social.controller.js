import * as socialService from "../services/social.service.js";

export async function catalog(req, res, next) {
  try {
    res.json(socialService.getSocialCatalog());
  } catch (e) {
    next(e);
  }
}

export async function getSettings(req, res, next) {
  try {
    const data = await socialService.getSettings(req.user.homeId);
    res.json(data);
  } catch (e) {
    next(e);
  }
}

export async function updateSettings(req, res, next) {
  try {
    const data = await socialService.updateSettings(req.user.homeId, req.body);
    res.json(data);
  } catch (e) {
    next(e);
  }
}

export async function timeline(req, res, next) {
  try {
    const days = req.query.days ? Number(req.query.days) : 14;
    const userId = req.query.userId ? Number(req.query.userId) : null;
    const zoneId = req.query.zoneId ? Number(req.query.zoneId) : null;
    const items = await socialService.getTimeline(req.user.homeId, { days, userId, zoneId });
    res.json({ items });
  } catch (e) {
    next(e);
  }
}

export async function sendKudos(req, res, next) {
  try {
    const result = await socialService.sendKudos(req.user.homeId, req.user.id, req.body);
    res.json(result);
  } catch (e) {
    next(e);
  }
}

export async function mvp(req, res, next) {
  try {
    const data = await socialService.getWeeklyMvp(req.user.homeId);
    res.json(data);
  } catch (e) {
    next(e);
  }
}

export async function ranking(req, res, next) {
  try {
    const data = await socialService.getFriendlyRanking(req.user.homeId);
    res.json(data);
  } catch (e) {
    next(e);
  }
}

export async function microGoals(req, res, next) {
  try {
    const data = await socialService.getMicroGoals(req.user.homeId, req.user.id);
    res.json(data);
  } catch (e) {
    next(e);
  }
}
