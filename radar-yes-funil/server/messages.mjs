// Gerador de mensagens por templates (custo zero). O LeadRadar original não tem IA;
// estas mensagens ficam marcadas com mensagem_origem = "template".

const NICHE = {
  restauracao: { pt: ["restaurantes e cafés", "reservas e encomendas"], br: ["restaurantes e cafés", "reservas e pedidos"] },
  beleza: { pt: ["salões e espaços de estética", "marcações"], br: ["salões e espaços de estética", "agendamentos"] },
  saude: { pt: ["clínicas e consultórios", "marcações de consulta"], br: ["clínicas e consultórios", "agendamentos de consulta"] },
  fitness: { pt: ["ginásios e estúdios", "novas inscrições"], br: ["academias e estúdios", "novas matrículas"] },
  animais: { pt: ["veterinários e lojas de animais", "marcações"], br: ["veterinários e pet shops", "agendamentos"] },
  alojamento: { pt: ["alojamentos locais", "reservas diretas"], br: ["pousadas e hospedagens", "reservas diretas"] },
  casa: { pt: ["profissionais de obras e reparações", "pedidos de orçamento"], br: ["profissionais de obras e reformas", "pedidos de orçamento"] },
  auto: { pt: ["oficinas e stands", "pedidos de orçamento"], br: ["oficinas e lojas de carros", "pedidos de orçamento"] },
  moda: { pt: ["lojas de moda", "visitas e encomendas"], br: ["lojas de moda", "visitas e pedidos"] },
  educacao: { pt: ["escolas e centros de formação", "inscrições"], br: ["escolas e cursos", "matrículas"] },
  servicos: { pt: ["empresas de serviços", "pedidos de orçamento"], br: ["empresas de serviços", "pedidos de orçamento"] },
  alimentar: { pt: ["lojas de bairro", "encomendas"], br: ["lojas de bairro", "pedidos"] },
  lojas: { pt: ["negócios locais", "pedidos de orçamento"], br: ["negócios locais", "pedidos de orçamento"] },
};

const T = {
  pt: {
    open: ["Olá, equipa da {nome}!", "Olá, pessoal da {nome}!", "Bom dia, equipa da {nome}!", "Olá, {nome}!"],
    rating: "Vi que têm {avaliacao}★ com {n} avaliações no Google, mas não encontrei um site vosso.",
    social: ["Vi que estão no {rede}, mas não encontrei um site vosso.", "Encontrei o vosso {rede}, mas não vi um site próprio."],
    none: ["Encontrei a {nome} no mapa de {cidade}, mas não encontrei um site vosso.", "Vi a {nome} no mapa em {cidade} e reparei que ainda não têm site."],
    value: ["Faço sites para {nicho} que transformam quem vos procura em {conv}.", "Crio sites para {nicho} pensados para gerar {conv}."],
    cta: ["Posso enviar-vos um exemplo rápido, sem compromisso?", "Querem que vos mostre um exemplo, sem compromisso?", "Posso mandar-vos uma ideia de como ficaria?"],
    follow: ["Olá de novo, equipa da {nome}! Sei que os dias são corridos. Ainda faz sentido enviar-vos o exemplo do site?", "Olá, {nome}! Só para não deixar a conversa a meio: posso enviar-vos o exemplo de que falei?"],
    script: ["Apresentação: \"Bom dia, fala {remetente}. Falo com o responsável da {nome}?\"", "Motivo: {detalhe}", "Pergunta: \"{cta}\""],
  },
  br: {
    open: ["Oi, pessoal da {nome}!", "Oi, equipe da {nome}!", "Olá, pessoal da {nome}!", "Oi, {nome}!"],
    rating: "Vi que vocês têm {avaliacao}★ com {n} avaliações no Google, mas não achei um site de vocês.",
    social: ["Vi que vocês estão no {rede}, mas não achei um site de vocês.", "Achei o {rede} de vocês, mas não vi um site próprio."],
    none: ["Achei a {nome} no mapa de {cidade}, mas não encontrei um site de vocês.", "Vi a {nome} no mapa em {cidade} e reparei que vocês ainda não têm site."],
    value: ["Eu crio sites para {nicho} que transformam quem procura vocês em {conv}.", "Faço sites para {nicho} pensados para gerar {conv}."],
    cta: ["Posso mandar um exemplo rápido, sem compromisso?", "Querem que eu mostre um exemplo, sem compromisso?", "Posso mandar uma ideia de como ficaria?"],
    follow: ["Oi de novo, pessoal da {nome}! Sei que a correria é grande. Ainda faz sentido eu mandar o exemplo do site?", "Oi, {nome}! Só para não deixar a conversa pela metade: posso mandar o exemplo que comentei?"],
    script: ["Apresentação: \"Bom dia, aqui é {remetente}. Falo com o responsável da {nome}?\"", "Motivo: {detalhe}", "Pergunta: \"{cta}\""],
  },
};

