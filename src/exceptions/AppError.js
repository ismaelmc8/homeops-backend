/**
 * Error de aplicación con código HTTP y metadatos opcionales.
 * Las subclases representan respuestas HTTP habituales en la API.
 */
export class AppError extends Error {
  /**
   * @param {string} message
   * @param {number} [statusCode=500]
   * @param {{ code?: string, details?: unknown }} [meta]
   */
  constructor(message, statusCode = 500, meta = {}) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = meta.code ?? undefined;
    this.details = meta.details ?? undefined;
    /** true = error esperado (validación, no encontrado, etc.) */
    this.isOperational = true;
    Error.captureStackTrace?.(this, this.constructor);
  }
}
