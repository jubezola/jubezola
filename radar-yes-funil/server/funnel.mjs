// Regras de negócio do funil: transições, permissões, exclusões, contadores.
import { tx, getSettings, STAGES, RESULTS } from "./db.mjs";
import { followUpMessage, callScript } from "./messages.mjs";
import { waLink, telLink, displayPhone } from "./phone.mjs";

export class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }
const DAY = 86400000;
export const today = (t = Date.now()) => new Date(t).toISOString().slice(0, 10);

export function canAccess(user, lead) { return user.role === "dono" || lead.atribuida_a === user.id; }

export function loadLead(db, user, id) {
  const lead = db.prepare("SELECT * FROM leads WHERE id = ?").get(id);
  if (!lead) throw new HttpError(404, "Lead não encontrado.");
  if (!canAccess(user, lead)) throw new HttpError(403, "Este lead não te está atribuído.");
  return lead;
}

export function isExcluded(db, placeId, e164) {
  return !!db.prepare("SELECT 1 FROM exclusions WHERE key IN (?, ?)").get("place:" + placeId, "tel:" + e164);
}
function addExclusion(db, lead, motivo, userId) {
  const st = db.prepare("INSERT OR IGNORE INTO exclusions(key, motivo, lead_id, created_by, created_at) VALUES (?,?,?,?,?)");
  st.run("place:" + lead.place_id, motivo, lead.id, userId, Date.now());
  st.run("tel:" + lead.telefone_e164, motivo, lead.id, userId, Date.now());
}
function removeExclusion(db, lead, motivo) {
  db.prepare("DELETE FROM exclusions WHERE lead_id = ? AND motivo = ?").run(lead.id, motivo);
}

const set = (db, id, fields) => {
  const keys = Object.keys(fields);
  db.prepare(`UPDATE leads SET ${keys.map((k) => `${k} = ?`).join(", ")}, updated_at = ? WHERE id = ?`)
    .run(...keys.map((k) => fields[k]), Date.now(), id);
};

export function sendsToday(db, userId) {
  return db.prepare("SELECT COUNT(*) n FROM sends WHERE user_id = ? AND dia = ?").get(userId, today()).n;
}
function checkLimit(db, user) {
  const { limite_diario } = getSettings(db);
  if (sendsToday(db, user.id) >= limite_diario) throw new HttpError(429, `Atingiste o limite diário de ${limite_diario} envios.`);
}

function needsFollowUp(lead, dias, now = Date.now()) {
  return lead.etapa === "enviada" && !lead.followup_em && !lead.excluida && lead.enviada_em != null && now - lead.enviada_em >= dias * DAY;
}

