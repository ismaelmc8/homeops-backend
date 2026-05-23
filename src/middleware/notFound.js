import { NotFoundError } from "../exceptions/NotFoundError.js";

export function notFoundHandler(req, res, next) {
  next(new NotFoundError("Ruta no encontrada"));
}
