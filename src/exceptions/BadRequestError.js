import { AppError } from "./AppError.js";

export class BadRequestError extends AppError {
  constructor(message = "Solicitud incorrecta", meta = {}) {
    super(message, 400, { code: "BAD_REQUEST", ...meta });
    this.name = "BadRequestError";
  }
}
