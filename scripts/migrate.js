import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import "../src/config/loadEnv.js";
import { pool } from "../src/config/db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sqlDir = path.join(__dirname, "..", "sql");

/** Versión declarada en INSERT INTO meta_schema_version … */
function versionFromSql(sql) {
  const m = sql.match(
    /INSERT\s+INTO\s+meta_schema_version\s*\([^)]+\)\s*VALUES\s*\(\s*'([^']+)'\s*\)/i
  );
  return m ? m[1] : null;
}

/** Prefijo corto legacy: 003_e2_gamification.sql → 003_e2 */
function legacyVersionId(filename) {
  const base = filename.replace(/\.sql$/i, "");
  const m = base.match(/^(\d+_[a-z0-9]+)/i);
  return m ? m[1] : null;
}

function migrationIds(filename, sql) {
  const ids = new Set();
  const fromInsert = versionFromSql(sql);
  if (fromInsert) ids.add(fromInsert);
  ids.add(filename.replace(/\.sql$/i, ""));
  const leg = legacyVersionId(filename);
  if (leg) ids.add(leg);
  return [...ids];
}

async function ensureMetaTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS meta_schema_version (
      id INT PRIMARY KEY AUTO_INCREMENT,
      version VARCHAR(64) NOT NULL,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_schema_version (version)
    )
  `);
}

async function isApplied(versionIds) {
  if (!versionIds.length) return false;
  const placeholders = versionIds.map(() => "?").join(", ");
  const [rows] = await pool.query(
    `SELECT version FROM meta_schema_version WHERE version IN (${placeholders}) LIMIT 1`,
    versionIds
  );
  return rows.length > 0;
}

async function recordVersion(versionId) {
  await pool.query(
    `INSERT IGNORE INTO meta_schema_version (version) VALUES (?)`,
    [versionId]
  );
}

/** Errores habituales cuando el esquema ya está parcialmente aplicado */
function isSkippableSchemaError(err) {
  return ["ER_DUP_FIELDNAME", "ER_DUP_KEYNAME", "ER_TABLE_EXISTS_ERROR"].includes(
    err.code
  );
}

const files = fs
  .readdirSync(sqlDir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

await ensureMetaTable();

for (const file of files) {
  const sql = fs.readFileSync(path.join(sqlDir, file), "utf8");
  const ids = migrationIds(file, sql);
  const canonicalVersion = versionFromSql(sql) ?? ids[0];

  if (await isApplied(ids)) {
    console.log(`Skip ${file} (ya aplicada: ${ids.join(" / ")})`);
    continue;
  }

  const statements = sql
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s && !s.startsWith("--"));

  console.log(`Applying ${file}…`);
  let hadError = false;

  for (const stmt of statements) {
    if (stmt.toUpperCase().startsWith("USE ")) continue;
    if (/INSERT\s+INTO\s+meta_schema_version/i.test(stmt)) continue;

    try {
      await pool.query(stmt);
    } catch (e) {
      if (isSkippableSchemaError(e)) {
        console.warn(`  Aviso (${file}): ${e.message}`);
      } else {
        hadError = true;
        throw e;
      }
    }
  }

  if (!hadError) {
    await recordVersion(canonicalVersion);
    console.log(`  Registrada versión: ${canonicalVersion}`);
  }
}

console.log("Migrations OK.");
await pool.end();
process.exit(0);
