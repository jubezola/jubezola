// Regras de negócio do funil: transições, permissões, exclusões, contadores (Postgres).
import { getSettings, STAGES, RESULTS } from "./db.mjs";
import { followUpMessage, callScript } from "./messages.mjs";
import { waLink, telLink, displayPhone } from "./phone.mjs";

export class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }
const DAY = 86400000;
export const today = (t = Date.now()) => new Date(t).toISOString().slice(0, 10);

export function canAccess(user, lead) { return user.role === "dono" || lead.atribuida_a === user.id; }

export async function loadLead(db, user, id, lock = false) {
  const lead = await db.one(`SELECT * FROM leads WHERE id = $1${lock ? " FOR UPDATE" : ""}`, [id]);
  if (!lead) throw new HttpError(404, "Lead não encontrado.");
  if (!canAccess(user, lead)) throw new HttpError(403, "Este lead não te está atribuído.");
  return lead;
}

export async function isExcluded(db, placeId, e164) {
  return !!(await db.one("SELECT 1 FROM exclusions WHERE key IN ($1, $2)", ["place:" + placeId, "tel:" + e164]));
}
async function addExclusion(db, lead, motivo, userId) {
  for (const key of ["place:" + lead.place_id, "tel:" + lead.telefone_e164])
    await db.q("INSERT INTO exclusions(key, motivo, lead_id, created_by, created_at) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (key) DO NOTHING", [key, motivo, lead.id, userId, Date.now()]);
}
const removeExclusion = (db, lead, motivo) => db.q("DELETE FROM exclusions WHERE lead_id = $1 AND motivo = $2", [lead.id, motivo]);

async function set(db, id, fields) {
  const keys = Object.keys(fields);
  await db.q(`UPDATE leads SET ${keys.map((k, i) => `${k} = $${i + 1}`).join(", ")}, updated_at = $${keys.length + 1} WHERE id = $${keys.length + 2}`,
    [...keys.map((k) => fields[k]), Date.now(), id]);
}

export async function sendsToday(db, userId) {
  return (await db.one("SELECT COUNT(*) n FROM sends WHERE user_id = $1 AND dia = $2", [userId, today()])).n;
}
async function checkLimit(db, user) {
  // Serializa os envios da mesma pessoa para o limite não ser ultrapassado em pedidos simultâneos.
  await db.q("SELECT pg_advisory_xact_lock(4317, $1)", [user.id]);
  const { limite_diario } = await getSettings(db);
  if ((await sendsToday(db, user.id)) >= limite_diario) throw new HttpError(429, `Atingiste o limite diário de ${limite_diario} envios.`);
}

function needsFollowUp(lead, dias, now = Date.now()) {
  return lead.etapa === "enviada" && !lead.followup_em && !lead.excluida && lead.enviada_em != null && now - lead.enviada_em >= dias * DAY;
}
const logSend = (db, id, userId, kind, now) => db.q("INSERT INTO sends(lead_id, user_id, dia, kind, created_at) VALUES ($1,$2,$3,$4,$5)", [id, userId, today(now), kind, now]);
const delSend = (db, id, kind) => db.q("DELETE FROM sends WHERE id = (SELECT id FROM sends WHERE lead_id = $1 AND kind = $2 ORDER BY id DESC LIMIT 1)", [id, kind]);

