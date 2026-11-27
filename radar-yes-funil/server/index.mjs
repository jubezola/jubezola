// Servidor local (desenvolvimento). Em produção, a Vercel usa api/index.mjs + ficheiros estáticos de public/.
import { createServer } from "node:http";
import { createApp } from "./app.mjs";
const port = Number(process.env.PORT || 4317);
const { handle, db } = createApp();
await db.ready();
createServer(handle).listen(port, "127.0.0.1", () => console.log(`radar-yes-funil em http://localhost:${port}`));