export function langFor(e164) { return String(e164 || "").startsWith("+55") ? "br" : "pt"; }

function hash(s) { let h = 2166136261; for (const c of String(s)) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
const pick = (arr, seed, salt) => arr[hash(seed + ":" + salt) % arr.length];
const fill = (s, v) => s.replace(/\{(\w+)\}/g, (m, k) => (v[k] ?? m));
const fmtRating = (r, lang) => (lang === "pt" || lang === "br" ? String(Number(r).toFixed(1)).replace(".", ",") : String(r));

function vars(lead, ctx) {
  const lang = langFor(lead.telefone_e164);
  const niche = (NICHE[lead.nicho] || NICHE.lojas)[lang];
  return {
    lang,
    v: {
      nome: lead.nome, cidade: lead.cidade || "na vossa zona", nicho: niche[0], conv: niche[1],
      avaliacao: lead.avaliacao != null ? fmtRating(lead.avaliacao, lang) : "", n: lead.n_avaliacoes ?? "",
      rede: lead.rede_social || "Instagram", remetente: ctx.remetente || "",
    },
  };
}

function detailLine(lead, t, v, seed) {
  if (lead.avaliacao != null && lead.n_avaliacoes) return fill(t.rating, v);
  if (lead.site_tipo === "so_redes") return fill(pick(t.social, seed, "s"), v);
  return fill(pick(t.none, seed, "d"), v);
}

/**
 * Primeira mensagem: 4 linhas, um detalhe concreto, um único CTA em pergunta, sem links.
 * `variant` muda a combinação (usado no "Regenerar").
 */
export function firstMessage(lead, ctx = {}, variant = 0) {
  const { lang, v } = vars(lead, ctx);
  const t = T[lang];
  const seed = `${lead.place_id}#${variant}`;
  const sig = fill(ctx.assinatura || "{remetente}, y.e.s", v).trim();
  return [
    fill(pick(t.open, seed, "o"), v),
    detailLine(lead, t, v, seed),
    fill(pick(t.value, seed, "v"), v),
    `${pick(t.cta, seed, "c")} — ${sig}`,
  ].join("\n");
}

export function followUpMessage(lead, ctx = {}) {
  const { lang, v } = vars(lead, ctx);
  const sig = fill(ctx.assinatura || "{remetente}, y.e.s", v).trim();
  return `${fill(pick(T[lang].follow, lead.place_id, "f"), v)} — ${sig}`;
}

/** Guião de chamada de 3 linhas derivado da mensagem guardada. */
export function callScript(lead, ctx = {}) {
  const { lang, v } = vars(lead, ctx);
  const lines = String(lead.mensagem || "").split("\n");
  const detalhe = lines[1] || detailLine(lead, T[lang], v, lead.place_id);
  const last = (lines[lines.length - 1] || "").split(" — ")[0];
  const cta = /\?$/.test(last) ? last : pick(T[lang].cta, lead.place_id, "c");
  return T[lang].script.map((s) => fill(s, { ...v, detalhe, cta }));
}
