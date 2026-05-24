import * as taskModel from "../models/task.model.js";
import * as taskService from "../services/task.service.js";
import { dirtReductionForTaskType } from "../services/rewardEngine.js";
import { NotFoundError } from "../exceptions/NotFoundError.js";

export async function listKanban(req, res, next) {
  try {
    const data = await taskService.getKanban(req.user.homeId);
    res.json(data);
  } catch (e) {
    next(e);
  }
}

export async function list(req, res, next) {
  try {
    const tasks = await taskModel.listByHome(req.user.homeId);
    res.json(tasks);
  } catch (e) {
    next(e);
  }
}

export async function create(req, res, next) {
  try {
    const b = req.body;
    const taskType = b.taskType || "recurrent_light";
    const task = await taskModel.create({
      homeId: req.user.homeId,
      zoneId: b.zoneId,
      name: b.name,
      taskType,
      difficulty: b.difficulty ?? 2,
      durationMin: b.durationMin ?? 15,
      frequencyIdealDays: b.frequencyIdealDays ?? 2,
      frequencyToleranceDays: b.frequencyToleranceDays ?? 1,
      frequencyCriticalDays: b.frequencyCriticalDays ?? 3,
      dirtReduction: b.dirtReduction ?? dirtReductionForTaskType(taskType),
      isMicro: b.isMicro ?? taskType === "micro",
    });
    res.status(201).json(task);
  } catch (e) {
    next(e);
  }
}

export async function update(req, res, next) {
  try {
    const b = req.body;
    const task = await taskModel.update(Number(req.params.id), req.user.homeId, {
      zoneId: b.zoneId,
      name: b.name,
      taskType: b.taskType,
      difficulty: b.difficulty,
      durationMin: b.durationMin,
      frequencyIdealDays: b.frequencyIdealDays,
      frequencyToleranceDays: b.frequencyToleranceDays,
      frequencyCriticalDays: b.frequencyCriticalDays,
      dirtReduction: b.dirtReduction,
      isMicro: b.isMicro,
      active: b.active,
    });
    if (!task) throw new NotFoundError("Tarea no encontrada.");
    res.json(task);
  } catch (e) {
    next(e);
  }
}

export async function remove(req, res, next) {
  try {
    const ok = await taskModel.remove(Number(req.params.id), req.user.homeId);
    if (!ok) throw new NotFoundError("Tarea no encontrada.");
    res.status(204).send();
  } catch (e) {
    next(e);
  }
}

export async function complete(req, res, next) {
  try {
    const result = await taskService.completeTask(
      Number(req.params.id),
      req.user.homeId,
      req.user.id
    );
    res.json(result);
  } catch (e) {
    next(e);
  }
}