/** Ações do utilizador sobre um lead. Todas validadas aqui (servidor). */
export function act(db, user, id, action, body = {}) {
  return tx(db, () => {
    const lead = loadLead(db, user, id);
    const now = Date.now();
    const blocked = () => { if (lead.excluida || lead.invalido) throw new HttpError(409, "Lead excluído ou com número inválido."); };
    switch (action) {
      case "edit": {
        if (!["encontrada", "escrita"].includes(lead.etapa)) throw new HttpError(409, "A mensagem já foi enviada.");
        const m = String(body.mensagem ?? "").trim();
        if (m.length < 20 || m.length > 1000) throw new HttpError(400, "A mensagem deve ter entre 20 e 1000 caracteres.");
        if (/https?:\/\/|www\./i.test(m)) throw new HttpError(400, "Sem links na primeira mensagem.");
        set(db, id, { mensagem: m, mensagem_origem: "editada", etapa: "escrita", falha_escrita: null });
        break;
      }
      case "send": {
        blocked();
        if (lead.etapa !== "escrita") throw new HttpError(409, lead.etapa === "encontrada" ? "Escreve a mensagem primeiro." : "Este lead já foi enviado.");
        checkLimit(db, user);
        const canal = lead.tipo_tel === "movel" ? (body.canal === "chamada" ? "chamada" : "whatsapp") : "chamada";
        set(db, id, { etapa: "enviada", canal, enviada_em: now, enviada_por: user.id });
        db.prepare("INSERT INTO sends(lead_id, user_id, dia, kind, created_at) VALUES (?,?,?,?,?)").run(id, user.id, today(now), "primeira", now);
        break;
      }
      case "respond": {
        if (!RESULTS.includes(body.resultado)) throw new HttpError(400, "Resultado inválido.");
        if (lead.etapa !== "enviada" && lead.etapa !== "respondida") throw new HttpError(409, "Só se regista resposta depois do envio.");
        const nota = body.nota == null ? lead.nota : String(body.nota).slice(0, 500);
        if (lead.resultado === "sem_interesse" && body.resultado !== "sem_interesse") { removeExclusion(db, lead, "sem_interesse"); set(db, id, { excluida: 0 }); }
        set(db, id, { etapa: "respondida", resultado: body.resultado, respondida_em: lead.respondida_em ?? now, nota });
        if (body.resultado === "sem_interesse") { addExclusion(db, lead, "sem_interesse", user.id); set(db, id, { excluida: 1 }); }
        break;
      }
      case "followup": {
        const { dias_followup } = getSettings(db);
        if (!needsFollowUp(lead, dias_followup, now)) throw new HttpError(409, "Este lead não precisa de follow-up (ou já teve um).");
        checkLimit(db, user);
        set(db, id, { followup_em: now });
        db.prepare("INSERT INTO sends(lead_id, user_id, dia, kind, created_at) VALUES (?,?,?,?,?)").run(id, user.id, today(now), "followup", now);
        break;
      }
      case "exclude": {
        if (lead.excluida && lead.resultado !== "sem_interesse") break;
        addExclusion(db, lead, "nao_contactar", user.id); set(db, id, { excluida: 1 });
        break;
      }
      case "invalid": {
        addExclusion(db, lead, "numero_invalido", user.id); set(db, id, { invalido: 1 });
        break;
      }
      case "undo": {
        const what = body.what || "stage";
        if (what === "exclude") { removeExclusion(db, lead, "nao_contactar"); set(db, id, { excluida: lead.resultado === "sem_interesse" ? 1 : 0 }); break; }
        if (what === "invalid") { removeExclusion(db, lead, "numero_invalido"); set(db, id, { invalido: 0 }); break; }
        if (what === "followup") {
          if (!lead.followup_em) throw new HttpError(409, "Nada para anular.");
          db.prepare("DELETE FROM sends WHERE id = (SELECT id FROM sends WHERE lead_id = ? AND kind = 'followup' ORDER BY id DESC LIMIT 1)").run(id);
          set(db, id, { followup_em: null }); break;
        }
        if (lead.etapa === "respondida") {
          if (lead.resultado === "sem_interesse") { removeExclusion(db, lead, "sem_interesse"); set(db, id, { excluida: 0 }); }
          set(db, id, { etapa: "enviada", resultado: null, respondida_em: null });
        } else if (lead.etapa === "enviada") {
          db.prepare("DELETE FROM sends WHERE id = (SELECT id FROM sends WHERE lead_id = ? AND kind = 'primeira' ORDER BY id DESC LIMIT 1)").run(id);
          set(db, id, { etapa: "escrita", canal: null, enviada_em: null, enviada_por: null, followup_em: null });
        } else if (lead.etapa === "escrita") {
          set(db, id, { etapa: "encontrada", mensagem: null, mensagem_origem: null });
        } else throw new HttpError(409, "Nada para anular.");
        break;
      }
      case "assign": {
        if (user.role !== "dono") throw new HttpError(403, "Só o dono pode reatribuir leads.");
        const to = db.prepare("SELECT id FROM users WHERE id = ?").get(Number(body.user_id));
        if (!to) throw new HttpError(400, "Utilizador inválido.");
        set(db, id, { atribuida_a: to.id });
        break;
      }
      default: throw new HttpError(400, "Ação desconhecida.");
    }
    return db.prepare("SELECT * FROM leads WHERE id = ?").get(id);
  });
}

