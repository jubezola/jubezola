// Handler HTTP único: usado pelo servidor local (server/index.mjs) e pela função da Vercel (api/index.mjs).
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { createDb, getSettings, putSettings, allow } from "./db.mjs";
import { verifyPassword, createSession, sessionUser, destroySession, cookieHeader, readCookie } from "./auth.mjs";
import { act, HttpError, loadLead, stats, listLeads, publicLead, publicCampaign, userNames } from "./funnel.mjs";
import { createJobs } from "./jobs.mjs";
import { firstMessage } from "./messages.mjs";
import { DISTRICTS, CATEGORIES } from "../public/assets/js/data.js";

const PUBLIC = fileURLToPath(new URL("../public/", import.meta.url));
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml",
  ".png": "image/png", ".json": "application/json", ".webmanifest": "application/manifest+json", ".ico": "image/x-icon" };
export const SECURITY_HEADERS = { "X-Content-Type-Options": "nosniff", "Referrer-Policy": "strict-origin-when-cross-origin", "X-Frame-Options": "DENY",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com 'unsafe-inline'; font-src https://fonts.gstatic.com; img-src 'self' data: https://*.tile.openstreetmap.org; connect-src 'self' https://overpass-api.de https://overpass.private.coffee https://overpass.kumi.systems https://maps.mail.ru; frame-ancestors 'none'; base-uri 'self'; form-action 'self'" };

export function createApp({ db = createDb(), secure = process.env.COOKIE_SECURE === "1" || !!process.env.VERCEL, jobOptions, serveStaticFiles = true } = {}) {
  const jobs = createJobs(db, jobOptions);

  const send = (res, status, body, headers = {}) => {
    res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...SECURITY_HEADERS, ...headers });
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
    if (!o) return true; // sem Origin não há cookies de outro site (SameSite=Strict)
    const host = req.headers["x-forwarded-host"] || req.headers.host;
    try { return new URL(o).host === host; } catch { return false; }
  }
  const clientIp = (req) => String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "").split(",")[0].trim();

  async function campaignFor(user, id) {
    const c = await db.one("SELECT * FROM campaigns WHERE id = $1", [id]);
    if (!c) throw new HttpError(404, "Campanha não encontrada.");
    if (user.role !== "dono" && c.criada_por !== user.id) throw new HttpError(403, "Campanha de outra pessoa.");
    return c;
  }
  const leadOut = async (lead) => publicLead(lead, await getSettings(db), await userNames(db));

  async function api(req, res, url) {
    await db.ready();
    const path = url.pathname, method = req.method;
    if (method !== "GET" && !sameOrigin(req)) throw new HttpError(403, "Origem não permitida.");

    if (path === "/api/login" && method === "POST") {
      if (!(await allow(db, "login:" + clientIp(req), 10, 60000))) throw new HttpError(429, "Demasiadas tentativas. Espera um minuto.");
      const b = await readJson(req);
      const u = await db.one("SELECT * FROM users WHERE username = $1", [String(b.username || "").trim().toLowerCase()]);
      if (!u || !verifyPassword(String(b.password || ""), u.pass_hash)) throw new HttpError(401, "Utilizador ou palavra-passe errados.");
      const token = await createSession(db, u.id);
      return send(res, 200, { user: { id: u.id, nome: u.nome, role: u.role } }, { "Set-Cookie": cookieHeader(token, { secure }) });
    }

    const token = readCookie(req);
    const user = await sessionUser(db, token);
    // Sonda de sessão para o ecrã inicial: não devolve dados, só se há sessão.
    if (path === "/api/session" && method === "GET") return send(res, 200, { autenticado: !!user });
    if (!user) throw new HttpError(401, "Sessão expirada. Entra outra vez.");

    if (path === "/api/logout" && method === "POST") { await destroySession(db, token); return send(res, 200, { ok: true }, { "Set-Cookie": cookieHeader("", { secure, clear: true }) }); }
    if (path === "/api/me" && method === "GET") {
      const team = user.role === "dono" ? await db.all("SELECT id, nome, role FROM users ORDER BY nome") : [];
      return send(res, 200, { user, team, settings: await getSettings(db),
        regioes: DISTRICTS.map((d) => ({ id: d.id, nome: d.name, concelhos: d.concelhos })),
        nichos: CATEGORIES.map((c) => ({ id: c.id, nome: c.short })) });
    }
    if (path === "/api/settings" && method === "PUT") {
      if (user.role !== "dono") throw new HttpError(403, "Só o dono altera as definições.");
      const b = await readJson(req), patch = {};
      if (b.limite_diario != null) { const n = Number(b.limite_diario); if (!Number.isInteger(n) || n < 1 || n > 500) throw new HttpError(400, "Limite diário entre 1 e 500."); patch.limite_diario = n; }
      if (b.dias_followup != null) { const n = Number(b.dias_followup); if (!Number.isInteger(n) || n < 1 || n > 60) throw new HttpError(400, "Dias de follow-up entre 1 e 60."); patch.dias_followup = n; }
      if (b.assinatura != null) { const s = String(b.assinatura).trim(); if (s.length < 2 || s.length > 60 || /https?:|www\./i.test(s)) throw new HttpError(400, "Assinatura entre 2 e 60 caracteres, sem links."); patch.assinatura = s; }
      return send(res, 200, { settings: await putSettings(db, patch) });
    }
    if (path === "/api/stats" && method === "GET") return send(res, 200, await stats(db, user, Object.fromEntries(url.searchParams)));
    if (path === "/api/campaigns" && method === "GET") {
      const rows = user.role === "dono" ? await db.all("SELECT * FROM campaigns ORDER BY id DESC LIMIT 50")
        : await db.all("SELECT * FROM campaigns WHERE criada_por = $1 ORDER BY id DESC LIMIT 50", [user.id]);
      return send(res, 200, { campanhas: await Promise.all(rows.map((c) => publicCampaign(db, c))) });
    }
    if (path === "/api/campaigns" && method === "POST") {
      const b = await readJson(req);
      const key = String(b.request_key || "");
      if (!/^[A-Za-z0-9_-]{8,64}$/.test(key)) throw new HttpError(400, "request_key inválido.");
      const err = jobs.validate(b); if (err) throw new HttpError(400, err);
      const rk = user.id + ":" + key;
      const existing = async () => (await db.one("SELECT * FROM campaigns WHERE request_key = $1", [rk]))
        || (await db.one("SELECT * FROM campaigns WHERE criada_por = $1 AND estado = 'a_correr'", [user.id]));
      let c = await existing();
      if (c) return send(res, 200, { campanha: await publicCampaign(db, c), existente: true });
      if (!(await allow(db, "search:" + user.id, 6, 60000))) throw new HttpError(429, "Demasiadas pesquisas seguidas. Espera um minuto.");
      const now = Date.now();
      // Os índices únicos (request_key e "uma a correr por pessoa") tornam o START idempotente mesmo em pedidos simultâneos.
      c = await db.one(`INSERT INTO campaigns(criada_por, nicho, regiao, concelho, pais, estado, request_key, created_at, updated_at)
        VALUES ($1,$2,$3,$4,'PT','a_correr',$5,$6,$6) ON CONFLICT DO NOTHING RETURNING *`, [user.id, String(b.nicho), String(b.regiao), String(b.concelho || ""), rk, now]);
      if (!c) { c = await existing(); return send(res, 200, { campanha: await publicCampaign(db, c), existente: true }); }
      return send(res, 201, { campanha: await publicCampaign(db, c), existente: false });
    }
    let m;
    if ((m = path.match(/^\/api\/campaigns\/(\d+)\/(cancel|step)$/)) && method === "POST") {
      const c = await campaignFor(user, Number(m[1]));
      if (m[2] === "cancel") await jobs.cancel(c.id);
      else await jobs.searchStep(c.id);
      return send(res, 200, { campanha: await publicCampaign(db, await db.one("SELECT * FROM campaigns WHERE id = $1", [c.id])) });
    }
    if (path === "/api/write" && method === "POST") return send(res, 200, { escritas: await jobs.writeStep(user) });
    if (path === "/api/leads" && method === "GET") return send(res, 200, await listLeads(db, user, Object.fromEntries(url.searchParams)));
    if ((m = path.match(/^\/api\/leads\/(\d+)$/)) && method === "GET") return send(res, 200, { lead: await leadOut(await loadLead(db, user, Number(m[1]))) });
    if ((m = path.match(/^\/api\/leads\/(\d+)\/(regenerate|retry)$/)) && method === "POST") {
      const id = Number(m[1]);
      const lead = await loadLead(db, user, id);
      if (!(await allow(db, "gen:" + user.id, 30, 60000))) throw new HttpError(429, "Demasiadas gerações seguidas. Espera um minuto.");
      if (!["encontrada", "escrita"].includes(lead.etapa)) throw new HttpError(409, "A mensagem já foi enviada.");
      if (lead.excluida || lead.invalido) throw new HttpError(409, "Lead excluído ou com número inválido.");
      if (m[2] === "retry") {
        await db.q("UPDATE leads SET falha_escrita = NULL, escrita_lock = NULL, updated_at = $2 WHERE id = $1", [id, Date.now()]);
      } else {
        const names = await userNames(db);
        const variante = lead.variante + 1;
        const msg = firstMessage(lead, { remetente: names[lead.atribuida_a] || "", assinatura: (await getSettings(db)).assinatura }, variante);
        await db.q("UPDATE leads SET mensagem = $1, mensagem_origem = 'template', variante = $2, etapa = 'escrita', falha_escrita = NULL, updated_at = $3 WHERE id = $4 AND etapa IN ('encontrada','escrita')",
          [msg, variante, Date.now(), id]);
      }
      return send(res, 200, { lead: await leadOut(await db.one("SELECT * FROM leads WHERE id = $1", [id])) });
    }
    if ((m = path.match(/^\/api\/leads\/(\d+)\/(edit|send|respond|followup|exclude|invalid|undo|assign)$/)) && method === "POST") {
      const b = await readJson(req);
      return send(res, 200, { lead: await leadOut(await act(db, user, Number(m[1]), m[2], b)) });
    }
    throw new HttpError(404, "Rota inexistente.");
  }

  async function serveStatic(req, res, url) {
    let p;
    try { p = decodeURIComponent(url.pathname); } catch { res.writeHead(400); return res.end(); }
    if (p === "/") p = "/index.html";
    const file = normalize(join(PUBLIC, p));
    if (!file.startsWith(PUBLIC.endsWith(sep) ? PUBLIC : PUBLIC + sep)) { res.writeHead(403); return res.end(); }
    try {
      const st = await stat(file);
      if (!st.isFile()) throw 0;
      const body = await readFile(file);
      const cache = p.includes("/vendor/") ? "public, max-age=31536000, immutable" : "no-cache";
      res.writeHead(200, { "Content-Type": TYPES[extname(file)] || "application/octet-stream", "Cache-Control": cache, ...SECURITY_HEADERS });
      res.end(req.method === "HEAD" ? undefined : body);
    } catch { res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8", ...SECURITY_HEADERS }); res.end("Não encontrado"); }
  }

  async function handle(req, res) {
    const url = new URL(req.url, "http://x");
    try {
      if (url.pathname.startsWith("/api/")) await api(req, res, url);
      else if (serveStaticFiles && (req.method === "GET" || req.method === "HEAD")) await serveStatic(req, res, url);
      else { res.writeHead(404); res.end(); }
    } catch (err) {
      const status = err instanceof HttpError ? err.status : 500;
      if (status === 500) console.error(err);
      if (!res.headersSent) send(res, status, { error: status === 500 ? "Erro interno." : err.message });
    }
  }
  return { handle, db, jobs };
}
