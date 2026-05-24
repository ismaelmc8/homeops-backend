import { NotFoundError } from "../exceptions/NotFoundError.js";
import { BadRequestError } from "../exceptions/BadRequestError.js";
import * as templateModel from "../models/template.model.js";
import * as taskModel from "../models/task.model.js";
import * as zoneModel from "../models/zone.model.js";
import { dirtReductionForTaskType } from "./rewardEngine.js";

export async function listTemplates(homeId) {
  const rows = await templateModel.listByHome(homeId);
  return rows.map(formatTemplate);
}

function formatTemplate(t) {
  return {
    id: t.id,
    name: t.name,
    zoneId: t.zone_id,
    zoneName: t.zone_name,
    taskType: t.task_type,
    difficulty: t.difficulty,
    durationMin: t.duration_min,
    frequencyIdealDays: t.frequency_ideal_days,
    frequencyToleranceDays: t.frequency_tolerance_days,
    frequencyCriticalDays: t.frequency_critical_days,
    dirtReduction: t.dirt_reduction,
    isMicro: !!t.is_micro,
    isCooperative: !!t.is_cooperative,
  };
}

export async function createTemplate(homeId, body) {
  if (!body.name?.trim()) throw new BadRequestError("Nombre de plantilla obligatorio.");
  const taskType = body.taskType || "recurrent_light";
  if (body.zoneId) {
    const z = await zoneModel.findById(body.zoneId, homeId);
    if (!z) throw new NotFoundError("Zona no encontrada.");
  }
  const row = await templateModel.create({
    homeId,
    name: body.name.trim(),
    zoneId: body.zoneId ?? null,
    taskType,
    difficulty: body.difficulty ?? 2,
    durationMin: body.durationMin ?? 15,
    frequencyIdealDays: body.frequencyIdealDays ?? 2,
    frequencyToleranceDays: body.frequencyToleranceDays ?? 1,
    frequencyCriticalDays: body.frequencyCriticalDays ?? 3,
    dirtReduction: body.dirtReduction ?? dirtReductionForTaskType(taskType),
    isMicro: body.isMicro ?? taskType === "micro",
    isCooperative: !!body.isCooperative,
  });
  return formatTemplate(row);
}

export async function updateTemplate(id, homeId, body) {
  const row = await templateModel.update(id, homeId, {
    name: body.name?.trim(),
    zoneId: body.zoneId,
    taskType: body.taskType,
    difficulty: body.difficulty,
    durationMin: body.durationMin,
    frequencyIdealDays: body.frequencyIdealDays,
    frequencyToleranceDays: body.frequencyToleranceDays,
    frequencyCriticalDays: body.frequencyCriticalDays,
    dirtReduction: body.dirtReduction,
    isMicro: body.isMicro,
    isCooperative: body.isCooperative,
  });
  if (!row) throw new NotFoundError("Plantilla no encontrada.");
  return formatTemplate(row);
}

export async function deleteTemplate(id, homeId) {
  const ok = await templateModel.remove(id, homeId);
  if (!ok) throw new NotFoundError("Plantilla no encontrada.");
}

/** Crea tarea activa desde plantilla (no sustituye existentes). */
export async function applyTemplate(templateId, homeId, { zoneId, name } = {}) {
  const tpl = await templateModel.findById(templateId, homeId);
  if (!tpl) throw new NotFoundError("Plantilla no encontrada.");

  const targetZoneId = zoneId ?? tpl.zone_id;
  if (!targetZoneId) throw new BadRequestError("Indica una zona para aplicar la plantilla.");
  const z = await zoneModel.findById(targetZoneId, homeId);
  if (!z) throw new NotFoundError("Zona no encontrada.");

  const task = await taskModel.create({
    homeId,
    zoneId: targetZoneId,
    name: (name || tpl.name).trim(),
    taskType: tpl.task_type,
    difficulty: tpl.difficulty,
    durationMin: tpl.duration_min,
    frequencyIdealDays: tpl.frequency_ideal_days,
    frequencyToleranceDays: tpl.frequency_tolerance_days,
    frequencyCriticalDays: tpl.frequency_critical_days,
    dirtReduction: tpl.dirt_reduction,
    isMicro: !!tpl.is_micro,
    isCooperative: !!tpl.is_cooperative,
  });

  return task;
}
