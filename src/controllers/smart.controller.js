import * as smartService from "../services/smart.service.js";

export async function getSettings(req, res, next) {
  try {
    const data = await smartService.getAdminSettings(req.user.homeId);
    res.json(data);
  } catch (e) {
    next(e);
  }
}

export async function updateSettings(req, res, next) {
  try {
    const data = await smartService.updateAdminSettings(req.user.homeId, req.body);
    res.json(data);
  } catch (e) {
    next(e);
  }
}

export async function updatePrefs(req, res, next) {
  try {
    const data = await smartService.updateUserPreferences(req.user.id, req.body);
    res.json(data);
  } catch (e) {
    next(e);
  }
}

export async function markNotificationRead(req, res, next) {
  try {
    const data = await smartService.markRead(
      req.user.homeId,
      req.user.id,
      Number(req.params.id)
    );
    res.json(data);
  } catch (e) {
    next(e);
  }
}
