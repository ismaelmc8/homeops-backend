/**
 * Envuelve un handler async (req, res, next) => Promise para delegar errores a next().
 */
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