/** Ações do utilizador sobre um lead. Todas validadas aqui (servidor), numa transação com o lead bloqueado. */
export function act(dbRoot, user, id, action, body = {}) {
  return dbRoot.tx(async (db) => {
    const lead = await loadLead(db, user, id, true);
    const now = Date.now();
    const blocked = () => { if (lead.excluida || lead.invalido) throw new HttpError(409, "Lead excluído ou com número inválido."); };
    switch (action) {
      case "edit": {
        if (!["encontrada", "escrita"].includes(lead.etapa)) throw new HttpError(409, "A mensagem já foi enviada.");
        const m = String(body.mensagem ?? "").trim();
        if (m.length < 20 || m.length > 1000) throw new HttpError(400, "A mensagem deve ter entre 20 e 1000 caracteres.");
        if (/https?:\/\/|www\./i.test(m)) throw new HttpError(400, "Sem links na primeira mensagem.");
        await set(db, id, { mensagem: m, mensagem_origem: "editada", etapa: "escrita", falha_escrita: null });
        break;
      }
      case "send": {
        blocked();
        if (lead.etapa !== "escrita") throw new HttpError(409, lead.etapa === "encontrada" ? "Escreve a mensagem primeiro." : "Este lead já foi enviado.");
        await checkLimit(db, user);
        const canal = lead.tipo_tel === "movel" ? (body.canal === "chamada" ? "chamada" : "whatsapp") : "chamada";
        await set(db, id, { etapa: "enviada", canal, enviada_em: now, enviada_por: user.id });
        await logSend(db, id, user.id, "primeira", now);
        break;
      }
      case "respond": {
        if (!RESULTS.includes(body.resultado)) throw new HttpError(400, "Resultado inválido.");
        if (lead.etapa !== "enviada" && lead.etapa !== "respondida") throw new HttpError(409, "Só se regista resposta depois do envio.");
        const nota = body.nota == null ? lead.nota : String(body.nota).slice(0, 500);
        if (lead.resultado === "sem_interesse" && body.resultado !== "sem_interesse") { await removeExclusion(db, lead, "sem_interesse"); await set(db, id, { excluida: false }); }
        await set(db, id, { etapa: "respondida", resultado: body.resultado, respondida_em: lead.respondida_em ?? now, nota });
        if (body.resultado === "sem_interesse") { await addExclusion(db, lead, "sem_interesse", user.id); await set(db, id, { excluida: true }); }
        break;
      }
      case "followup": {
        const { dias_followup } = await getSettings(db);
        if (!needsFollowUp(lead, dias_followup, now)) throw new HttpError(409, "Este lead não precisa de follow-up (ou já teve um).");
        await checkLimit(db, user);
        await set(db, id, { followup_em: now });
        await logSend(db, id, user.id, "followup", now);
        break;
      }
      case "exclude": {
        if (lead.excluida) break;
        await addExclusion(db, lead, "nao_contactar", user.id); await set(db, id, { excluida: true });
        break;
      }
      case "invalid": {
        await addExclusion(db, lead, "numero_invalido", user.id); await set(db, id, { invalido: true });
        break;
      }
      case "undo": {
        const what = body.what || "stage";
        if (what === "exclude") { await removeExclusion(db, lead, "nao_contactar"); await set(db, id, { excluida: lead.resultado === "sem_interesse" }); break; }
        if (what === "invalid") { await removeExclusion(db, lead, "numero_invalido"); await set(db, id, { invalido: false }); break; }
        if (what === "followup") {
          if (!lead.followup_em) throw new HttpError(409, "Nada para anular.");
          await delSend(db, id, "followup"); await set(db, id, { followup_em: null }); break;
        }
        if (lead.etapa === "respondida") {
          if (lead.resultado === "sem_interesse") { await removeExclusion(db, lead, "sem_interesse"); await set(db, id, { excluida: false }); }
          await set(db, id, { etapa: "enviada", resultado: null, respondida_em: null });
        } else if (lead.etapa === "enviada") {
          await delSend(db, id, "primeira");
          await set(db, id, { etapa: "escrita", canal: null, enviada_em: null, enviada_por: null, followup_em: null });
        } else if (lead.etapa === "escrita") {
          await set(db, id, { etapa: "encontrada", mensagem: null, mensagem_origem: null });
        } else throw new HttpError(409, "Nada para anular.");
        break;
      }
      case "assign": {
        if (user.role !== "dono") throw new HttpError(403, "Só o dono pode reatribuir leads.");
        const to = await db.one("SELECT id FROM users WHERE id = $1", [Number(body.user_id) || 0]);
        if (!to) throw new HttpError(400, "Utilizador inválido.");
        await set(db, id, { atribuida_a: to.id });
        break;
      }
      default: throw new HttpError(400, "Ação desconhecida.");
    }
    return db.one("SELECT * FROM leads WHERE id = $1", [id]);
  });
}

