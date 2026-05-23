export function getPort() {
  return Number(process.env.PORT) || 4000;
}

export function getCorsOrigin() {
  return process.env.CORS_ORIGIN || "http://localhost:5173";
}

export function getDbConfig() {
  return {
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD ?? "passwd123",
    database: process.env.DB_NAME || "homeops",
  };
}
