import { createServer } from "node:http";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** Elementos OSM sintéticos: mistura de móveis, fixos, só redes, fechados e inválidos. */
export function fixture(n = 60, seed = 0) {
  const els = [];
  for (let i = 0; i < n; i++) {
    const id = seed * 100000 + i + 1;
    const kind = i % 6;
    const tags = { name: `Negócio Teste ${seed}-${i}`, amenity: i % 2 ? "cafe" : "restaurant", "addr:city": "Lisboa" };
    if (kind === 0 || kind === 3) tags.phone = `+351 91${String(id).padStart(7, "0")}`;
    if (kind === 1) tags.phone = `21${String(id).padStart(7, "0")}`;
    if (kind === 2) { tags["contact:mobile"] = `96${String(id).padStart(7, "0")}`; tags.website = "https://instagram.com/negocio" + i; }
    if (kind === 4) tags.phone = "800 123 456"; // número inválido para o funil
    if (kind === 5) { tags.phone = `+351 93${String(id).padStart(7, "0")}`; if (i % 12 === 5) tags.opening_hours = "closed"; }
    els.push({ type: "node", id, lat: 38.7 + i / 1000, lon: -9.1 - i / 1000, tags });
  }
  return els;
}

export function mockOverpass({ elements = fixture(), delayMs = 0 } = {}) {
  let calls = 0;
  const state = { elements, delayMs };
  const server = createServer(async (req, res) => {
    calls++;
    for await (const _ of req) { /* consome o corpo */ }
    await new Promise((r) => setTimeout(r, state.delayMs));
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ elements: [{ type: "area", id: 1 }, ...state.elements] }));
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve({ url: `http://127.0.0.1:${server.address().port}/api/interpreter`, server, state, calls: () => calls })));
}

export const tmpDb = () => join(mkdtempSync(join(tmpdir(), "funil-")), "t.db");

export function client(base) {
  let cookie = "";
  const call = async (path, { method = "GET", body, headers = {} } = {}) => {
    const res = await fetch(base + path, { method, headers: { ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...(cookie ? { cookie } : {}), ...headers }, body: body !== undefined ? JSON.stringify(body) : undefined });
    const sc = res.headers.get("set-cookie"); if (sc) cookie = sc.split(";")[0];
    let data = null; try { data = await res.json(); } catch { /* */ }
    return { status: res.status, data };
  };
  return { call, login: (username, password) => call("/api/login", { method: "POST", body: { username, password } }) };
}

export async function until(fn, timeout = 8000) {
  const t0 = Date.now();
  for (;;) { const v = await fn(); if (v) return v; if (Date.now() - t0 > timeout) throw new Error("timeout à espera da condição"); await new Promise((r) => setTimeout(r, 50)); }
}
