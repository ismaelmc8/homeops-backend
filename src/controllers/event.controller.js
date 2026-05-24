import * as eventService from "../services/event.service.js";

export async function getActive(req, res, next) {
  try {
    const event = await eventService.getActiveEvent(req.user.homeId);
    res.json({ event });
  } catch (e) {
    next(e);
  }
}

export async function list(req, res, next) {
  try {
    const events = await eventService.listEvents(req.user.homeId);
    res.json(events);
  } catch (e) {
    next(e);
  }
}

export async function create(req, res, next) {
  try {
    const event = await eventService.createEvent(req.user.homeId, req.user.id, req.body);
    res.status(201).json(event);
  } catch (e) {
    next(e);
  }
}

export async function remove(req, res, next) {
  try {
    const result = await eventService.deleteEvent(req.user.homeId, Number(req.params.id));
    res.json(result);
  } catch (e) {
    next(e);
  }
}
