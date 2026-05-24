import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, "..", "..", ".env");

const { error } = dotenv.config({ path: envPath });

if (error && process.env.NODE_ENV !== "test") {
  console.warn(`[env] No se encontró ${envPath}:`, error.message);
}
