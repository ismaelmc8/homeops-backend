import { BadRequestError } from "../exceptions/BadRequestError.js";
import { NotFoundError } from "../exceptions/NotFoundError.js";
import * as eventModel from "../models/event.model.js";
import * as zoneModel from "../models/zone.model.js";

export const SPEEDRUN_MULTIPLIER = 1.5;
export const SPEEDRUN_MAX_MINUTES = 15;
export const PERFECT_DAY_BONUS_COINS = 25;

export function getEventCoinMultiplier(activeEvent, durationMin) {
  if (!activeEvent) return { multiplier: 1, eventBonus: 0, label: null };
  if (activeEvent.event_type === "speedrun" && durationMin <= SPEEDRUN_MAX_MINUTES) {
    return {
      multiplier: SPEEDRUN_MULTIPLIER,
      eventBonus: 0,
      label: "Speedrun (+50%)",
    };
  }
  return { multiplier: 1, eventBonus: 0, label: null };
}

export async function getActiveEvent(homeId) {
  const row = await eventModel.getActive(homeId);
  if (!row) return null;
  return {
    id: row.id,
    eventType: row.event_type,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    createdByName: row.created_by_name,
  };
}

export async function listEvents(homeId) {
  const rows = await eventModel.listByHome(homeId);
  return rows.map((r) => ({
    id: r.id,
    eventType: r.event_type,
    startsAt: r.starts_at,
    endsAt: r.ends_at,
    createdByName: r.created_by_name,
    isActive: new Date(r.starts_at) <= new Date() && new Date(r.ends_at) > new Date(),
  }));
}

export async function createEvent(homeId, userId, { eventType, startsAt, endsAt }) {
  if (!["speedrun", "perfect_day"].includes(eventType)) {
    throw new BadRequestError("Tipo de evento no válido.");
  }
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    throw new BadRequestError("Fechas de inicio y fin no válidas.");
  }

  const overlap = await eventModel.countOverlapping(homeId, start, end);
  if (overlap > 0) {
    throw new BadRequestError("Ya hay un evento activo o solapado en esas fechas.");
  }

  const row = await eventModel.create({
    homeId,
    eventType,
    startsAt: start,
    endsAt: end,
    createdBy: userId,
  });

  return {
    id: row.id,
    eventType: row.event_type,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
  };
}

export async function deleteEvent(homeId, eventId) {
  const ok = await eventModel.remove(eventId, homeId);
  if (!ok) throw new NotFoundError("Evento no encontrado.");
  return { message: "Evento eliminado." };
}

/** Bonus único si todas las zonas están ≤1 y evento perfect_day activo. */
export async function tryPerfectDayBonus(homeId, userId, conn) {
  const active = await eventModel.getActive(homeId);
  if (!active || active.event_type !== "perfect_day") {
    return { perfectDayBonus: 0, messages: [] };
  }

  const zones = await zoneModel.listByHome(homeId);
  if (!zones.length || zones.some((z) => z.dirt_level > 1)) {
    return { perfectDayBonus: 0, messages: [] };
  }

  return {
    perfectDayBonus: PERFECT_DAY_BONUS_COINS,
    messages: ["¡Día perfecto! Todas las zonas en verde — bonus del hogar."],
  };
}
