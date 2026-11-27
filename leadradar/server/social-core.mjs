// Conversas: procura em várias plataformas pessoas que PRECISAM de um website
// (sobretudo em Portugal) e devolve o link do post para o utilizador responder lá.
// Só fontes públicas, sem login nem chave de API: Reddit, Bluesky, Lemmy,
// Mastodon e Hacker News.
// Não recolhe emails nem telefones: só o link público e o autor (RGPD).

const UA = "LeadRadar/1.0 (+conversas)";
const TIMEOUT_MS = 8000;
const MAX_AGE_DAYS = 60;

// Frases de pedido (pt-PT, pt-BR, en). Usadas nas pesquisas e na pontuação.
export const QUERIES_PT = [
  "\"preciso de um site\"",
  "\"preciso de um website\"",
  "\"alguém que faça sites\"",
  "\"recomendam alguém para fazer um site\"",
  "\"quanto custa um site\"",
  "\"procuro web designer\"",
  "\"procuro quem faça um site\"",
  "\"criar um site para a minha empresa\"",
];
export const QUERIES_EN = [
  "\"need a website\" Portugal",
  "\"looking for a web designer\" Portugal",
  "\"looking for a web developer\" Lisbon OR Porto",
];

const INTENT = [
  [/preciso (urgente(mente)? )?de (um |uma )?(novo )?(site|website|p[aá]gina|loja online|landing ?page)/i, 4],
  [/(procuro|procura-se|precisa-se( de)?|busco) (algu[eé]m|quem|um[a]?|profissional)?\s*(que fa[cç]a|para (fazer|criar)|web ?designer|programador|developer|webdesigner)/i, 4],
  [/(algu[eé]m|quem) (me )?(recomenda|conhece|indica|sabe de)[^.?!]{0,60}(site|website|web ?designer|programador)/i, 4],
  [/(quanto custa|pre[cç]o de|or[cç]amento (para|de)) (fazer |criar |um |uma )*(site|website|loja online)/i, 3],
  [/(n[aã]o tenho|ainda n[aã]o tem|sem) (um )?(site|website)/i, 2],
  [/(criar|fazer|montar) (um |o )?(site|website|loja online) (para|da|do) (a )?(minha|meu|nossa|nosso)/i, 3],
  [/\b(need|looking for|want|hire|recommend)\b[^.?!]{0,40}\b(website|web ?designer|web developer|landing page)\b/i, 3],
];
// Quem OFERECE serviços (concorrência/spam) — penaliza.
const OFFER = [
  /\b(fa[cç]o|fazemos|criamos|desenvolvemos|ofere[cç]o|oferecemos) (sites|websites|lojas online|p[aá]ginas)/i,
  /\b(meu|nosso) portf[oó]lio\b/i,
  /\b(promo[cç][aã]o|desconto)\b.*\bsite/i,
  /\b(we build|i build|i make|we design|hire me|my agency|our agency)\b/i,
  /\bDM (me|para) (or[cç]amento|quote)/i,
];
const PT_SIGNAL = /\b(portugal|lisboa|porto|braga|coimbra|faro|aveiro|leiria|set[uú]bal|viseu|funchal|madeira|a[cç]ores|algarve|telem[oó]vel|freguesia|concelho|nif|iva|€)/i;
const PT_LANG = /\b(n[aã]o|para|que|um|uma|preciso|site|empresa|neg[oó]cio)\b/i;
const BR_SIGNAL = /\b(voc[eê]|celular|cnpj|r\$|reais|brasil|s[aã]o paulo|rio de janeiro)\b/i;

export function scoreText(text) {
  const t = String(text || "");
  let s = 0;
  const reasons = [];
  for (const [re, w] of INTENT) if (re.test(t)) { s += w; reasons.push("pedido"); }
  if (OFFER.some((re) => re.test(t))) { s -= 6; reasons.push("oferta de serviço"); }
  if (/\?/.test(t)) s += 1;
  let region = "outro";
  if (PT_SIGNAL.test(t)) { s += 2; region = "pt"; }
  else if (BR_SIGNAL.test(t)) region = "br";
  else if (PT_LANG.test(t)) region = "lusofono";
  const score = Math.max(0, Math.min(10, s));
  return { score, region, isRequest: score >= 3 && !reasons.includes("oferta de serviço"), reasons: [...new Set(reasons)] };
}