/** Âmbito SQL conforme o papel e filtros (campanha, pessoa). */
export function scope(db, user, q) {
  const where = [], args = [];
  if (user.role !== "dono") { where.push("l.atribuida_a = ?"); args.push(user.id); }
  else if (q.pessoa) { where.push("l.atribuida_a = ?"); args.push(Number(q.pessoa)); }
  const camp = resolveCampaign(db, user, q.campanha);
  if (camp) { where.push("l.campanha_id = ?"); args.push(camp.id); }
  return { where, args, camp };
}

export function resolveCampaign(db, user, sel) {
  if (sel === "todas") return null;
  if (sel && /^\d+$/.test(String(sel))) {
    const c = db.prepare("SELECT * FROM campaigns WHERE id = ?").get(Number(sel));
    if (!c) throw new HttpError(404, "Campanha não encontrada.");
    if (user.role !== "dono" && c.criada_por !== user.id) throw new HttpError(403, "Campanha de outra pessoa.");
    return c;
  }
  return user.role === "dono"
    ? db.prepare("SELECT * FROM campaigns ORDER BY id DESC LIMIT 1").get() || null
    : db.prepare("SELECT * FROM campaigns WHERE criada_por = ? ORDER BY id DESC LIMIT 1").get(user.id) || null;
}

export function stats(db, user, q) {
  const { where, args, camp } = scope(db, user, q);
  const { dias_followup, limite_diario } = getSettings(db);
  const w = where.length ? "WHERE " + where.join(" AND ") : "";
  const r = db.prepare(`SELECT
      COUNT(*) encontradas,
      SUM(etapa IN ('escrita','enviada','respondida')) escritas,
      SUM(etapa IN ('enviada','respondida')) enviadas,
      SUM(etapa = 'respondida') respostas,
      SUM(resultado = 'reuniao') reunioes,
      SUM(resultado = 'interessado') interessados,
      SUM(etapa = 'encontrada' AND falha_escrita IS NULL AND invalido = 0 AND excluida = 0) por_escrever,
      SUM(etapa = 'encontrada' AND falha_escrita IS NOT NULL) falhas_escrita,
      SUM(etapa = 'escrita' AND invalido = 0 AND excluida = 0) fila_envio,
      SUM(etapa = 'enviada' AND followup_em IS NULL AND excluida = 0 AND enviada_em <= ?) followups
    FROM leads l ${w}`).get(Date.now() - dias_followup * DAY, ...args);
  for (const k of Object.keys(r)) r[k] = r[k] || 0;
  r.taxa = r.enviadas ? r.respostas / r.enviadas : null;
  return { counts: r, campanha: camp ? publicCampaign(db, camp) : null, envios_hoje: sendsToday(db, user.id), limite_diario };
}

export function publicCampaign(db, c) {
  const autor = db.prepare("SELECT nome FROM users WHERE id = ?").get(c.criada_por);
  return { id: c.id, nicho: c.nicho, regiao: c.regiao, concelho: c.concelho, pais: c.pais, estado: c.estado, ignoradas: c.ignoradas,
    invalidas: c.invalidas, erro: c.erro, criada_por: c.criada_por, autor: autor?.nome || "", created_at: c.created_at, updated_at: c.updated_at };
}

