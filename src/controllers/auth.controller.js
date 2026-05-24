import * as authService from "../services/auth.service.js";

export async function register(req, res, next) {
  try {
    const result = await authService.register(req.body);
    res.status(201).json(result);
  } catch (e) {
    next(e);
  }
}

export async function validateToken(req, res, next) {
  try {
    const result = await authService.validateActivationToken(req.query.token);
    res.json(result);
  } catch (e) {
    next(e);
  }
}

export async function setPassword(req, res, next) {
  try {
    const result = await authService.setPassword(req.body);
    res.json(result);
  } catch (e) {
    next(e);
  }
}

export async function login(req, res, next) {
  try {
    const result = await authService.login(req.body);
    res.json(result);
  } catch (e) {
    next(e);
  }
}

export async function logout(req, res) {
  res.json({ message: "Sesión cerrada." });
}

export async function me(req, res, next) {
  try {
    const result = await authService.getMe(req.user.id);
    res.json(result);
  } catch (e) {
    next(e);
  }
}

export async function forgotPassword(req, res, next) {
  try {
    const result = await authService.forgotPassword(req.body);
    res.json(result);
  } catch (e) {
    next(e);
  }
}

export async function registrationAvailable(req, res, next) {
  try {
    const homeModel = await import("../models/home.model.js");
    const count = await homeModel.countHomes();
    res.json({ available: count === 0 });
  } catch (e) {
    next(e);
  }
}