export async function resolveCampaign(db, user, sel) {
  if (sel === "todas") return null;
  if (sel && /^\d+$/.test(String(sel))) {
    const c = await db.one("SELECT * FROM campaigns WHERE id = $1", [Number(sel)]);
    if (!c) throw new HttpError(404, "Campanha não encontrada.");
    if (user.role !== "dono" && c.criada_por !== user.id) throw new HttpError(403, "Campanha de outra pessoa.");
    return c;
  }
  return user.role === "dono"
    ? db.one("SELECT * FROM campaigns ORDER BY id DESC LIMIT 1")
    : db.one("SELECT * FROM campaigns WHERE criada_por = $1 ORDER BY id DESC LIMIT 1", [user.id]);
}

/** Construtor de WHERE com parâmetros numerados. */
function builder() {
  const where = [], args = [];
  return {
    where, args,
    add(sql, ...vals) { let s = sql; for (const v of vals) { args.push(v); s = s.replace("?", "$" + args.length); } where.push(s); },
    sql: () => (where.length ? "WHERE " + where.join(" AND ") : ""),
  };
}

async function scope(db, user, q) {
  const b = builder();
  if (user.role !== "dono") b.add("l.atribuida_a = ?", user.id);
  else if (q.pessoa && /^\d+$/.test(q.pessoa)) b.add("l.atribuida_a = ?", Number(q.pessoa));
  const camp = await resolveCampaign(db, user, q.campanha);
  if (camp) b.add("l.campanha_id = ?", camp.id);
  return { b, camp };
}

export async function stats(db, user, q) {
  const { b, camp } = await scope(db, user, q);
  const { dias_followup, limite_diario } = await getSettings(db);
  b.args.push(Date.now() - dias_followup * DAY);
  const fu = "$" + b.args.length;
  const r = await db.one(`SELECT
      COUNT(*) encontradas,
      COUNT(*) FILTER (WHERE etapa IN ('escrita','enviada','respondida')) escritas,
      COUNT(*) FILTER (WHERE etapa IN ('enviada','respondida')) enviadas,
      COUNT(*) FILTER (WHERE etapa = 'respondida') respostas,
      COUNT(*) FILTER (WHERE resultado = 'reuniao') reunioes,
      COUNT(*) FILTER (WHERE resultado = 'interessado') interessados,
      COUNT(*) FILTER (WHERE etapa = 'encontrada' AND falha_escrita IS NULL AND NOT invalido AND NOT excluida) por_escrever,
      COUNT(*) FILTER (WHERE etapa = 'encontrada' AND falha_escrita IS NOT NULL) falhas_escrita,
      COUNT(*) FILTER (WHERE etapa = 'escrita' AND NOT invalido AND NOT excluida) fila_envio,
      COUNT(*) FILTER (WHERE etapa = 'enviada' AND followup_em IS NULL AND NOT excluida AND enviada_em <= ${fu}) followups
    FROM leads l ${b.sql()}`, b.args);
  r.taxa = r.enviadas ? r.respostas / r.enviadas : null;
  return { counts: r, campanha: camp ? await publicCampaign(db, camp) : null, envios_hoje: await sendsToday(db, user.id), limite_diario };
}

export async function publicCampaign(db, c) {
  const autor = await db.one("SELECT nome FROM users WHERE id = $1", [c.criada_por]);
  return { id: c.id, nicho: c.nicho, regiao: c.regiao, concelho: c.concelho, pais: c.pais, estado: c.estado, ignoradas: c.ignoradas,
    invalidas: c.invalidas, erro: c.erro, criada_por: c.criada_por, autor: autor?.nome || "", obtida: c.obtida,
    pendentes: Array.isArray(c.pendentes) ? c.pendentes.length : 0, created_at: c.created_at, updated_at: c.updated_at };
}

