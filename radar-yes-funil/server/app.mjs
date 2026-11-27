import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { openDb, getSettings, putSettings, tx } from "./db.mjs";
import { COOKIE, verifyPassword, createSession, sessionUser, destroySession, cookieHeader, readCookie, rateLimiter } from "./auth.mjs";
import { act, HttpError, loadLead, stats, listLeads, publicLead, publicCampaign } from "./funnel.mjs";
import { createJobs } from "./jobs.mjs";
import { firstMessage } from "./messages.mjs";
import { DISTRICTS, CATEGORIES } from "../public/assets/js/data.js";

const PUBLIC = fileURLToPath(new URL("../public/", import.meta.url));
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml",
  ".png": "image/png", ".json": "application/json", ".webmanifest": "application/manifest+json", ".ico": "image/x-icon" };
const SEC = { "X-Content-Type-Options": "nosniff", "Referrer-Policy": "strict-origin-when-cross-origin", "X-Frame-Options": "DENY",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com 'unsafe-inline'; font-src https://fonts.gstatic.com; img-src 'self' data: https://*.tile.openstreetmap.org; connect-src 'self' https://overpass-api.de https://overpass.private.coffee https://overpass.kumi.systems https://maps.mail.ru; frame-ancestors 'none'; base-uri 'self'; form-action 'self'" };

export function createApp({ dbFile = process.env.DB_FILE || "data/funil.db", secure = process.env.COOKIE_SECURE === "1", jobOptions } = {}) {
  const db = openDb(dbFile);
  const jobs = createJobs(db, jobOptions);
  const limitLogin = rateLimiter(10, 60000), limitSearch = rateLimiter(6, 60000), limitGen = rateLimiter(30, 60000);

  const send = (res, status, body, headers = {}) => {
    res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...SEC, ...headers });
    res.end(JSON.stringify(body));
  };

  async function readJson(req) {
    if (!/^application\/json\b/.test(req.headers["content-type"] || "")) throw new HttpError(415, "Content-Type tem de ser application/json.");
    let size = 0; const chunks = [];
    for await (const c of req) { size += c.length; if (size > 32_000) throw new HttpError(413, "Pedido demasiado grande."); chunks.push(c); }
    try { const v = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"); if (typeof v !== "object" || !v || Array.isArray(v)) throw 0; return v; }
    catch { throw new HttpError(400, "JSON inválido."); }
  }

  function sameOrigin(req) {
    const o = req.headers.origin;
    if (!o) return true; // pedidos sem Origin (curl, testes) não carregam cookies de outro site
    try { return new URL(o).host === req.headers.host; } catch { return false; }
  }

  async function api(req, res, url) {
    const path = url.pathname, method = req.method;
    if (method !== "GET" && !sameOrigin(req)) throw new HttpError(403, "Origem não permitida.");

    if (path === "/api/login" && method === "POST") {
      const ip = req.socket.remoteAddress || "";
      if (!limitLogin(ip)) throw new HttpError(429, "Demasiadas tentativas. Espera um minuto.");
      const b = await readJson(req);
      const u = db.prepare("SELECT * FROM users WHERE username = ?").get(String(b.username || "").trim().toLowerCase());
      if (!u || !verifyPassword(String(b.password || ""), u.pass_hash)) throw new HttpError(401, "Utilizador ou palavra-passe errados.");
      const token = createSession(db, u.id);
      return send(res, 200, { user: { id: u.id, nome: u.nome, role: u.role } }, { "Set-Cookie": cookieHeader(token, { secure }) });
    }

    const token = readCookie(req);
    const user = sessionUser(db, token);
    // Sonda de sessão para o ecrã inicial: não devolve dados, só se há sessão.
    if (path === "/api/session" && method === "GET") return send(res, 200, { autenticado: !!user });
    if (!user) throw new HttpError(401, "Sessão expirada. Entra outra vez.");

    if (path === "/api/logout" && method === "POST") { destroySession(db, token); return send(res, 200, { ok: true }, { "Set-Cookie": cookieHeader("", { secure, clear: true }) }); }
    if (path === "/api/me" && method === "GET") {
      const team = user.role === "dono" ? db.prepare("SELECT id, nome, role FROM users ORDER BY nome").all() : [];
      return send(res, 200, { user, team, settings: getSettings(db),
        regioes: DISTRICTS.map((d) => ({ id: d.id, nome: d.name, concelhos: d.concelhos })),
        nichos: CATEGORIES.map((c) => ({ id: c.id, nome: c.short })) });
    }
    if (path === "/api/settings" && method === "PUT") {
      if (user.role !== "dono") throw new HttpError(403, "Só o dono altera as definições.");
      const b = await readJson(req), patch = {};
      if (b.limite_diario != null) { const n = Number(b.limite_diario); if (!Number.isInteger(n) || n < 1 || n > 500) throw new HttpError(400, "Limite diário entre 1 e 500."); patch.limite_diario = n; }
      if (b.dias_followup != null) { const n = Number(b.dias_followup); if (!Number.isInteger(n) || n < 1 || n > 60) throw new HttpError(400, "Dias de follow-up entre 1 e 60."); patch.dias_followup = n; }
      if (b.assinatura != null) { const s = String(b.assinatura).trim(); if (s.length < 2 || s.length > 60 || /https?:|www\./i.test(s)) throw new HttpError(400, "Assinatura entre 2 e 60 caracteres, sem links."); patch.assinatura = s; }
      return send(res, 200, { settings: putSettings(db, patch) });
    }
    if (path === "/api/stats" && method === "GET") return send(res, 200, stats(db, user, Object.fromEntries(url.searchParams)));
    if (path === "/api/campaigns" && method === "GET") {
      const rows = user.role === "dono" ? db.prepare("SELECT * FROM campaigns ORDER BY id DESC LIMIT 50").all()
        : db.prepare("SELECT * FROM campaigns WHERE criada_por = ? ORDER BY id DESC LIMIT 50").all(user.id);
      return send(res, 200, { campanhas: rows.map((c) => publicCampaign(db, c)) });
    }
    if (path === "/api/campaigns" && method === "POST") {
      const b = await readJson(req);
      const key = String(b.request_key || "");
      if (!/^[A-Za-z0-9_-]{8,64}$/.test(key)) throw new HttpError(400, "request_key inválido.");
      const err = jobs.validate(b); if (err) throw new HttpError(400, err);
      const result = tx(db, () => {
        const same = db.prepare("SELECT * FROM campaigns WHERE request_key = ?").get(user.id + ":" + key);
        if (same) return { c: same, existed: true };
        const run = db.prepare("SELECT * FROM campaigns WHERE criada_por = ? AND estado = 'a_correr'").get(user.id);
        if (run) return { c: run, existed: true };
        return null;
      });
      if (result) return send(res, 200, { campanha: publicCampaign(db, result.c), existente: true });
      if (!limitSearch(user.id)) throw new HttpError(429, "Demasiadas pesquisas seguidas. Espera um minuto.");
      const now = Date.now();
      const r = db.prepare("INSERT INTO campaigns(criada_por, nicho, regiao, concelho, pais, estado, request_key, created_at, updated_at) VALUES (?,?,?,?, 'PT', 'a_correr', ?, ?, ?)")
        .run(user.id, String(b.nicho), String(b.regiao), String(b.concelho || ""), user.id + ":" + key, now, now);
      const c = db.prepare("SELECT * FROM campaigns WHERE id = ?").get(Number(r.lastInsertRowid));
      jobs.start(c);
      return send(res, 201, { campanha: publicCampaign(db, c), existente: false });
    }
    let m;
    if ((m = path.match(/^\/api\/campaigns\/(\d+)\/cancel$/)) && method === "POST") {
      const c = db.prepare("SELECT * FROM campaigns WHERE id = ?").get(Number(m[1]));
      if (!c) throw new HttpError(404, "Campanha não encontrada.");
      if (user.role !== "dono" && c.criada_por !== user.id) throw new HttpError(403, "Campanha de outra pessoa.");
      jobs.cancel(c.id);
      return send(res, 200, { campanha: publicCampaign(db, db.prepare("SELECT * FROM campaigns WHERE id = ?").get(c.id)) });
    }
    if (path === "/api/leads" && method === "GET") return send(res, 200, listLeads(db, user, Object.fromEntries(url.searchParams)));
    if ((m = path.match(/^\/api\/leads\/(\d+)$/)) && method === "GET") return send(res, 200, { lead: publicLead(db, loadLead(db, user, Number(m[1]))) });
    if ((m = path.match(/^\/api\/leads\/(\d+)\/(regenerate|retry)$/)) && method === "POST") {
      if (!limitGen(user.id)) throw new HttpError(429, "Demasiadas gerações seguidas. Espera um minuto.");
      const id = Number(m[1]);
      const lead = loadLead(db, user, id);
      if (!["encontrada", "escrita"].includes(lead.etapa)) throw new HttpError(409, "A mensagem já foi enviada.");
      if (lead.excluida || lead.invalido) throw new HttpError(409, "Lead excluído ou com número inválido.");
      if (m[2] === "retry") {
        db.prepare("UPDATE leads SET falha_escrita = NULL, updated_at = ? WHERE id = ?").run(Date.now(), id);
        jobs.enqueue(id);
      } else {
        const author = db.prepare("SELECT nome FROM users WHERE id = ?").get(lead.atribuida_a);
        const variante = lead.variante + 1;
        const msg = firstMessage(lead, { remetente: author?.nome || "", assinatura: getSettings(db).assinatura }, variante);
        db.prepare("UPDATE leads SET mensagem = ?, mensagem_origem = 'template', variante = ?, etapa = 'escrita', falha_escrita = NULL, updated_at = ? WHERE id = ?")
          .run(msg, variante, Date.now(), id);
      }
      return send(res, 200, { lead: publicLead(db, db.prepare("SELECT * FROM leads WHERE id = ?").get(id)) });
    }
    if ((m = path.match(/^\/api\/leads\/(\d+)\/(edit|send|respond|followup|exclude|invalid|undo|assign)$/)) && method === "POST") {
      const b = await readJson(req);
      const lead = act(db, user, Number(m[1]), m[2], b);
      if (lead.etapa === "encontrada" && !lead.falha_escrita && !lead.excluida && !lead.invalido) jobs.enqueue(lead.id);
      return send(res, 200, { lead: publicLead(db, lead) });
    }
    throw new HttpError(404, "Rota inexistente.");
  }

  async function serveStatic(req, res, url) {
    let p = decodeURIComponent(url.pathname);
    if (p === "/") p = "/index.html";
    const file = normalize(join(PUBLIC, p));
    if (!file.startsWith(PUBLIC.endsWith(sep) ? PUBLIC : PUBLIC + sep)) { res.writeHead(403); return res.end(); }
    try {
      const st = await stat(file);
      if (!st.isFile()) throw 0;
      const body = await readFile(file);
      const cache = p.includes("/vendor/") ? "public, max-age=31536000, immutable" : "no-cache";
      res.writeHead(200, { "Content-Type": TYPES[extname(file)] || "application/octet-stream", "Cache-Control": cache, ...SEC });
      res.end(req.method === "HEAD" ? undefined : body);
    } catch { res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8", ...SEC }); res.end("Não encontrado"); }
  }

  const server = createServer(async (req, res) => {
    const url = new URL(req.url, "http://x");
    try {
      if (url.pathname.startsWith("/api/")) await api(req, res, url);
      else if (req.method === "GET" || req.method === "HEAD") await serveStatic(req, res, url);
      else { res.writeHead(405); res.end(); }
    } catch (err) {
      const status = err instanceof HttpError ? err.status : 500;
      if (status === 500) console.error(err);
      if (!res.headersSent) send(res, status, { error: status === 500 ? "Erro interno." : err.message });
    }
  });
  return { server, db, jobs };
}
export { COOKIE };
