import { AppError } from "./AppError.js";

/** Datos inválidos o reglas de negocio no cumplidas (validación). */
export class UnprocessableEntityError extends AppError {
  constructor(message = "No se pudo procesar la entidad", meta = {}) {
    super(message, 422, { code: "UNPROCESSABLE_ENTITY", ...meta });
    this.name = "UnprocessableEntityError";
  }
}
