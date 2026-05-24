import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import "../src/config/loadEnv.js";
import { pool } from "../src/config/db.js";

const file = process.argv[2];
if (!file) {
  console.error("Uso: node scripts/migrate-one.js 007_e7_visualization.sql");
  process.exit(1);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sql = fs.readFileSync(path.join(__dirname, "..", "sql", file), "utf8");
const statements = sql
  .split(";")
  .map((s) => s.trim())
  .filter((s) => s && !s.startsWith("--"));

for (const stmt of statements) {
  if (stmt.toUpperCase().startsWith("USE ")) continue;
  try {
    await pool.query(stmt);
    console.log("OK:", stmt.slice(0, 60).replace(/\s+/g, " ") + "…");
  } catch (e) {
    if (e.code === "ER_DUP_FIELDNAME") {
      console.warn("Skip (ya existe):", e.message);
    } else {
      throw e;
    }
  }
}
console.log("Done.");
await pool.end();
