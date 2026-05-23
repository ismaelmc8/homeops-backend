import { AppError } from "./AppError.js";

export class ServiceUnavailableError extends AppError {
  constructor(message = "Servicio no disponible", meta = {}) {
    super(message, 503, { code: "SERVICE_UNAVAILABLE", ...meta });
    this.name = "ServiceUnavailableError";
  }
}
