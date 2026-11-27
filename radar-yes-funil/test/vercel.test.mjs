// Simula a função da Vercel: rewrite /api/:path* → /api/index?__p=:path* e handler sem ficheiros estáticos.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { freshDbUrl, client } from "./helpers.mjs";

process.env.DATABASE_URL = await freshDbUrl();
process.env.VERCEL = "1";
const { default: handler } = await import("../api/index.mjs");
const cfg = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url)));
// Aplica a rewrite tal como a Vercel a declara.
const rw = cfg.rewrites[0];
assert.equal(rw.source, "/api/:path*");
const srv = createServer((req, res) => {
  const u = new URL(req.url, "http://x");
  if (u.pathname.startsWith("/api/")) {
    const p = u.pathname.slice(5);
    u.searchParams.set("__p", p);
    req.url = "/api/index?" + u.searchParams.toString();
  }
  return handler(req, res);
});
await new Promise((r) => srv.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${srv.address().port}`;
after(() => srv.close());

test("rotas e query string chegam intactas através da rewrite", async () => {
  const c = client(base);
  assert.deepEqual((await c.call("/api/session")).data, { autenticado: false });
  assert.equal((await c.call("/api/leads?campanha=todas&nome=x")).status, 401);
  assert.equal((await c.call("/api/campaigns/3/step", { method: "POST", body: {} })).status, 401);
  assert.equal((await c.call("/api/nada")).status, 401);
});
test("na Vercel o cookie de sessão é Secure e a função não serve ficheiros", async () => {
  const { createDb } = await import("../server/db.mjs");
  const { hashPassword } = await import("../server/auth.mjs");
  const db = createDb(process.env.DATABASE_URL); await db.ready();
  await db.q("INSERT INTO users(username, nome, role, pass_hash, created_at) VALUES ('ana','Ana','dono',$1,$2)", [hashPassword("segredo-ana"), Date.now()]);
  await db.end();
  const r = await fetch(base + "/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: "ana", password: "segredo-ana" }) });
  assert.equal(r.status, 200);
  assert.match(r.headers.get("set-cookie"), /rfunil_sid=.*HttpOnly; SameSite=Strict; Secure/);
  assert.equal(cfg.outputDirectory, "public");
  assert.ok(cfg.functions["api/index.mjs"].maxDuration >= 60);
});
