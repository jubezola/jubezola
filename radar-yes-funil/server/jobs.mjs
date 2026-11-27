// Pesquisa (Encontradas) e escrita em pipeline (Escritas), no servidor.
// Reutiliza os módulos do LeadRadar: consulta Overpass, conversão em lead, deteção de "só redes" e franquias.
import { CONFIG } from "../public/assets/js/config.js";
import { fetchLeads } from "../public/assets/js/overpass.js";
import { toLead, dedupeLeads, mapsLink } from "../public/assets/js/leads.js";
import { DISTRICT_BY_ID, CATEGORY_BY_ID } from "../public/assets/js/data.js";
import { classifyPhone } from "./phone.mjs";
import { firstMessage } from "./messages.mjs";
import { isExcluded } from "./funnel.mjs";
import { getSettings } from "./db.mjs";

if (process.env.OVERPASS_URL) CONFIG.overpassEndpoints = [process.env.OVERPASS_URL];

const sleep = (ms, signal) => new Promise((res, rej) => {
  const t = setTimeout(res, ms);
  signal?.addEventListener("abort", () => { clearTimeout(t); rej(signal.reason); }, { once: true });
});

/** Negócios fechados (temporária ou permanentemente), quando o OSM o indica. */
export function isClosed(tags = {}) {
  if (/^(closed|off)$/i.test(String(tags.opening_hours || "").trim())) return true;
  if (/^(yes|closed)$/i.test(tags.disused || "") || /^(yes|closed)$/i.test(tags.closed || "")) return true;
  if (Object.keys(tags).some((k) => /^(disused|abandoned|was|demolished|removed|razed):/.test(k))) return true;
  if (tags.end_date && Date.parse(tags.end_date) < Date.now()) return true;
  if (/^(temporarily|permanently)?_?closed$/i.test(tags["operational_status"] || tags.status || "")) return true;
  return false;
}

function redeSocial(lead) {
  const s = String(lead.siteUrl || "").toLowerCase();
  if (/instagram\.com/.test(s) || (!s && lead.instagram)) return "Instagram";
  if (/(facebook|fb)\.(com|me)/.test(s) || (!s && lead.facebook)) return "Facebook";
  if (/linktr\.ee|linkin\.bio|beacons\.ai/.test(s)) return "Linktree";
  if (/wa\.me/.test(s)) return "WhatsApp";
  if (/tiktok\.com/.test(s)) return "TikTok";
  return null;
}

/** Converte um lead do LeadRadar para o modelo do funil. Devolve null se não serve. */
export function toFunnelLead(l, pais = "PT") {
  if (!l || l.hasWebsite || l.site === "real") return null;
  let best = null;
  for (const p of l.phones || []) {
    const c = classifyPhone(p.e164, pais);
    if (c && (!best || (c.tipo === "movel" && best.tipo !== "movel"))) best = c;
  }
  if (!best) return null;
  const so_redes = l.site === "social";
  return {
    place_id: "osm:" + l.osm, nome: l.name.slice(0, 160), categoria: (l.type || "Negócio local").slice(0, 80), nicho: l.cat,
    cidade: (l.city || "").slice(0, 80), url_maps: mapsLink(l), avaliacao: null, n_avaliacoes: null,
    site_tipo: so_redes ? "so_redes" : "nenhum", rede_social: so_redes ? redeSocial(l) : (l.instagram ? "Instagram" : l.facebook ? "Facebook" : null),
    telefone_e164: best.e164, tipo_tel: best.tipo,
  };
}

