import mysql from "mysql2/promise";
import { getDbConfig } from "./env.js";

const cfg = getDbConfig();

export const pool = mysql.createPool({
  host: cfg.host,
  port: cfg.port,
  user: cfg.user,
  password: cfg.password,
  database: cfg.database,
  waitForConnections: true,
  connectionLimit: 10,
});
