import { AppError } from "./AppError.js";

export class NotFoundError extends AppError {
  constructor(message = "Recurso no encontrado", meta = {}) {
    super(message, 404, { code: "NOT_FOUND", ...meta });
    this.name = "NotFoundError";
  }
}
