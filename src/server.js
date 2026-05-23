import "dotenv/config";
import { createApp } from "./app.js";
import { getPort } from "./config/env.js";

const app = createApp();
const PORT = getPort();

app.listen(PORT, () => {
  console.log(`API en http://localhost:${PORT}`);
});
