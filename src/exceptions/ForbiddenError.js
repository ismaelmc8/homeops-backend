import { AppError } from "./AppError.js";

export class ForbiddenError extends AppError {
  constructor(message = "Acceso denegado", meta = {}) {
    super(message, 403, { code: "FORBIDDEN", ...meta });
    this.name = "ForbiddenError";
  }
}
