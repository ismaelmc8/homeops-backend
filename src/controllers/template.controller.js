import * as templateService from "../services/template.service.js";

export async function list(req, res, next) {
  try {
    res.json(await templateService.listTemplates(req.user.homeId));
  } catch (e) {
    next(e);
  }
}

export async function create(req, res, next) {
  try {
    const tpl = await templateService.createTemplate(req.user.homeId, req.body);
    res.status(201).json(tpl);
  } catch (e) {
    next(e);
  }
}

export async function update(req, res, next) {
  try {
    const tpl = await templateService.updateTemplate(
      Number(req.params.id),
      req.user.homeId,
      req.body
    );
    res.json(tpl);
  } catch (e) {
    next(e);
  }
}

export async function remove(req, res, next) {
  try {
    await templateService.deleteTemplate(Number(req.params.id), req.user.homeId);
    res.status(204).send();
  } catch (e) {
    next(e);
  }
}

export async function apply(req, res, next) {
  try {
    const task = await templateService.applyTemplate(
      Number(req.params.id),
      req.user.homeId,
      req.body
    );
    res.status(201).json(task);
  } catch (e) {
    next(e);
  }
}
