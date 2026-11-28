// Pesquisa (Encontradas) e escrita (Escritas) por passos curtos, compatíveis com funções serverless:
// o browser chama /step e /write em ciclo; o estado fica todo no Postgres (recarregar não perde nada).
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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Negócios fechados (temporária ou permanentemente), quando o OSM o indica. */
export function isClosed(tags = {}) {
  if (/^(closed|off)$/i.test(String(tags.opening_hours || "").trim())) return true;
  if (/^(yes|closed)$/i.test(tags.disused || "") || /^(yes|closed)$/i.test(tags.closed || "")) return true;
  if (Object.keys(tags).some((k) => /^(disused|abandoned|was|demolished|removed|razed):/.test(k))) return true;
  if (tags.end_date && Date.parse(tags.end_date) < Date.now()) return true;
  if (/^(temporarily|permanently)?_?closed$/i.test(tags.operational_status || tags.status || "")) return true;
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

export function createJobs(db, { generate = firstMessage, batchSize = 20, writeBatch = 12, concurrency = 4, fetchTimeoutMs = 45000, lockMs = 55000, maxFetchTries = 3 } = {}) {

  async function fetchCandidates(c) {
    const district = DISTRICT_BY_ID[c.regiao];
    const res = await fetchLeads({ district, concelho: c.concelho || "", onlyNoSite: true, excludeChains: true, limit: 2500 }, { signal: AbortSignal.timeout(fetchTimeoutMs) });
    const open = res.elements.filter((e) => !isClosed(e.tags));
    let leads = dedupeLeads(open.map((e) => toLead(e, district.id)).filter(Boolean));
    if (c.nicho !== "todos") leads = leads.filter((l) => l.cat === c.nicho);
    const out = [];
    let invalidas = 0;
    for (const l of leads) { const f = toFunnelLead(l, c.pais); if (f) out.push(f); else invalidas++; }
    return { out, invalidas };
  }

  /** Um passo da pesquisa: obter resultados (1.º passo) ou gravar o próximo lote. */
  async function searchStep(campaignId) {
    const now = Date.now();
    const c = await db.one(`UPDATE campaigns SET lock_until = $2 WHERE id = $1 AND estado = 'a_correr' AND (lock_until IS NULL OR lock_until < $3) RETURNING *`,
      [campaignId, now + lockMs, now]);
    if (!c) return;
    try {
      if (!c.obtida) {
        try {
          const { out, invalidas } = await fetchCandidates(c);
          await db.q(`UPDATE campaigns SET pendentes = $2, obtida = TRUE, invalidas = $3, updated_at = $4 WHERE id = $1 AND estado = 'a_correr'`,
            [c.id, JSON.stringify(out), invalidas, Date.now()]);
        } catch (err) {
          const tries = c.tentativas_pesquisa + 1;
          const msg = String(err?.name === "TimeoutError" ? "O OpenStreetMap demorou demasiado a responder." : err?.message || err).slice(0, 300);
          await db.q(`UPDATE campaigns SET tentativas_pesquisa = $2::int, estado = CASE WHEN $2::int >= $3::int THEN 'erro' ELSE estado END, erro = $4, updated_at = $5 WHERE id = $1 AND estado = 'a_correr'`,
            [c.id, tries, maxFetchTries, msg, Date.now()]);
        }
        return;
      }
      await db.tx(async (t) => {
        const cur = await t.one("SELECT * FROM campaigns WHERE id = $1 FOR UPDATE", [c.id]);
        if (cur.estado !== "a_correr") return;
        const all = Array.isArray(cur.pendentes) ? cur.pendentes : [];
        const batch = all.slice(0, batchSize), rest = all.slice(batchSize);
        let ignoradas = 0;
        const ts = Date.now();
        for (const f of batch) {
          if (await isExcluded(t, f.place_id, f.telefone_e164)) { ignoradas++; continue; }
          const r = await t.q(`INSERT INTO leads(campanha_id, place_id, nome, categoria, nicho, cidade, url_maps, avaliacao, n_avaliacoes,
              site_tipo, rede_social, telefone_e164, tipo_tel, atribuida_a, created_at, updated_at)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$15) ON CONFLICT DO NOTHING`,
            [cur.id, f.place_id, f.nome, f.categoria, f.nicho, f.cidade, f.url_maps, f.avaliacao, f.n_avaliacoes, f.site_tipo, f.rede_social, f.telefone_e164, f.tipo_tel, cur.criada_por, ts]);
          if (!r.rowCount) ignoradas++;
        }
        await t.q(`UPDATE campaigns SET pendentes = $2, ignoradas = ignoradas + $3, estado = CASE WHEN $4::boolean THEN 'concluida' ELSE estado END, updated_at = $5 WHERE id = $1`,
          [cur.id, rest.length ? JSON.stringify(rest) : null, ignoradas, rest.length === 0, ts]);
      });
    } finally {
      await db.q("UPDATE campaigns SET lock_until = NULL WHERE id = $1", [c.id]);
    }
  }

  async function writeOne(lead, ctx) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const msg = await Promise.race([
          Promise.resolve().then(() => generate(lead, ctx, lead.variante)),
          sleep(10000).then(() => { throw new Error("tempo esgotado"); }),
        ]);
        if (!msg || typeof msg !== "string") throw new Error("mensagem vazia");
        await db.q(`UPDATE leads SET mensagem = $1, mensagem_origem = 'template', etapa = 'escrita', falha_escrita = NULL, tentativas = $2, escrita_lock = NULL, updated_at = $3
          WHERE id = $4 AND etapa = 'encontrada'`, [msg, attempt, Date.now(), lead.id]);
        return true;
      } catch (err) {
        if (attempt === 3) {
          await db.q("UPDATE leads SET falha_escrita = $1, tentativas = $2, escrita_lock = NULL, updated_at = $3 WHERE id = $4",
            [String(err.message || err).slice(0, 200), attempt, Date.now(), lead.id]);
          return false;
        }
        await sleep(150 * 2 ** (attempt - 1) + Math.random() * 100);
      }
    }
  }

  /** Um passo de escrita: reclama até `writeBatch` leads por escrever e escreve-os com concorrência limitada. */
  async function writeStep(user) {
    const now = Date.now();
    const leads = await db.all(`UPDATE leads SET escrita_lock = $1 WHERE id IN (
        SELECT id FROM leads WHERE etapa = 'encontrada' AND falha_escrita IS NULL AND NOT excluida AND NOT invalido
          AND (escrita_lock IS NULL OR escrita_lock < $2) AND ($3 OR atribuida_a = $4)
        ORDER BY id LIMIT ${writeBatch} FOR UPDATE SKIP LOCKED) RETURNING *`, [now + 30000, now, user.role === "dono", user.id]);
    if (!leads.length) return 0;
    const s = await getSettings(db);
    const names = Object.fromEntries((await db.all("SELECT id, nome FROM users")).map((u) => [u.id, u.nome]));
    let ok = 0, i = 0;
    await Promise.all(Array.from({ length: Math.min(concurrency, leads.length) }, async () => {
      while (i < leads.length) { const l = leads[i++]; if (await writeOne(l, { remetente: names[l.atribuida_a] || "", assinatura: s.assinatura })) ok++; }
    }));
    return ok;
  }

  async function cancel(id) {
    await db.q("UPDATE campaigns SET estado = 'cancelada', pendentes = NULL, updated_at = $2 WHERE id = $1 AND estado = 'a_correr'", [id, Date.now()]);
  }

  function validate(body) {
    const regiao = String(body.regiao || "");
    if (!DISTRICT_BY_ID[regiao]) return "Região inválida.";
    const nicho = String(body.nicho || "");
    if (nicho !== "todos" && !CATEGORY_BY_ID[nicho]) return "Nicho inválido.";
    const concelho = String(body.concelho || "");
    if (concelho && !DISTRICT_BY_ID[regiao].concelhos.includes(concelho)) return "Concelho inválido.";
    return null;
  }

  return { searchStep, writeStep, cancel, validate };
}
