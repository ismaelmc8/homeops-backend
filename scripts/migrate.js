import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { pool } from "../src/config/db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sqlDir = path.join(__dirname, "..", "sql");

const files = fs
  .readdirSync(sqlDir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

for (const file of files) {
  const sql = fs.readFileSync(path.join(sqlDir, file), "utf8");
  const statements = sql
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s && !s.startsWith("--"));
  console.log(`Applying ${file}…`);
  for (const stmt of statements) {
    if (stmt.toUpperCase().startsWith("USE ")) continue;
    await pool.query(stmt);
  }
}

console.log("Migrations OK.");
await pool.end();
process.exit(0);
