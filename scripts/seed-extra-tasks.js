/**
 * Añade tareas de ejemplo a cada zona del hogar (sin duplicar por nombre).
 * Uso: node scripts/seed-extra-tasks.js
 */
import "../src/config/loadEnv.js";
import { pool } from "../src/config/db.js";
import * as taskModel from "../src/models/task.model.js";

/** @type {Array<{
 *   zone: string;
 *   name: string;
 *   taskType: string;
 *   difficulty?: number;
 *   durationMin?: number;
 *   frequencyIdealDays?: number;
 *   frequencyToleranceDays?: number;
 *   frequencyCriticalDays?: number;
 *   dirtReduction?: number;
 *   isMicro?: boolean;
 *   isCooperative?: boolean;
 * }>} */
const CATALOG = [
  // Cocina (ya existen "Fregar" y "Aspirar")
  { zone: "Cocina", name: "Sacar basura", taskType: "micro", durationMin: 3, frequencyIdealDays: 1, frequencyToleranceDays: 1, frequencyCriticalDays: 2, isMicro: true },
  { zone: "Cocina", name: "Vaciar lavavajillas", taskType: "micro", durationMin: 5, frequencyIdealDays: 1, frequencyToleranceDays: 1, frequencyCriticalDays: 2, isMicro: true },
  { zone: "Cocina", name: "Limpiar fregadero", taskType: "recurrent_light", durationMin: 10, frequencyIdealDays: 2, frequencyToleranceDays: 1, frequencyCriticalDays: 4 },
  { zone: "Cocina", name: "Pasar trapo encimera", taskType: "recurrent_light", durationMin: 8, frequencyIdealDays: 2, frequencyToleranceDays: 1, frequencyCriticalDays: 3 },
  { zone: "Cocina", name: "Limpiar microondas", taskType: "recurrent_light", durationMin: 10, frequencyIdealDays: 7, frequencyToleranceDays: 3, frequencyCriticalDays: 14 },
  { zone: "Cocina", name: "Limpiar nevera por fuera", taskType: "recurrent_light", durationMin: 12, frequencyIdealDays: 7, frequencyToleranceDays: 3, frequencyCriticalDays: 14 },
  { zone: "Cocina", name: "Fregar suelo cocina", taskType: "recurrent_heavy", difficulty: 3, durationMin: 25, frequencyIdealDays: 7, frequencyToleranceDays: 2, frequencyCriticalDays: 14, dirtReduction: 3, isCooperative: true },
  { zone: "Cocina", name: "Limpiar horno por dentro", taskType: "deep", difficulty: 4, durationMin: 45, frequencyIdealDays: 30, frequencyToleranceDays: 7, frequencyCriticalDays: 45, dirtReduction: 4 },

  { zone: "Dormitorio", name: "Hacer la cama", taskType: "micro", durationMin: 5, frequencyIdealDays: 1, frequencyToleranceDays: 1, frequencyCriticalDays: 2, isMicro: true },
  { zone: "Dormitorio", name: "Recoger ropa del suelo", taskType: "micro", durationMin: 5, frequencyIdealDays: 2, frequencyToleranceDays: 1, frequencyCriticalDays: 4, isMicro: true },
  { zone: "Dormitorio", name: "Ordenar mesita de noche", taskType: "micro", durationMin: 5, frequencyIdealDays: 3, frequencyToleranceDays: 2, frequencyCriticalDays: 7, isMicro: true },
  { zone: "Dormitorio", name: "Quitar polvo muebles", taskType: "recurrent_light", durationMin: 15, frequencyIdealDays: 7, frequencyToleranceDays: 3, frequencyCriticalDays: 14 },
  { zone: "Dormitorio", name: "Aspirar dormitorio", taskType: "recurrent_light", durationMin: 15, frequencyIdealDays: 5, frequencyToleranceDays: 2, frequencyCriticalDays: 10 },
  { zone: "Dormitorio", name: "Cambiar sábanas", taskType: "recurrent_heavy", difficulty: 3, durationMin: 30, frequencyIdealDays: 10, frequencyToleranceDays: 3, frequencyCriticalDays: 21, dirtReduction: 3, isCooperative: true },
  { zone: "Dormitorio", name: "Ordenar armario (superficie)", taskType: "eventual", difficulty: 3, durationMin: 40, frequencyIdealDays: 60, frequencyToleranceDays: 14, frequencyCriticalDays: 90 },

  { zone: "Comedor", name: "Limpiar mesa después de comer", taskType: "micro", durationMin: 5, frequencyIdealDays: 1, frequencyToleranceDays: 1, frequencyCriticalDays: 2, isMicro: true },
  { zone: "Comedor", name: "Recoger trapos y servicios", taskType: "micro", durationMin: 5, frequencyIdealDays: 2, frequencyToleranceDays: 1, frequencyCriticalDays: 4, isMicro: true },
  { zone: "Comedor", name: "Aspirar comedor", taskType: "recurrent_light", durationMin: 12, frequencyIdealDays: 5, frequencyToleranceDays: 2, frequencyCriticalDays: 10 },
  { zone: "Comedor", name: "Quitar polvo muebles comedor", taskType: "recurrent_light", durationMin: 12, frequencyIdealDays: 7, frequencyToleranceDays: 3, frequencyCriticalDays: 14 },
  { zone: "Comedor", name: "Fregar suelo comedor", taskType: "recurrent_heavy", difficulty: 3, durationMin: 25, frequencyIdealDays: 7, frequencyToleranceDays: 2, frequencyCriticalDays: 14, dirtReduction: 3 },

  { zone: "Despacho", name: "Ordenar escritorio (5 min)", taskType: "micro", durationMin: 5, frequencyIdealDays: 2, frequencyToleranceDays: 1, frequencyCriticalDays: 5, isMicro: true },
  { zone: "Despacho", name: "Vaciar papelera", taskType: "micro", durationMin: 3, frequencyIdealDays: 3, frequencyToleranceDays: 2, frequencyCriticalDays: 7, isMicro: true },
  { zone: "Despacho", name: "Recoger cables sueltos", taskType: "micro", durationMin: 5, frequencyIdealDays: 5, frequencyToleranceDays: 3, frequencyCriticalDays: 10, isMicro: true },
  { zone: "Despacho", name: "Aspirar despacho", taskType: "recurrent_light", durationMin: 12, frequencyIdealDays: 5, frequencyToleranceDays: 2, frequencyCriticalDays: 10 },
  { zone: "Despacho", name: "Quitar polvo estantería", taskType: "recurrent_light", durationMin: 10, frequencyIdealDays: 7, frequencyToleranceDays: 3, frequencyCriticalDays: 14 },
  { zone: "Despacho", name: "Organizar estantería", taskType: "recurrent_light", difficulty: 2, durationMin: 20, frequencyIdealDays: 14, frequencyToleranceDays: 5, frequencyCriticalDays: 21 },

  { zone: "Baño", name: "Limpiar lavabo", taskType: "micro", durationMin: 5, frequencyIdealDays: 2, frequencyToleranceDays: 1, frequencyCriticalDays: 4, isMicro: true },
  { zone: "Baño", name: "Colgar toallas limpias", taskType: "micro", durationMin: 5, frequencyIdealDays: 3, frequencyToleranceDays: 2, frequencyCriticalDays: 7, isMicro: true },
  { zone: "Baño", name: "Limpiar espejo", taskType: "micro", durationMin: 5, frequencyIdealDays: 3, frequencyToleranceDays: 2, frequencyCriticalDays: 7, isMicro: true },
  { zone: "Baño", name: "Limpiar inodoro", taskType: "recurrent_light", durationMin: 10, frequencyIdealDays: 3, frequencyToleranceDays: 1, frequencyCriticalDays: 6 },
  { zone: "Baño", name: "Limpiar ducha y cristales", taskType: "recurrent_light", durationMin: 15, frequencyIdealDays: 5, frequencyToleranceDays: 2, frequencyCriticalDays: 10 },
  { zone: "Baño", name: "Fregar suelo baño", taskType: "recurrent_heavy", difficulty: 3, durationMin: 20, frequencyIdealDays: 5, frequencyToleranceDays: 2, frequencyCriticalDays: 10, dirtReduction: 3, isCooperative: true },
  { zone: "Baño", name: "Desinfectar baño completo", taskType: "deep", difficulty: 4, durationMin: 40, frequencyIdealDays: 21, frequencyToleranceDays: 7, frequencyCriticalDays: 35, dirtReduction: 4, isCooperative: true },

  { zone: "Vestidor", name: "Doblar ropa limpia", taskType: "micro", durationMin: 10, frequencyIdealDays: 3, frequencyToleranceDays: 2, frequencyCriticalDays: 7, isMicro: true },
  { zone: "Vestidor", name: "Ordenar perchas", taskType: "micro", durationMin: 8, frequencyIdealDays: 5, frequencyToleranceDays: 3, frequencyCriticalDays: 10, isMicro: true },
  { zone: "Vestidor", name: "Aspirar vestidor", taskType: "recurrent_light", durationMin: 10, frequencyIdealDays: 7, frequencyToleranceDays: 3, frequencyCriticalDays: 14 },
  { zone: "Vestidor", name: "Sacar ropa para donar", taskType: "eventual", difficulty: 2, durationMin: 30, frequencyIdealDays: 90, frequencyToleranceDays: 30, frequencyCriticalDays: 120 },

  { zone: "Pasillo", name: "Recoger zapatos y abrigos", taskType: "micro", durationMin: 5, frequencyIdealDays: 2, frequencyToleranceDays: 1, frequencyCriticalDays: 5, isMicro: true },
  { zone: "Pasillo", name: "Sacudir alfombra pasillo", taskType: "micro", durationMin: 8, frequencyIdealDays: 7, frequencyToleranceDays: 3, frequencyCriticalDays: 14, isMicro: true },
  { zone: "Pasillo", name: "Aspirar pasillo", taskType: "recurrent_light", durationMin: 10, frequencyIdealDays: 4, frequencyToleranceDays: 2, frequencyCriticalDays: 8 },
  { zone: "Pasillo", name: "Fregar suelo pasillo", taskType: "recurrent_heavy", difficulty: 3, durationMin: 20, frequencyIdealDays: 7, frequencyToleranceDays: 2, frequencyCriticalDays: 14, dirtReduction: 3 },
];

