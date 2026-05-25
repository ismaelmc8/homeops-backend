import jwt from "jsonwebtoken";
import { getJwtSecret } from "../config/env.js";
import { UnauthorizedError } from "../exceptions/UnauthorizedError.js";
import { ForbiddenError } from "../exceptions/ForbiddenError.js";
import * as userModel from "../models/user.model.js";

export async function authMiddleware(req, res, next) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      throw new UnauthorizedError("Token requerido.");
    }
    const token = header.slice(7);
    const payload = jwt.verify(token, getJwtSecret());
    const user = await userModel.findById(payload.sub);
    if (!user || user.status !== "active") {
      throw new UnauthorizedError("Sesión inválida.");
    }
    if ((payload.tv ?? 0) !== (user.token_version ?? 0)) {
      throw new UnauthorizedError("Sesión revocada. Inicia sesión de nuevo.");
    }
    req.user = {
      id: user.id,
      homeId: user.home_id,
      role: user.role,
      email: user.email,
      name: user.name,
    };
    next();
  } catch (e) {
    if (e.name === "JsonWebTokenError" || e.name === "TokenExpiredError") {
      return next(new UnauthorizedError("Token inválido o expirado."));
    }
    next(e);
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new ForbiddenError("Acceso denegado."));
    }
    next();
  };
}
