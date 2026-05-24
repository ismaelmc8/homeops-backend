import "./config/loadEnv.js";
import { createApp } from "./app.js";
import { getPort } from "./config/env.js";
import { verifyDbConnection } from "./config/db.js";

const app = createApp();
const PORT = getPort();

app.listen(PORT, async () => {
  console.log(`API en http://localhost:${PORT}`);
  await verifyDbConnection();
});
