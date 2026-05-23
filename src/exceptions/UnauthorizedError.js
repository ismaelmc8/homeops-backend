import { AppError } from "./AppError.js";

export class UnauthorizedError extends AppError {
  constructor(message = "No autorizado", meta = {}) {
    super(message, 401, { code: "UNAUTHORIZED", ...meta });
    this.name = "UnauthorizedError";
  }
}
