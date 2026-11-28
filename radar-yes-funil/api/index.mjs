// Função serverless da Vercel: todas as rotas /api/* chegam aqui (ver vercel.json).
import { createApp } from "../server/app.mjs";

const app = createApp({ serveStaticFiles: false });

export default async function handler(req, res) {
  // A rewrite passa o caminho original em ?__p=…; repõe-no para o router.
  const u = new URL(req.url, "http://x");
  const p = u.searchParams.get("__p");
  if (u.pathname === "/api/index" && p != null) {
    u.searchParams.delete("__p");
    const q = u.searchParams.toString();
    req.url = "/api/" + p.replace(/^\/+/, "") + (q ? "?" + q : "");
  }
  return app.handle(req, res);
}
