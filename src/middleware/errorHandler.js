import { AppError } from "../exceptions/AppError.js";

export function errorHandler(err, req, res, next) {
  console.error(err);

  const status =
    typeof err.statusCode === "number" && Number.isInteger(err.statusCode)
      ? err.statusCode
      : 500;

  const isApp = err instanceof AppError;
  const safeMessage =
    status === 500 && !isApp ? "Error interno" : err.message || "Error";

  const body = { error: safeMessage };
  if (err.code) body.code = err.code;
  if (err.details !== undefined) body.details = err.details;

  res.status(status).json(body);
}