function defaultsFor(item) {
  const isMicro = item.isMicro ?? item.taskType === "micro";
  return {
    difficulty: item.difficulty ?? (isMicro ? 1 : 2),
    durationMin: item.durationMin ?? (isMicro ? 5 : 15),
    frequencyIdealDays: item.frequencyIdealDays ?? 2,
    frequencyToleranceDays: item.frequencyToleranceDays ?? 1,
    frequencyCriticalDays: item.frequencyCriticalDays ?? 3,
    dirtReduction: item.dirtReduction ?? (isMicro ? 1 : 2),
    isMicro,
    isCooperative: item.isCooperative ?? false,
  };
}

async function main() {
  const [homes] = await pool.query("SELECT id, name FROM homes");
  if (!homes.length) {
    console.log("[seed] No hay hogares en la base de datos.");
    await pool.end();
    return;
  }

  let inserted = 0;
  let skipped = 0;

  for (const home of homes) {
    const [zones] = await pool.query(
      "SELECT id, name FROM zones WHERE home_id = ?",
      [home.id]
    );
    const zoneByName = new Map(zones.map((z) => [z.name.toLowerCase(), z]));

    const [existing] = await pool.query(
      "SELECT LOWER(TRIM(name)) AS n FROM tasks WHERE home_id = ? AND active = 1",
      [home.id]
    );
    const existingNames = new Set(existing.map((r) => r.n));

    console.log(`[seed] Hogar «${home.name}» (id ${home.id}) — ${zones.length} zonas, ${existingNames.size} tareas activas`);

    for (const item of CATALOG) {
      const zone = zoneByName.get(item.zone.toLowerCase());
      if (!zone) {
        console.warn(`[seed]   omitida «${item.name}»: no existe zona «${item.zone}»`);
        skipped++;
        continue;
      }
      const key = item.name.toLowerCase().trim();
      if (existingNames.has(key)) {
        skipped++;
        continue;
      }

      const d = defaultsFor(item);
      await taskModel.create({
        homeId: home.id,
        zoneId: zone.id,
        name: item.name,
        taskType: item.taskType,
        ...d,
      });
      existingNames.add(key);
      inserted++;
      console.log(`[seed]   + ${item.zone}: ${item.name}`);
    }
  }

  console.log(`[seed] Listo: ${inserted} tareas nuevas, ${skipped} omitidas (ya existían o zona ausente).`);
  await pool.end();
}

main().catch((err) => {
  console.error("[seed] Error:", err.message);
  process.exit(1);
});
