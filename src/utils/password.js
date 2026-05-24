const MIN_LENGTH = 8;

export function validatePasswordPair(password, passwordConfirm) {
  if (!password || password.length < MIN_LENGTH) {
    return `La contraseña debe tener al menos ${MIN_LENGTH} caracteres.`;
  }
  if (password !== passwordConfirm) {
    return "Las contraseñas no coinciden.";
  }
  return null;
}