const clean = (s, n = 400) => String(s || "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim().slice(0, n);
const safeUrl = (u) => { try { const x = new URL(u); return x.protocol === "https:" || x.protocol === "http:" ? x.href : null; } catch { return null; } };

async function getJSON(url, init = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(url, { ...init, signal: ctrl.signal, headers: { "User-Agent": UA, Accept: "application/json", ...(init.headers || {}) } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally { clearTimeout(timer); }
}

// ── Fontes ─────────────────────────────────────────────────────
export const parsers = {
  reddit(json) {
    return (json?.data?.children || []).map(({ data: d }) => ({
      source: "Reddit", where: `r/${d.subreddit}`,
      title: clean(d.title, 200), text: clean(d.selftext),
      url: safeUrl(`https://www.reddit.com${d.permalink}`), author: d.author,
      date: new Date((d.created_utc || 0) * 1000).toISOString(),
    }));
  },
  bluesky(json) {
    return (json?.posts || []).map((p) => {
      const rkey = String(p.uri || "").split("/").pop();
      return {
        source: "Bluesky", where: "Bluesky", title: "", text: clean(p.record?.text),
        url: safeUrl(`https://bsky.app/profile/${p.author?.handle}/post/${rkey}`),
        author: p.author?.handle, date: p.record?.createdAt || p.indexedAt,
      };
    });
  },
  hn(json) {
    return (json?.hits || []).map((h) => ({
      source: "Hacker News", where: "HN", title: clean(h.title || h.story_title, 200), text: clean(h.comment_text || h.story_text),
      url: safeUrl(`https://news.ycombinator.com/item?id=${h.objectID}`), author: h.author, date: h.created_at,
    }));
  },
  mastodon(json, host) {
    return (json || []).map((s) => ({
      source: "Mastodon", where: host, title: "", text: clean(s.content),
      url: safeUrl(s.url), author: s.account?.acct, date: s.created_at,
    }));
  },
  lemmy(json, host) {
    return (json?.posts || []).map(({ post: p, creator: c, community: m }) => ({
      source: "Lemmy", where: m?.name ? `${m.name}@${host}` : host, title: clean(p?.name, 200), text: clean(p?.body),
      url: safeUrl(p?.ap_id), author: c?.name, date: p?.published,
    }));
  },
};


function sources() {
  const list = [];
  const pt = QUERIES_PT.slice(0, 6);
  for (const q of pt) list.push({ name: "Reddit", run: async () => parsers.reddit(await getJSON(`https://www.reddit.com/search.json?q=${encodeURIComponent(q)}&sort=new&t=month&limit=25&raw_json=1`)) });
  list.push({ name: "Reddit", run: async () => parsers.reddit(await getJSON(`https://www.reddit.com/r/portugal+PortugalExpats+portugueses+empreendedorismo+lisboa+porto/search.json?q=${encodeURIComponent("site OR website OR \"web designer\"")}&restrict_sr=1&sort=new&t=month&limit=50&raw_json=1`)) });
  for (const q of pt.slice(0, 4)) list.push({ name: "Bluesky", run: async () => parsers.bluesky(await getJSON(`https://public.api.bsky.app/xrpc/app.bsky.feed.searchPosts?q=${encodeURIComponent(q.replace(/"/g, ""))}&lang=pt&sort=latest&limit=25`)) });
  for (const q of QUERIES_EN) list.push({ name: "Hacker News", run: async () => parsers.hn(await getJSON(`https://hn.algolia.com/api/v1/search_by_date?query=${encodeURIComponent(q.replace(/"/g, ""))}&tags=(story,comment)&hitsPerPage=20`)) });
  for (const host of ["masto.pt", "mastodon.social"]) for (const tag of ["website", "webdesign", "portugal"]) list.push({ name: "Mastodon", run: async () => parsers.mastodon(await getJSON(`https://${host}/api/v1/timelines/tag/${tag}?limit=40`), host) });
  for (const host of ["lemmy.pt", "lemmy.world"]) for (const q of ["preciso de um site", "web designer", "website"]) list.push({ name: "Lemmy", run: async () => parsers.lemmy(await getJSON(`https://${host}/api/v3/search?q=${encodeURIComponent(q)}&type_=Posts&sort=New&limit=30`), host) });
  return list;
}

export function finalize(items, { minScore = 3, region = "all" } = {}) {
  const cutoff = Date.now() - MAX_AGE_DAYS * 864e5;
  const seen = new Set();
  const out = [];
  for (const it of items) {
    if (!it.url || seen.has(it.url)) continue;
    seen.add(it.url);
    const ts = it.date ? Date.parse(it.date) : NaN;
    if (!Number.isNaN(ts) && ts < cutoff) continue;
    const sc = scoreText(`${it.title} ${it.text}`);
    if (sc.score < minScore || !sc.isRequest) continue;
    if (region === "pt" && sc.region !== "pt") continue;
    if (region === "lusofono" && !["pt", "lusofono", "br"].includes(sc.region)) continue;
    out.push({ id: it.url, ...it, ...sc });
  }
  return out.sort((a, b) => b.score - a.score || Date.parse(b.date || 0) - Date.parse(a.date || 0));
}

// Cache curta em memória (instâncias quentes) para não martelar as APIs.
let cache = { at: 0, raw: null, status: null };
const CACHE_MS = 5 * 60 * 1000;

export async function handleSocial(request) {
  if (request.method !== "GET") return json({ error: "Método não permitido" }, 405);
  const u = new URL(request.url);
  const minScore = Math.max(0, Math.min(10, Number(u.searchParams.get("min") ?? 3) || 0));
  const region = ["all", "pt", "lusofono"].includes(u.searchParams.get("region")) ? u.searchParams.get("region") : "all";
  const fresh = u.searchParams.get("fresh") === "1";

  if (fresh || !cache.raw || Date.now() - cache.at > CACHE_MS) {
    const list = sources();
    const results = await Promise.allSettled(list.map((s) => s.run()));
    const status = {};
    const raw = [];
    results.forEach((r, i) => {
      const n = list[i].name;
      status[n] ??= { ok: 0, fail: 0, items: 0, error: null };
      if (r.status === "fulfilled") { status[n].ok++; status[n].items += r.value.length; raw.push(...r.value); }
      else { status[n].fail++; status[n].error = String(r.reason?.message || r.reason).slice(0, 80); }
    });
    cache = { at: Date.now(), raw, status };
  }
  const items = finalize(cache.raw, { minScore, region });
  return json({ updatedAt: new Date(cache.at).toISOString(), sources: cache.status, count: items.length, items }, 200);
}

function json(body, status) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
}