export function listLeads(db, user, q) {
  const { where, args } = scope(db, user, q);
  const { dias_followup } = getSettings(db);
  if (q.etapa && STAGES.includes(q.etapa)) {
    // Filtro cumulativo, coerente com os contadores do funil.
    const idx = STAGES.indexOf(q.etapa);
    where.push(`l.etapa IN (${STAGES.slice(idx).map(() => "?").join(",")})`); args.push(...STAGES.slice(idx));
  }
  if (q.so_etapa && STAGES.includes(q.so_etapa)) { where.push("l.etapa = ?"); args.push(q.so_etapa); }
  if (q.tipo === "movel" || q.tipo === "fixo") { where.push("l.tipo_tel = ?"); args.push(q.tipo); }
  if (q.resultado && RESULTS.includes(q.resultado)) { where.push("l.resultado = ?"); args.push(q.resultado); }
  if (q.followup === "1") { where.push("l.etapa = 'enviada' AND l.followup_em IS NULL AND l.excluida = 0 AND l.enviada_em <= ?"); args.push(Date.now() - dias_followup * DAY); }
  if (q.falha === "1") { where.push("l.etapa = 'encontrada' AND l.falha_escrita IS NOT NULL"); }
  if (q.fila === "1") { where.push("l.etapa = 'escrita' AND l.invalido = 0 AND l.excluida = 0"); }
  if (q.nome) { where.push("l.nome LIKE ? ESCAPE '\\'"); args.push("%" + String(q.nome).slice(0, 80).replace(/[\\%_]/g, (m) => "\\" + m) + "%"); }
  const w = where.length ? "WHERE " + where.join(" AND ") : "";
  const limit = Math.min(100, Math.max(1, Number(q.limite) || 50));
  const page = Math.max(0, Number(q.pagina) || 0);
  const total = db.prepare(`SELECT COUNT(*) n FROM leads l ${w}`).get(...args).n;
  const order = q.fila === "1" ? "l.tipo_tel = 'movel' DESC, l.id ASC" : "l.id DESC";
  const rows = db.prepare(`SELECT l.*, u.nome AS atribuida_nome FROM leads l JOIN users u ON u.id = l.atribuida_a ${w} ORDER BY ${order} LIMIT ? OFFSET ?`)
    .all(...args, limit, page * limit);
  return { total, pagina: page, limite: limit, leads: rows.map((l) => publicLead(db, l, dias_followup)) };
}

export function publicLead(db, l, dias = getSettings(db).dias_followup) {
  const author = db.prepare("SELECT nome FROM users WHERE id = ?").get(l.enviada_por || l.atribuida_a);
  const ctx = { remetente: author?.nome || "", assinatura: getSettings(db).assinatura };
  const fu = needsFollowUp(l, dias);
  return {
    id: l.id, campanha_id: l.campanha_id, place_id: l.place_id, nome: l.nome, categoria: l.categoria, nicho: l.nicho, cidade: l.cidade,
    url_maps: l.url_maps, avaliacao: l.avaliacao, n_avaliacoes: l.n_avaliacoes, site_tipo: l.site_tipo, rede_social: l.rede_social,
    telefone_e164: l.telefone_e164, telefone: displayPhone(l.telefone_e164), tipo_tel: l.tipo_tel, etapa: l.etapa, resultado: l.resultado,
    mensagem: l.mensagem, mensagem_origem: l.mensagem_origem, falha_escrita: l.falha_escrita, canal: l.canal,
    enviada_em: l.enviada_em, respondida_em: l.respondida_em, nota: l.nota, followup_em: l.followup_em, invalido: !!l.invalido, excluida: !!l.excluida,
    atribuida_a: l.atribuida_a, atribuida_nome: l.atribuida_nome, followup: fu,
    wa: l.tipo_tel === "movel" && l.mensagem ? waLink(l.telefone_e164, l.mensagem) : null,
    tel: telLink(l.telefone_e164),
    guiao: l.tipo_tel === "fixo" && l.mensagem ? callScript(l, ctx) : null,
    followup_msg: fu ? followUpMessage(l, ctx) : null,
    followup_wa: fu && l.tipo_tel === "movel" ? waLink(l.telefone_e164, followUpMessage(l, ctx)) : null,
  };
}
