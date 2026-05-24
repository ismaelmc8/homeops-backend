import * as taskModel from "../models/task.model.js";
import * as assigneeModel from "../models/assignee.model.js";
import * as taskService from "../services/task.service.js";
import { dirtReductionForTaskType } from "../services/rewardEngine.js";
import { NotFoundError } from "../exceptions/NotFoundError.js";

export async function listKanban(req, res, next) {
  try {
    const microOnly = req.query.microOnly === "1" || req.query.microOnly === "true";
    const assignedToMe =
      req.query.assignedToMe === "1" || req.query.assignedToMe === "true";
    const data = await taskService.getKanban(req.user.homeId, req.user.id, {
      microOnly,
      assignedToMe,
    });
    res.json(data);
  } catch (e) {
    next(e);
  }
}

export async function list(req, res, next) {
  try {
    const tasks = await taskModel.listByHome(req.user.homeId);
    const assigneeMap = await assigneeModel.listForTasks(tasks.map((t) => t.id));
    res.json(
      tasks.map((t) => ({
        ...t,
        is_cooperative: !!t.is_cooperative,
        assignees: assigneeMap[t.id] ?? [],
      }))
    );
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
      isCooperative: !!b.isCooperative,
    });
    if (b.assigneeIds?.length) {
      await taskService.setTaskAssignees(task.id, req.user.homeId, b.assigneeIds);
    }
    const assignees = await assigneeModel.listForTask(task.id);
    res.status(201).json({ ...task, assignees });
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
      isCooperative: b.isCooperative,
      active: b.active,
    });
    if (!task) throw new NotFoundError("Tarea no encontrada.");
    if (b.assigneeIds !== undefined) {
      await taskService.setTaskAssignees(task.id, req.user.homeId, b.assigneeIds);
    }
    const assignees = await assigneeModel.listForTask(task.id);
    res.json({ ...task, assignees });
  } catch (e) {
    next(e);
  }
}

export async function setAssignees(req, res, next) {
  try {
    const result = await taskService.setTaskAssignees(
      Number(req.params.id),
      req.user.homeId,
      req.body.userIds ?? req.body.assigneeIds
    );
    res.json(result);
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

export async function postpone(req, res, next) {
  try {
    const days = Number(req.body?.days ?? 1);
    const result = await taskService.postponeTask(
      Number(req.params.id),
      req.user.homeId,
      days
    );
    res.json(result);
  } catch (e) {
    next(e);
  }
}

export async function split(req, res, next) {
  try {
    const result = await taskService.splitTask(Number(req.params.id), req.user.homeId);
    res.json(result);
  } catch (e) {
    next(e);
  }
}

export async function quickMicro(req, res, next) {
  try {
    const task = await taskService.createQuickMicro(req.user.homeId, req.body);
    res.status(201).json(task);
  } catch (e) {
    next(e);
  }
}

export async function complete(req, res, next) {
  try {
    const durationActualMin =
      req.body?.durationActualMin != null ? Number(req.body.durationActualMin) : null;
    const b = req.body ?? {};
    const result = await taskService.completeTask(
      Number(req.params.id),
      req.user.homeId,
      req.user.id,
      {
        durationActualMin: Number.isFinite(durationActualMin) ? durationActualMin : null,
        feedbackChip: b.feedbackChip ?? null,
        feedbackEmoji: b.feedbackEmoji ?? null,
        tags: b.tags ?? null,
      }
    );
    res.json(result);
  } catch (e) {
    next(e);
  }
}