export async function listLeads(db, user, q) {
  const { b } = await scope(db, user, q);
  const settings = await getSettings(db);
  if (q.etapa && STAGES.includes(q.etapa)) b.add("l.etapa = ANY(?)", STAGES.slice(STAGES.indexOf(q.etapa)));
  if (q.so_etapa && STAGES.includes(q.so_etapa)) b.add("l.etapa = ?", q.so_etapa);
  if (q.tipo === "movel" || q.tipo === "fixo") b.add("l.tipo_tel = ?", q.tipo);
  if (q.resultado && RESULTS.includes(q.resultado)) b.add("l.resultado = ?", q.resultado);
  if (q.followup === "1") b.add("l.etapa = 'enviada' AND l.followup_em IS NULL AND NOT l.excluida AND l.enviada_em <= ?", Date.now() - settings.dias_followup * DAY);
  if (q.falha === "1") b.add("l.etapa = 'encontrada' AND l.falha_escrita IS NOT NULL");
  if (q.fila === "1") b.add("l.etapa = 'escrita' AND NOT l.invalido AND NOT l.excluida");
  if (q.nome) b.add("l.nome ILIKE ?", "%" + String(q.nome).slice(0, 80).replace(/[\\%_]/g, (m) => "\\" + m) + "%");
  const limit = Math.min(100, Math.max(1, Number(q.limite) || 50));
  const page = Math.max(0, Math.min(10000, Number(q.pagina) || 0));
  const { n: total } = await db.one(`SELECT COUNT(*) n FROM leads l ${b.sql()}`, b.args);
  const order = q.fila === "1" ? "(l.tipo_tel = 'movel') DESC, l.id ASC" : "l.id DESC";
  const rows = await db.all(`SELECT l.*, u.nome AS atribuida_nome FROM leads l JOIN users u ON u.id = l.atribuida_a ${b.sql()}
    ORDER BY ${order} LIMIT ${limit} OFFSET ${page * limit}`, b.args);
  const names = await userNames(db);
  return { total, pagina: page, limite: limit, leads: rows.map((l) => publicLead(l, settings, names)) };
}

export async function userNames(db) {
  return Object.fromEntries((await db.all("SELECT id, nome FROM users")).map((u) => [u.id, u.nome]));
}

export function publicLead(l, settings, names) {
  const ctx = { remetente: names[l.enviada_por || l.atribuida_a] || "", assinatura: settings.assinatura };
  const fu = needsFollowUp(l, settings.dias_followup);
  return {
    id: l.id, campanha_id: l.campanha_id, place_id: l.place_id, nome: l.nome, categoria: l.categoria, nicho: l.nicho, cidade: l.cidade,
    url_maps: l.url_maps, avaliacao: l.avaliacao, n_avaliacoes: l.n_avaliacoes, site_tipo: l.site_tipo, rede_social: l.rede_social,
    telefone_e164: l.telefone_e164, telefone: displayPhone(l.telefone_e164), tipo_tel: l.tipo_tel, etapa: l.etapa, resultado: l.resultado,
    mensagem: l.mensagem, mensagem_origem: l.mensagem_origem, falha_escrita: l.falha_escrita, canal: l.canal,
    enviada_em: l.enviada_em, respondida_em: l.respondida_em, nota: l.nota, followup_em: l.followup_em, invalido: !!l.invalido, excluida: !!l.excluida,
    atribuida_a: l.atribuida_a, atribuida_nome: names[l.atribuida_a] || "", followup: fu,
    wa: l.tipo_tel === "movel" && l.mensagem ? waLink(l.telefone_e164, l.mensagem) : null,
    tel: telLink(l.telefone_e164),
    guiao: l.tipo_tel === "fixo" && l.mensagem ? callScript(l, ctx) : null,
    followup_msg: fu ? followUpMessage(l, ctx) : null,
    followup_wa: fu && l.tipo_tel === "movel" ? waLink(l.telefone_e164, followUpMessage(l, ctx)) : null,
  };
}
