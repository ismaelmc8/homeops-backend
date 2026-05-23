import { AppError } from "./AppError.js";

export class TooManyRequestsError extends AppError {
  constructor(message = "Demasiadas peticiones", meta = {}) {
    super(message, 429, { code: "TOO_MANY_REQUESTS", ...meta });
    this.name = "TooManyRequestsError";
  }
}
