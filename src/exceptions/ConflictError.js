import { AppError } from "./AppError.js";

export class ConflictError extends AppError {
  constructor(message = "Conflicto con el estado actual", meta = {}) {
    super(message, 409, { code: "CONFLICT", ...meta });
    this.name = "ConflictError";
  }
}
