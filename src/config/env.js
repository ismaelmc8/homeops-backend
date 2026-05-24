export function getPort() {
  return Number(process.env.PORT) || 4000;
}

export function getCorsOrigin() {
  return process.env.CORS_ORIGIN || "http://localhost:5173";
}

function parseDatabaseUrl(url) {
  const parsed = new URL(url);
  return {
    host: parsed.hostname || "127.0.0.1",
    port: Number(parsed.port || 3306),
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database: parsed.pathname.replace(/^\//, "") || "homeops",
  };
}

export function getDbConfigSource() {
  return process.env.DATABASE_URL?.trim() ? "DATABASE_URL" : "DB_HOST, DB_USER, DB_PASSWORD, DB_NAME";
}

export function getDbConfig() {
  const url = process.env.DATABASE_URL?.trim();
  if (url) return parseDatabaseUrl(url);

  return {
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD ?? "",
    database: process.env.DB_NAME || "homeops",
  };
}

function maskPassword(password) {
  if (!password) return "(vacío)";
  if (password.length <= 2) return "***";
  return `${password[0]}${"*".repeat(Math.min(password.length - 1, 8))} (${password.length} caracteres)`;
}

/** Texto para consola al conectar (sin contraseña en claro). */
export function formatDbConfigLog(cfg) {
  const source = getDbConfigSource();
  return [
    "[db] Configuración de conexión MySQL",
    `     origen:   ${source}`,
    `     host:     ${cfg.host}`,
    `     port:     ${cfg.port}`,
    `     user:     ${cfg.user}`,
    `     password: ${maskPassword(cfg.password)}`,
    `     database: ${cfg.database}`,
    `     url:      mysql://${cfg.user}:***@${cfg.host}:${cfg.port}/${cfg.database}`,
  ].join("\n");
}

export function getJwtSecret() {
  return process.env.JWT_SECRET || "dev-secret-change-in-production";
}

export function getJwtExpiresIn() {
  return process.env.JWT_EXPIRES_IN || "7d";
}

export function getFrontendUrl() {
  return (process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/+$/, "");
}

export function getActivationTokenHours() {
  return Number(process.env.ACTIVATION_TOKEN_HOURS || 48);
}

function parseEnvBool(value, defaultValue) {
  if (value === undefined || value === "") return defaultValue;
  return value === "true" || value === "1";
}

export function getSmtpConfig() {
  const pass = process.env.SMTP_PASS || "";
  const isProd = process.env.NODE_ENV === "production";
  return {
    host: process.env.SMTP_HOST || "",
    port: Number(process.env.SMTP_PORT || 587),
    user: process.env.SMTP_USER || "",
    pass: pass.replace(/\s+/g, ""),
    from: process.env.SMTP_FROM || process.env.SMTP_USER || "noreply@homeops.local",
    // false en dev: antivirus/proxy con cert autofirmado (error ESOCKET)
    tlsRejectUnauthorized: parseEnvBool(process.env.SMTP_TLS_REJECT_UNAUTHORIZED, isProd),
  };
}