export function createJobs(db, { generate = firstMessage, concurrency = 4, batchSize = 20, batchPauseMs = 250 } = {}) {
  const running = new Map(); // campaignId -> AbortController
  const queue = [];
  const queued = new Set();
  let active = 0;

  const insert = db.prepare(`INSERT OR IGNORE INTO leads(campanha_id, place_id, nome, categoria, nicho, cidade, url_maps, avaliacao, n_avaliacoes,
    site_tipo, rede_social, telefone_e164, tipo_tel, atribuida_a, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);

  function enqueue(id) { if (!queued.has(id)) { queued.add(id); queue.push(id); pump(); } }

  function pump() {
    while (active < concurrency && queue.length) {
      const id = queue.shift();
      active++;
      writeOne(id).finally(() => { active--; queued.delete(id); pump(); });
    }
  }

  async function writeOne(id) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      const lead = db.prepare("SELECT * FROM leads WHERE id = ?").get(id);
      if (!lead || lead.etapa !== "encontrada" || lead.excluida || lead.invalido) return;
      try {
        const author = db.prepare("SELECT nome FROM users WHERE id = ?").get(lead.atribuida_a);
        const s = getSettings(db);
        const msg = await Promise.race([
          Promise.resolve().then(() => generate(lead, { remetente: author?.nome || "", assinatura: s.assinatura }, lead.variante)),
          sleep(15000).then(() => { throw new Error("tempo esgotado"); }),
        ]);
        if (!msg || typeof msg !== "string") throw new Error("mensagem vazia");
        db.prepare("UPDATE leads SET mensagem = ?, mensagem_origem = 'template', etapa = 'escrita', falha_escrita = NULL, tentativas = ?, updated_at = ? WHERE id = ? AND etapa = 'encontrada'")
          .run(msg, attempt, Date.now(), id);
        return;
      } catch (err) {
        if (attempt === 3) {
          db.prepare("UPDATE leads SET falha_escrita = ?, tentativas = ?, updated_at = ? WHERE id = ?").run(String(err.message || err).slice(0, 200), attempt, Date.now(), id);
          return;
        }
        await sleep(200 * 2 ** (attempt - 1) + Math.random() * 100);
      }
    }
  }

  async function search(campaign, signal) {
    const district = DISTRICT_BY_ID[campaign.regiao];
    const res = await fetchLeads({ district, concelho: campaign.concelho || "", onlyNoSite: true, excludeChains: true, limit: 2500 }, { signal });
    signal.throwIfAborted();
    const open = res.elements.filter((e) => !isClosed(e.tags));
    let leads = dedupeLeads(open.map((e) => toLead(e, district.id)).filter(Boolean));
    if (campaign.nicho !== "todos") leads = leads.filter((l) => l.cat === campaign.nicho);
    let ignoradas = 0, invalidas = 0;
    for (let i = 0; i < leads.length; i += batchSize) {
      signal.throwIfAborted();
      const now = Date.now();
      const ids = [];
      db.exec("BEGIN IMMEDIATE");
      try {
        for (const raw of leads.slice(i, i + batchSize)) {
          const f = toFunnelLead(raw, campaign.pais);
          if (!f) { invalidas++; continue; }
          if (isExcluded(db, f.place_id, f.telefone_e164)) { ignoradas++; continue; }
          const r = insert.run(campaign.id, f.place_id, f.nome, f.categoria, f.nicho, f.cidade, f.url_maps, f.avaliacao, f.n_avaliacoes,
            f.site_tipo, f.rede_social, f.telefone_e164, f.tipo_tel, campaign.criada_por, now, now);
          if (r.changes) ids.push(Number(r.lastInsertRowid)); else ignoradas++;
        }
        db.prepare("UPDATE campaigns SET ignoradas = ?, invalidas = ?, updated_at = ? WHERE id = ?").run(ignoradas, invalidas, now, campaign.id);
        db.exec("COMMIT");
      } catch (e) { db.exec("ROLLBACK"); throw e; }
      ids.forEach(enqueue); // a escrita começa logo, lote a lote
      if (i + batchSize < leads.length) await sleep(batchPauseMs, signal);
    }
  }

  function start(campaign) {
    const ctrl = new AbortController();
    running.set(campaign.id, ctrl);
    const done = (estado, erro = null) => {
      running.delete(campaign.id);
      db.prepare("UPDATE campaigns SET estado = ?, erro = ?, updated_at = ? WHERE id = ? AND estado = 'a_correr'").run(estado, erro, Date.now(), campaign.id);
    };
    search(campaign, ctrl.signal).then(() => done("concluida"), (err) => {
      if (ctrl.signal.aborted) done("cancelada");
      else done("erro", String(err.message || err).slice(0, 300));
    });
  }

  function cancel(id) {
    const c = running.get(id);
    if (c) c.abort(new Error("cancelada"));
    db.prepare("UPDATE campaigns SET estado = 'cancelada', updated_at = ? WHERE id = ? AND estado = 'a_correr'").run(Date.now(), id);
  }

  // Ao arrancar, retoma escritas pendentes de pesquisas anteriores.
  for (const r of db.prepare("SELECT id FROM leads WHERE etapa = 'encontrada' AND falha_escrita IS NULL AND excluida = 0 AND invalido = 0").all()) enqueue(r.id);

  return {
    start, cancel, enqueue, isRunning: (id) => running.has(id),
    idle: () => active === 0 && queue.length === 0 && running.size === 0,
    validate(body) {
      const regiao = String(body.regiao || "");
      if (!DISTRICT_BY_ID[regiao]) return "Região inválida.";
      const nicho = String(body.nicho || "");
      if (nicho !== "todos" && !CATEGORY_BY_ID[nicho]) return "Nicho inválido.";
      const concelho = String(body.concelho || "");
      if (concelho && !DISTRICT_BY_ID[regiao].concelhos.includes(concelho)) return "Concelho inválido.";
      return null;
    },
  };
}
