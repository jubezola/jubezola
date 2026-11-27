import { createApp } from "./app.mjs";
const port = Number(process.env.PORT || 4317);
const { server } = createApp();
server.listen(port, "127.0.0.1", () => console.log(`radar-yes-funil em http://localhost:${port}`));
