import * as goalService from "../services/goal.service.js";

export async function weekly(req, res, next) {
  try {
    const goal = await goalService.getWeeklyGoal(req.user.homeId);
    res.json(goal);
  } catch (e) {
    next(e);
  }
}

export async function claim(req, res, next) {
  try {
    const result = await goalService.claimWeeklyGoal(req.user.homeId, req.user.id);
    res.json(result);
  } catch (e) {
    next(e);
  }
}
