import { CONFIG, TEMPLATES, PIPELINE_STAGES } from "./config.js";
import { DISTRICTS, DISTRICT_BY_ID, CATEGORIES, CATEGORY_BY_ID } from "./data.js";
import { fetchLeads } from "./overpass.js";
import { toLead, fillTemplate, whatsappLink, mapsLink, googleCheckLink, heatLabel, parsePhone } from "./leads.js";
import * as store from "./store.js";
import * as M from "./map.js";
import * as R from "./report.js";

// ─────────────────────────── utilitários ───────────────────────────
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const nf = new Intl.NumberFormat("pt-PT");
const n = (x) => nf.format(x || 0);
const eur = (x) => new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(x || 0);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const hhmm = (t) => new Date(t).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
const sleep = (ms, signal) => new Promise((r) => { const t = setTimeout(r, ms); signal?.addEventListener("abort", () => { clearTimeout(t); r(); }, { once: true }); });
const reduceMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
const icon = (id, cls = "ic") => `<svg class="${cls}" aria-hidden="true"><use href="#i-${id}"/></svg>`;
const PAGE = 60;

// ─────────────────────────── estado ───────────────────────────
const state = {
  view: "search",
  district: null,
  concelho: "",
  leads: [],
  byId: new Map(),
  meta: null,
  newIds: new Set(),
  page: 1,
  filters: { q: "", city: "", channel: "all", heat: new Set(["quente", "morno", "frio"]), cats: new Set(), hideTracked: false, sort: "score" },
  loadingCtrl: null,
  loading: false,
  scan: null,
  stats: {},
  settings: store.getSettings(),
  current: null,
  mapReady: false,
};

const keyFor = (districtId, concelho = "") =>
  `${districtId}|${concelho}|${state.settings.onlyNoSite === false ? 0 : 1}|${state.settings.excludeChains ? 1 : 0}`;

// ─────────────────────────── toasts e feed ───────────────────────────
function toast(text, { action, timeout = 4800 } = {}) {
  const el = document.createElement("div");
  el.className = "toast";
  el.innerHTML = `<span>${esc(text)}</span>`;
  if (action) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = action.label;
    b.addEventListener("click", () => { action.fn(); el.remove(); });
    el.appendChild(b);
  }
  const box = $("#toasts");
  box.appendChild(el);
  while (box.children.length > 3) box.firstElementChild.remove();
  setTimeout(() => el.remove(), timeout);
}

const feedItems = [];
function feed(text, kind = "") {
  feedItems.unshift({ t: Date.now(), text, kind });
  feedItems.length = Math.min(feedItems.length, 40);
  $("#feed").innerHTML = feedItems
    .map((f) => `<li class="${f.kind ? "is-" + f.kind : ""}"><time>${new Date(f.t).toLocaleTimeString("pt-PT")}</time><span>${esc(f.text)}</span></li>`)
    .join("");
}

function setLive(s, text) {
  const el = $("#live");
  el.dataset.state = s;
  $("#liveText").textContent = text;
}

function copyText(text) {
  let ok = false;
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.cssText = "position:fixed;top:-1000px;opacity:0";
    document.body.appendChild(ta);
    ta.select();
    ok = document.execCommand("copy");
    ta.remove();
  } catch { ok = false; }
  if (!ok && navigator.clipboard) navigator.clipboard.writeText(text).catch(() => {});
  return true;
}

// ─────────────────────────── modelos de mensagem ───────────────────────────
function templateText(id) {
  return state.settings.templates?.[id] || TEMPLATES[id]?.text || TEMPLATES.primeiro.text;
}
function messageFor(lead, tplId) {
  return fillTemplate(templateText(tplId), lead, state.settings, CATEGORY_BY_ID[lead.cat]?.noun);
}
function waTemplate(lead) {
  return state.settings.template || "primeiro";
}
function igTemplate() {
  return state.settings.templateIg || "instagram";
}
function enrich(lead) {
  lead.districtName = DISTRICT_BY_ID[lead.district]?.name;
  return lead;
}

// ─────────────────────────── mapa de azulejos ───────────────────────────
function buildTiles() {
  const wrap = $("#tilemap");
  wrap.innerHTML = DISTRICTS.map((d) => {
    const [c, r, span] = d.grid;
    return `<button type="button" class="tile${d.island ? " is-island" : ""}" data-d="${d.id}" aria-pressed="false"
      style="grid-column:${c} / span ${span};grid-row:${r}" aria-label="${esc(d.name)}">
      <span class="tile-name">${esc(d.name)}</span>
      <span class="tile-count"></span>
      <span class="tile-heat" aria-hidden="true"><i></i></span>
    </button>`;
  }).join("");
  wrap.addEventListener("click", (e) => {
    const t = e.target.closest(".tile");
    if (t) selectDistrict(t.dataset.d, { scroll: true });
  });
}

function updateTile(id) {
  const el = $(`.tile[data-d="${id}"]`);
  if (!el) return;
  const s = state.stats[id];
  el.setAttribute("aria-pressed", String(state.district === id));
  el.classList.toggle("is-scanning", Boolean(s?.scanning));
  el.classList.toggle("is-error", Boolean(s?.error) && !s?.total);
  el.querySelector(".tile-count").textContent = s?.total != null ? n(s.total) : "";
  el.querySelector(".tile-heat i").style.width = s?.total ? `${Math.round((s.hot / s.total) * 100)}%` : "0";
  const d = DISTRICT_BY_ID[id];
  el.setAttribute("aria-label", s?.total != null ? `${d.name}: ${s.total} negócios, ${s.hot} quentes` : d.name);
}
function updateTiles() {
  DISTRICTS.forEach((d) => updateTile(d.id));
  const done = Object.values(state.stats).filter((s) => s.total != null);
  const total = done.reduce((a, s) => a + s.total, 0);
  $("#tilemapNote").textContent = done.length
    ? `${n(total)} negócios sem website em ${done.length} de 20 distritos analisados.`
    : "Os números aparecem à medida que cada distrito é analisado.";
}

function setStats(districtId, leads) {
  state.stats[districtId] = { total: leads.length, hot: leads.filter((l) => l.heat === "quente").length, fetchedAt: Date.now() };
  updateTile(districtId);
  updateTiles();
}

async function loadStatsFromCache() {
  const all = await store.cacheAll();
  for (const { value } of all) {
    if (!value || value.concelho) continue;
    const prev = state.stats[value.district];
    if (prev && prev.fetchedAt > value.fetchedAt) continue;
    state.stats[value.district] = { total: value.leads.length, hot: value.leads.filter((l) => l.heat === "quente").length, fetchedAt: value.fetchedAt };
  }
  updateTiles();
}

// ─────────────────────────── pesquisa ───────────────────────────
function processElements(elements, district, concelho, approximate) {
  const map = new Map();
  for (const el of elements) {
    const l = toLead(el, district.id);
    if (!l) continue;
    if (concelho) l.concelho = concelho;
    map.set(l.id, l);
  }
  let leads = [...map.values()];
  if (concelho && approximate) {
    const c = norm(concelho);
    leads = leads.filter((l) => norm(l.city).includes(c) || norm(l.street).includes(c));
  }
  return leads;
}

async function fetchAndStore(district, concelho, { signal, onStatus } = {}) {
  const limit = Number(state.settings.maxResults) || CONFIG.defaults.maxResults;
  const r = await fetchLeads({
    district, concelho,
    onlyNoSite: state.settings.onlyNoSite !== false,
    excludeChains: Boolean(state.settings.excludeChains),
    limit,
  }, { signal, onStatus });
  const leads = processElements(r.elements, district, concelho, r.approximate);
  const entry = {
    district: district.id, concelho, fetchedAt: Date.now(), endpoint: r.endpoint, osmBase: r.osmBase,
    approximate: Boolean(r.approximate), truncated: r.elements.length >= limit,
    partial: Boolean(r.remark && /timed out|timeout/i.test(r.remark)), leads,
  };
  await store.cachePut(keyFor(district.id, concelho), entry);
  if (!concelho) setStats(district.id, leads);
  return entry;
}

function showLoading(district, concelho) {
  $("#empty").hidden = true;
  $("#summary").hidden = false;
  $("#summary").innerHTML = `<span class="sum-main">A procurar negócios sem website em <b>${esc(concelho || district.name)}</b>…</span>`;
  $("#leadList").innerHTML = Array.from({ length: 6 }, () => `<li class="skeleton"><i></i><i></i></li>`).join("");
  $("#more").hidden = true;
}

function showError(err) {
  $("#leadList").innerHTML = "";
  $("#summary").hidden = true;
  const e = $("#empty");
  e.hidden = false;
  e.classList.remove("is-loading");
  e.innerHTML = `<div class="empty-tiles" aria-hidden="true"><span></span><span></span><span></span></div>
    <p class="empty-title">Os servidores do OpenStreetMap não responderam</p>
    <p>${esc(err.message || "Erro de ligação")}. Costuma resolver-se em segundos: tenta de novo, ou escolhe um concelho para uma pesquisa mais leve.</p>
    <button type="button" class="btn btn-primary" id="retry">${icon("refresh")}Tentar de novo</button>`;
  $("#retry").addEventListener("click", () => runSearch({ force: true }));
}

function applyEntry(entry, { diffFrom } = {}) {
  state.meta = entry;
  state.leads = entry.leads.map(enrich);
  state.byId = new Map(state.leads.map((l) => [l.id, l]));
  if (diffFrom) {
    const prev = new Set(diffFrom);
    const fresh = state.leads.filter((l) => !prev.has(l.id));
    fresh.forEach((l) => state.newIds.add(l.id));
    return fresh;
  }
  return [];
}

async function runSearch({ force = false, silent = false } = {}) {
  const district = DISTRICT_BY_ID[state.district];
  if (!district) return;
  const concelho = state.concelho;
  const key = keyFor(district.id, concelho);
  const label = concelho || district.name;

  state.loadingCtrl?.abort();
  const cached = await store.cacheGet(key);
  if (cached && state.district === district.id && state.concelho === concelho) {
    applyEntry(cached);
    render({ fit: !silent });
    if (store.isFresh(cached) && !force) {
      setLive("live", `Ao vivo, ${hhmm(cached.fetchedAt)}`);
      feed(`${label}: ${n(cached.leads.length)} negócios (guardados às ${hhmm(cached.fetchedAt)})`);
      return;
    }
  }

  const ctrl = new AbortController();
  state.loadingCtrl = ctrl;
  state.loading = true;
  $("#refresh").disabled = true;
  setLive("loading", `A procurar em ${label}…`);
  if (!cached && !silent) showLoading(district, concelho);
  feed(`A consultar o OpenStreetMap: ${label}`);
  const t0 = performance.now();
  try {
    const entry = await fetchAndStore(district, concelho, { signal: ctrl.signal, onStatus: (s) => setLive("loading", s) });
    if (ctrl.signal.aborted || state.district !== district.id || state.concelho !== concelho) return;
    const fresh = applyEntry(entry, cached ? { diffFrom: cached.leads.map((l) => l.id) } : undefined);
    render({ fit: !silent });
    const secs = ((performance.now() - t0) / 1000).toFixed(1);
    setLive("live", `Ao vivo, ${hhmm(entry.fetchedAt)}`);
    feed(`${label}: ${n(entry.leads.length)} negócios sem website (${secs}s via ${entry.endpoint})`, "good");
    if (cached && fresh.length) {
      feed(`${fresh.length} novo${fresh.length > 1 ? "s" : ""} em ${label}: ${fresh.slice(0, 3).map((l) => l.name).join(", ")}${fresh.length > 3 ? "…" : ""}`, "good");
      toast(`${fresh.length} negócio${fresh.length > 1 ? "s" : ""} novo${fresh.length > 1 ? "s" : ""} sem website em ${label}`, {
        action: { label: "Ver", fn: () => { state.filters.sort = "new"; $("#sort").value = "new"; render({ fit: false }); } },
      });
    }
  } catch (err) {
    if (ctrl.signal.aborted) return;
    setLive("error", "Sem ligação ao OSM");
    feed(`Falhou ${label}: ${err.message}`, "bad");
    if (!cached) showError(err);
    else toast("Não foi possível atualizar. A mostrar os últimos resultados guardados.");
  } finally {
    if (state.loadingCtrl === ctrl) { state.loading = false; state.loadingCtrl = null; }
    $("#refresh").disabled = !state.district;
  }
}

function selectDistrict(id, { concelho = "", scroll = false, force = false, updateHash = true } = {}) {
  const d = DISTRICT_BY_ID[id];
  if (!d) return;
  const changed = state.district !== id || state.concelho !== concelho;
  state.district = id;
  state.concelho = concelho;
  if (changed) {
    state.page = 1;
    state.newIds = new Set();
    state.filters.city = "";
    state.filters.cats.clear();
  }
  const sel = $("#concelho");
  sel.disabled = false;
  sel.innerHTML = `<option value="">Todo o distrito</option>` +
    [...d.concelhos].sort((a, b) => a.localeCompare(b, "pt")).map((c) => `<option ${c === concelho ? "selected" : ""}>${esc(c)}</option>`).join("");
  $("#refresh").disabled = false;
  updateTiles();
  if (updateHash) {
    const h = `#distrito=${d.id}${concelho ? "&concelho=" + encodeURIComponent(concelho) : ""}`;
    if (location.hash !== h) history.replaceState(null, "", h);
  }
  if (scroll) $("#workspace").scrollIntoView({ behavior: reduceMotion() ? "auto" : "smooth", block: "start" });
  if (changed) M.focusDistrict(d);
  runSearch({ force });
}

// ─────────────────────────── filtros e listagem ───────────────────────────
function passesBase(l, f, crm) {
  if (f.channel === "whatsapp" && !l.whatsapp) return false;
  if (f.channel === "instagram" && !l.instagram) return false;
  if (f.channel === "phone" && (l.whatsapp || l.instagram || !l.phones.length)) return false;
  if (!f.heat.has(l.heat)) return false;
  if (f.hideTracked && crm[l.id]) return false;
  if (f.city && norm(l.city) !== f.city) return false;
  if (f.q) {
    const hay = norm(`${l.name} ${l.street} ${l.city} ${l.type} ${l.postcode}`);
    if (!f.q.split(/\s+/).every((w) => hay.includes(w))) return false;
  }
  return true;
}

function filtered() {
  const f = state.filters;
  const crm = store.getCrm();
  const base = state.leads.filter((l) => passesBase(l, f, crm));
  const list = f.cats.size ? base.filter((l) => f.cats.has(l.cat)) : base;
  const by = {
    score: (a, b) => b.score - a.score || a.name.localeCompare(b.name, "pt"),
    name: (a, b) => a.name.localeCompare(b.name, "pt"),
    city: (a, b) => (a.city || "~").localeCompare(b.city || "~", "pt") || b.score - a.score,
    new: (a, b) => Number(state.newIds.has(b.id)) - Number(state.newIds.has(a.id)) || b.score - a.score,
  }[f.sort] || ((a, b) => b.score - a.score);
  list.sort(by);
  return { base, list };
}

function renderCats(base) {
  const counts = {};
  base.forEach((l) => { counts[l.cat] = (counts[l.cat] || 0) + 1; });
  const f = state.filters;
  $("#cats").innerHTML =
    `<button type="button" class="cat" data-cat="" aria-pressed="${f.cats.size === 0}">Todas <small>${n(base.length)}</small></button>` +
    CATEGORIES.map((c) => `<button type="button" class="cat" data-cat="${c.id}" aria-pressed="${f.cats.has(c.id)}" ${counts[c.id] ? "" : "disabled"}>${esc(c.short)} <small>${n(counts[c.id] || 0)}</small></button>`).join("");
}

function renderCities() {
  const counts = new Map();
  for (const l of state.leads) {
    if (!l.city) continue;
    const k = norm(l.city);
    const e = counts.get(k) || { label: l.city, n: 0 };
    e.n++;
    counts.set(k, e);
  }
  const opts = [...counts.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 120);
  $("#city").innerHTML = `<option value="">Todas as localidades</option>` +
    opts.map(([k, v]) => `<option value="${esc(k)}" ${state.filters.city === k ? "selected" : ""}>${esc(v.label)} (${v.n})</option>`).join("");
}

function stageLabel(id) {
  return PIPELINE_STAGES.find((s) => s.id === id)?.label || "";
}

function leadRow(l, crm) {
  const entry = crm[l.id];
  const phone = l.phones[0];
  const where = [l.street, l.city].filter(Boolean).join(", ");
  const tagNew = state.newIds.has(l.id) ? `<span class="tag-new">Novo</span>` : "";
  const tagStage = entry ? `<span class="tag-stage">${esc(stageLabel(entry.status))}</span>` : "";
  const wa = l.whatsapp
    ? `<a class="act act-wa" data-act="wa" href="${esc(whatsappLink(l, messageFor(l, waTemplate(l))))}" target="_blank" rel="noopener">${icon("wa")}WhatsApp</a>` : "";
  const ig = l.instagram
    ? `<a class="act act-ig" data-act="ig" href="https://instagram.com/${esc(l.instagram)}" target="_blank" rel="noopener" title="Copia a mensagem e abre o perfil">${icon("ig")}@${esc(l.instagram)}</a>` : "";
  const call = phone
    ? `<a class="act act-phone" data-act="call" href="tel:${esc(phone.e164)}">${icon("phone")}${esc(phone.display.replace("+351 ", ""))}</a>` : "";
  const reasons = l.reasons.map((r) => `<span class="reason${r === "Já tem website" ? " is-bad" : ""}">${esc(r)}</span>`).join("");
  return `<li class="lead heat-${l.heat}${state.newIds.has(l.id) ? " is-new" : ""}" data-id="${l.id}">
    <span class="lead-bar" aria-hidden="true"></span>
    <div class="lead-main">
      <h3 class="lead-name"><button type="button" data-act="open">${esc(l.name)}</button>${tagNew}${tagStage}</h3>
      <p class="lead-meta"><span>${esc(l.type)}</span>${where ? `<span>${icon("pin")}${esc(where)}</span>` : ""}</p>
    </div>
    <div class="lead-score" title="Pontuação: probabilidade de comprar um website"><b>${l.score}</b><small>${heatLabel(l.heat)}</small></div>
    <div class="lead-actions">
      ${wa}${ig}${call}
      <a class="act" data-act="google" href="${esc(googleCheckLink(l, l.districtName))}" target="_blank" rel="noopener" title="Pesquisar no Google se já tem site">${icon("google")}Verificar</a>
      <button type="button" class="act act-icon" data-act="map" title="Ver no mapa" aria-label="Ver ${esc(l.name)} no mapa">${icon("pin")}</button>
      <button type="button" class="act act-icon" data-act="save" aria-pressed="${Boolean(entry)}" title="${entry ? "No pipeline" : "Guardar no pipeline"}" aria-label="${entry ? "Já está no pipeline" : "Guardar no pipeline"}">${icon("star")}</button>
    </div>
    <div class="lead-reasons">${reasons}</div>
  </li>`;
}

let mapTimer = null;
function render({ fit = false } = {}) {
  const { base, list } = filtered();
  const crm = store.getCrm();
  const d = DISTRICT_BY_ID[state.district];
  const label = state.concelho ? `${state.concelho}, ${d.name}` : d?.name;

  $("#resultsTitle").textContent = d ? `Negócios sem website em ${label}` : "Escolhe um distrito para começar";
  $("#resultsSub").textContent = d
    ? (state.concelho ? "Pesquisa no concelho. Volta a “Todo o distrito” para ver tudo." : "Escolhe um concelho para afinar a pesquisa.")
    : "Os resultados aparecem aqui e no mapa.";
  renderCats(base);
  renderCities();

  const m = state.meta;
  const hot = list.filter((l) => l.heat === "quente").length;
  const wa = list.filter((l) => l.whatsapp).length;
  const ig = list.filter((l) => l.instagram).length;
  const sum = $("#summary");
  sum.hidden = !d;
  if (d && m) {
    const notes = [];
    if (m.truncated) notes.push(`<span class="warn">Mostramos os primeiros ${n(state.settings.maxResults)}; escolhe um concelho para ver todos.</span>`);
    if (m.partial) notes.push(`<span class="warn">Resposta parcial do servidor; escolhe um concelho para uma pesquisa completa.</span>`);
    if (m.approximate) notes.push(`<span class="warn">Limites aproximados (área oficial não encontrada).</span>`);
    sum.innerHTML = `<span class="sum-main"><b>${n(list.length)}</b> negócios</span>
      <span><b>${n(hot)}</b> quentes</span><span><b>${n(wa)}</b> com WhatsApp</span><span><b>${n(ig)}</b> com Instagram</span>
      <span class="sum-src">Atualizado às ${hhmm(m.fetchedAt)} via ${esc(m.endpoint || "cache")}</span>${notes.join("")}`;
  }

  const shown = list.slice(0, state.page * PAGE);
  $("#leadList").innerHTML = shown.map((l) => leadRow(l, crm)).join("");
  $("#more").hidden = list.length <= shown.length;
  $("#more").textContent = `Mostrar mais (${n(list.length - shown.length)} restantes)`;

  const empty = $("#empty");
  if (d && m && !list.length) {
    empty.hidden = false;
    empty.classList.remove("is-loading");
    const filtersOn = state.filters.q || state.filters.city || state.filters.channel !== "all" || state.filters.cats.size || state.filters.heat.size < 3 || state.filters.hideTracked;
    empty.innerHTML = `<div class="empty-tiles" aria-hidden="true"><span></span><span></span><span></span></div>
      <p class="empty-title">${filtersOn ? "Nenhum negócio com estes filtros" : "Sem negócios nesta zona"}</p>
      <p>${filtersOn ? "Alarga a pesquisa: tira algum filtro ou escolhe outra categoria." : "Experimenta o distrito inteiro ou outro concelho."}</p>
      ${filtersOn ? `<button type="button" class="btn btn-quiet" id="clearFilters">Limpar filtros</button>` : ""}`;
    $("#clearFilters")?.addEventListener("click", clearFilters);
  } else if (d) {
    empty.hidden = true;
  }

  clearTimeout(mapTimer);
  mapTimer = setTimeout(() => {
    if (!state.mapReady) return;
    const saved = new Set(Object.keys(crm));
    M.setLeads(list, { fit, savedIds: saved });
  }, fit ? 0 : 160);
}

function clearFilters() {
  const f = state.filters;
  f.q = ""; f.city = ""; f.channel = "all"; f.cats.clear(); f.heat = new Set(["quente", "morno", "frio"]); f.hideTracked = false;
  $("#q").value = "";
  $("#hideTracked").checked = false;
  syncFilterControls();
  state.page = 1;
  render();
}

function syncFilterControls() {
  $$("#channel button").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.v === state.filters.channel)));
  $$("#heat button").forEach((b) => b.setAttribute("aria-pressed", String(state.filters.heat.has(b.dataset.v))));
}

// ─────────────────────────── ações nos leads ───────────────────────────
function findLead(id) {
  return state.byId.get(id) || store.getEntry(id)?.lead || null;
}

function markContacted(lead, how) {
  const prev = store.getEntry(lead.id);
  if (prev && prev.status !== "guardado") return;
  store.updateEntry(lead, { status: "contactado", channel: how });
  feed(`Contactado por ${how}: ${lead.name}`, "good");
  refreshAfterCrm();
  toast(`${lead.name} passou para Contactado`, {
    action: { label: "Desfazer", fn: () => { prev ? store.updateEntry(lead, { status: prev.status }) : store.removeEntry(lead.id); refreshAfterCrm(); } },
  });
}

function toggleSave(lead) {
  if (store.getEntry(lead.id)) {
    openLead(lead);
    return;
  }
  store.updateEntry(lead, { status: "guardado" });
  feed(`Guardado no pipeline: ${lead.name}`);
  refreshAfterCrm();
  toast(`${lead.name} guardado no pipeline`, { action: { label: "Abrir ficha", fn: () => openLead(lead) } });
}

function handleLeadAction(act, lead, e) {
  if (!lead) return;
  switch (act) {
    case "wa": markContacted(lead, "WhatsApp"); break;
    case "ig": copyText(messageFor(lead, igTemplate())); toast(`Mensagem copiada. Cola-a no Direct de @${lead.instagram}.`); markContacted(lead, "Instagram"); break;
    case "call": markContacted(lead, "telefone"); break;
    case "open": e?.preventDefault(); openLead(lead); break;
    case "save": e?.preventDefault(); toggleSave(lead); break;
    case "map":
      e?.preventDefault();
      if (window.innerWidth <= 900) setMobileMode("map");
      M.highlight(lead.id);
      break;
    default: break;
  }
}

function refreshAfterCrm() {
  updatePipeCount();
  if (state.view === "search" && state.district) render();
  if (state.view === "pipeline") renderPipeline();
}

function updatePipeCount() {
  $("#pipeCount").textContent = Object.keys(store.getCrm()).length;
}

// ─────────────────────────── ficha do lead ───────────────────────────
function openLead(lead) {
  state.current = lead;
  const dlg = $("#leadDialog");
  const cat = CATEGORY_BY_ID[lead.cat];
  const d = DISTRICT_BY_ID[lead.district];
  $("#ldType").textContent = `${lead.type}${cat ? ", " + cat.label.toLowerCase() : ""}`;
  $("#ldName").textContent = lead.name;
  const addrParts = [];
  for (const part of [lead.street, lead.postcode, lead.city, d?.name]) {
    if (part && !addrParts.some((x) => norm(x) === norm(part))) addrParts.push(part);
  }
  $("#ldAddr").textContent = addrParts.join(", ");

  const contacts = [];
  lead.phones.forEach((p) => contacts.push(`<a class="act act-phone" href="tel:${esc(p.e164)}" data-ld="call">${icon("phone")}${esc(p.display)}${p.mobile ? " (telemóvel)" : ""}</a>`));
  if (lead.instagram) contacts.push(`<a class="act act-ig" href="https://instagram.com/${esc(lead.instagram)}" target="_blank" rel="noopener">${icon("ig")}@${esc(lead.instagram)}</a>`);
  if (lead.facebook) contacts.push(`<a class="act" href="${esc(lead.facebook)}" target="_blank" rel="noopener">${icon("fb")}Facebook</a>`);
  if (lead.email) contacts.push(`<a class="act" href="mailto:${esc(lead.email)}">${icon("mail")}${esc(lead.email)}</a>`);
  $("#ldContacts").innerHTML = contacts.join("");
  $("#ldReasons").innerHTML = [`<span class="reason"><b>${lead.score}</b> pontos, ${heatLabel(lead.heat).toLowerCase()}</span>`, ...lead.reasons.map((r) => `<span class="reason">${esc(r)}</span>`), lead.hours ? `<span class="reason">Horário: ${esc(lead.hours)}</span>` : ""].join("");

  const tplSel = $("#ldTemplate");
  const defaultTpl = lead.whatsapp ? waTemplate(lead) : lead.instagram ? igTemplate() : waTemplate(lead);
  tplSel.innerHTML = Object.entries(TEMPLATES).map(([id, t]) => `<option value="${id}" ${id === defaultTpl ? "selected" : ""}>${esc(t.label)}</option>`).join("");
  $("#ldMessage").value = messageFor(lead, defaultTpl);
  renderLeadSend();

  const entry = store.getEntry(lead.id);
  renderStages(entry?.status || null);
  $("#ldValue").value = entry?.value ?? "";
  $("#ldValue").placeholder = String(state.settings.sitePrice || "");
  $("#ldNote").value = entry?.note || "";
  $("#ldRemove").hidden = !entry;

  $("#ldLinks").innerHTML = `
    <a href="${esc(googleCheckLink(lead, d?.name))}" target="_blank" rel="noopener">${icon("google")}Verificar no Google</a>
    <a href="${esc(mapsLink(lead))}" target="_blank" rel="noopener">${icon("pin")}Abrir no Google Maps</a>
    <a href="https://www.openstreetmap.org/${esc(lead.osm)}" target="_blank" rel="noopener">${icon("map")}Ver no OpenStreetMap</a>
    <button type="button" class="link-btn" id="ldHasSite">Já tem website: descartar</button>`;
  $("#ldHasSite").addEventListener("click", () => {
    store.updateEntry(lead, { status: "perdido", note: [store.getEntry(lead.id)?.note, "Já tem website."].filter(Boolean).join(" ") });
    feed(`Descartado (já tem site): ${lead.name}`);
    refreshAfterCrm();
    dlg.close();
  });
  if (!dlg.open) dlg.showModal();
}

function renderLeadSend() {
  const lead = state.current;
  if (!lead) return;
  const msg = $("#ldMessage").value;
  const parts = [];
  if (lead.whatsapp) parts.push(`<a class="btn btn-wa" data-ld="wa" href="${esc(whatsappLink(lead, msg))}" target="_blank" rel="noopener">${icon("wa")}Enviar por WhatsApp</a>`);
  if (lead.instagram) parts.push(`<a class="btn btn-quiet" data-ld="ig" href="https://instagram.com/${esc(lead.instagram)}" target="_blank" rel="noopener">${icon("ig")}Copiar e abrir Instagram</a>`);
  if (lead.email) parts.push(`<a class="btn btn-quiet" data-ld="mail" href="mailto:${esc(lead.email)}?subject=${encodeURIComponent("Website para " + lead.name)}&body=${encodeURIComponent(msg)}">${icon("mail")}Enviar email</a>`);
  if (!lead.whatsapp && lead.phones[0]) parts.push(`<a class="btn btn-quiet" data-ld="call" href="tel:${esc(lead.phones[0].e164)}">${icon("phone")}Ligar ${esc(lead.phones[0].display)}</a>`);
  $("#ldSend").innerHTML = parts.join("");
}

function renderStages(current) {
  $("#ldStages").innerHTML = PIPELINE_STAGES.map((s) =>
    `<button type="button" role="radio" data-stage="${s.id}" aria-checked="${s.id === current}">${esc(s.label)}</button>`).join("");
}

function bindLeadDialog() {
  const dlg = $("#leadDialog");
  $("#ldTemplate").addEventListener("change", (e) => {
    $("#ldMessage").value = messageFor(state.current, e.target.value);
    renderLeadSend();
  });
  $("#ldMessage").addEventListener("input", renderLeadSend);
  $("#ldCopy").addEventListener("click", () => { copyText($("#ldMessage").value); toast("Mensagem copiada"); });
  $("#ldSend").addEventListener("click", (e) => {
    const a = e.target.closest("[data-ld]");
    if (!a) return;
    const lead = state.current;
    if (a.dataset.ld === "ig") { copyText($("#ldMessage").value); toast(`Mensagem copiada. Cola-a no Direct de @${lead.instagram}.`); }
    markContacted(lead, { wa: "WhatsApp", ig: "Instagram", mail: "email", call: "telefone" }[a.dataset.ld]);
    renderStages(store.getEntry(lead.id)?.status);
    $("#ldRemove").hidden = false;
  });
  $("#ldContacts").addEventListener("click", (e) => {
    if (e.target.closest('[data-ld="call"]')) { markContacted(state.current, "telefone"); renderStages(store.getEntry(state.current.id)?.status); }
  });
  $("#ldStages").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-stage]");
    if (!b) return;
    const lead = state.current;
    store.updateEntry(lead, { status: b.dataset.stage });
    renderStages(b.dataset.stage);
    $("#ldRemove").hidden = false;
    feed(`${lead.name}: ${stageLabel(b.dataset.stage)}`, b.dataset.stage === "fechado" ? "good" : "");
    if (b.dataset.stage === "fechado") toast(`Venda fechada: ${lead.name}`);
    refreshAfterCrm();
  });
  let noteTimer;
  const saveDetails = () => {
    const lead = state.current;
    const note = $("#ldNote").value.trim();
    const value = $("#ldValue").value;
    const entry = store.getEntry(lead.id);
    if (!entry && !note && !value) return;
    store.updateEntry(lead, { note, value: value === "" ? null : Number(value), status: entry?.status || "guardado" });
    if (!entry) renderStages("guardado");
    $("#ldRemove").hidden = false;
    updatePipeCount();
  };
  $("#ldNote").addEventListener("input", () => { clearTimeout(noteTimer); noteTimer = setTimeout(saveDetails, 500); });
  $("#ldValue").addEventListener("change", saveDetails);
  $("#ldRemove").addEventListener("click", () => {
    store.removeEntry(state.current.id);
    renderStages(null);
    $("#ldNote").value = "";
    $("#ldValue").value = "";
    $("#ldRemove").hidden = true;
    refreshAfterCrm();
  });
  dlg.addEventListener("close", () => {
    clearTimeout(noteTimer);
    if (state.current) saveDetails();
    refreshAfterCrm();
  });
}

// ─────────────────────────── pipeline ───────────────────────────
function renderPipeline() {
  const crm = store.getCrm();
  const q = norm($("#pipeQ").value);
  const entries = Object.entries(crm).map(([id, e]) => ({ id, ...e })).filter((e) => e.lead && (!q || norm(`${e.lead.name} ${e.lead.city} ${e.note}`).includes(q)));
  const all = Object.values(crm);
  const contacted = all.filter((e) => e.status !== "guardado").length;
  const positive = all.filter((e) => ["interessado", "fechado"].includes(e.status)).length;
  const closed = all.filter((e) => e.status === "fechado");
  const price = Number(state.settings.sitePrice) || 0;
  const revenue = closed.reduce((s, e) => s + (Number(e.value) || price), 0);
  const potential = all.filter((e) => e.status === "interessado").reduce((s, e) => s + (Number(e.value) || price), 0);
  $("#kpis").innerHTML = [
    ["Acompanhados", n(all.length)], ["Contactados", n(contacted)],
    ["Resposta positiva", contacted ? Math.round((positive / contacted) * 100) + "%" : "—"],
    ["Em negociação", eur(potential)], ["Fechados", n(closed.length)], ["Receita", eur(revenue)],
  ].map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("");

  $("#board").innerHTML = PIPELINE_STAGES.map((s) => {
    const items = entries.filter((e) => e.status === s.id).sort((a, b) => b.updated - a.updated);
    return `<section class="col" data-stage="${s.id}" aria-label="${esc(s.label)}">
      <header class="col-head"><span>${esc(s.label)}</span><small>${items.length}</small></header>
      ${items.map((e) => pipelineCard(e)).join("") || `<p class="col-empty">${s.id === "guardado" ? "Usa a estrela num lead para o guardar aqui." : "Arrasta para aqui."}</p>`}
    </section>`;
  }).join("");
}

function pipelineCard(e) {
  const l = e.lead;
  const d = DISTRICT_BY_ID[l.district];
  const wa = l.whatsapp ? `<a class="act act-wa" href="${esc(whatsappLink(l, messageFor(enrich({ ...l }), e.status === "guardado" ? waTemplate(l) : "seguimento")))}" target="_blank" rel="noopener" data-pact="wa">${icon("wa")}</a>` : "";
  const ph = l.phones?.[0] ? `<a class="act" href="tel:${esc(l.phones[0].e164)}" aria-label="Ligar">${icon("phone")}</a>` : "";
  const ig = l.instagram ? `<a class="act act-ig" href="https://instagram.com/${esc(l.instagram)}" target="_blank" rel="noopener" aria-label="Instagram">${icon("ig")}</a>` : "";
  return `<article class="pcard" draggable="true" data-id="${esc(e.id)}">
    <button type="button" class="pcard-name" data-pact="open">${esc(l.name)}</button>
    <p class="pcard-meta">${esc(l.type)}, ${esc(l.city || d?.name || "")}${e.value ? ` <span class="pcard-value">${eur(e.value)}</span>` : ""}</p>
    ${e.note ? `<p class="pcard-note">${esc(e.note)}</p>` : ""}
    <div class="pcard-foot">${wa}${ig}${ph}
      <select aria-label="Mudar estado" data-pact="stage">${PIPELINE_STAGES.map((s) => `<option value="${s.id}" ${s.id === e.status ? "selected" : ""}>${esc(s.label)}</option>`).join("")}</select>
    </div>
  </article>`;
}

function bindPipeline() {
  const board = $("#board");
  board.addEventListener("click", (ev) => {
    const card = ev.target.closest(".pcard");
    if (!card) return;
    const entry = store.getEntry(card.dataset.id);
    if (ev.target.closest('[data-pact="open"]')) openLead(enrich({ ...entry.lead }));
    if (ev.target.closest('[data-pact="wa"]') && entry.status === "guardado") { store.updateEntry(entry.lead, { status: "contactado" }); renderPipeline(); }
  });
  board.addEventListener("change", (ev) => {
    const sel = ev.target.closest('[data-pact="stage"]');
    if (!sel) return;
    const entry = store.getEntry(sel.closest(".pcard").dataset.id);
    store.updateEntry(entry.lead, { status: sel.value });
    feed(`${entry.lead.name}: ${stageLabel(sel.value)}`, sel.value === "fechado" ? "good" : "");
    refreshAfterCrm();
  });
  let dragId = null;
  board.addEventListener("dragstart", (ev) => {
    const card = ev.target.closest(".pcard");
    if (!card) return;
    dragId = card.dataset.id;
    card.classList.add("is-dragging");
    ev.dataTransfer.effectAllowed = "move";
    ev.dataTransfer.setData("text/plain", dragId);
  });
  board.addEventListener("dragend", (ev) => { ev.target.closest(".pcard")?.classList.remove("is-dragging"); $$(".col.is-over").forEach((c) => c.classList.remove("is-over")); });
  board.addEventListener("dragover", (ev) => {
    const col = ev.target.closest(".col");
    if (!col || !dragId) return;
    ev.preventDefault();
    $$(".col.is-over").forEach((c) => c !== col && c.classList.remove("is-over"));
    col.classList.add("is-over");
  });
  board.addEventListener("drop", (ev) => {
    const col = ev.target.closest(".col");
    if (!col || !dragId) return;
    ev.preventDefault();
    const entry = store.getEntry(dragId);
    dragId = null;
    if (entry && entry.status !== col.dataset.stage) {
      store.updateEntry(entry.lead, { status: col.dataset.stage });
      feed(`${entry.lead.name}: ${stageLabel(col.dataset.stage)}`, col.dataset.stage === "fechado" ? "good" : "");
      if (col.dataset.stage === "fechado") toast(`Venda fechada: ${entry.lead.name}`);
    }
    refreshAfterCrm();
    renderPipeline();
  });
  $("#pipeQ").addEventListener("input", renderPipeline);
}

function setView(view) {
  state.view = view;
  $$(".view-tab").forEach((b) => (b.dataset.view === view ? b.setAttribute("aria-current", "page") : b.removeAttribute("aria-current")));
  $("#view-search").hidden = view !== "search";
  $("#view-pipeline").hidden = view !== "pipeline";
  if (view === "pipeline") renderPipeline();
  else { M.invalidate(); if (state.district) render(); }
  window.scrollTo({ top: 0 });
}

// ─────────────────────────── varredura nacional ───────────────────────────
async function scanAll({ onlyMissing = false } = {}) {
  if (state.scan) return;
  const ctrl = new AbortController();
  state.scan = ctrl;
  const btn = $("#scanAll");
  btn.disabled = true;
  $("#scanStop").hidden = false;
  const list = [];
  for (const d of DISTRICTS) {
    const cached = await store.cacheGet(keyFor(d.id, ""));
    if (onlyMissing && cached) continue;
    list.push({ d, cached });
  }
  let found = 0;
  let failed = 0;
  feed(`Varredura nacional iniciada (${list.length} distritos)`);
  for (let i = 0; i < list.length; i++) {
    if (ctrl.signal.aborted) break;
    const { d, cached } = list[i];
    state.stats[d.id] = { ...(state.stats[d.id] || {}), scanning: true, error: false };
    updateTile(d.id);
    $("#scanStatus").textContent = `A analisar ${d.name} (${i + 1} de ${list.length}). ${n(found)} negócios encontrados até agora.`;
    setLive("loading", `Varredura: ${d.name}`);
    try {
      let entry = cached;
      if (!store.isFresh(cached)) {
        entry = await fetchAndStore(d, "", { signal: ctrl.signal, onStatus: (s) => setLive("loading", s) });
        await sleep(CONFIG.scanPauseMs, ctrl.signal);
      } else setStats(d.id, cached.leads);
      found += entry.leads.length;
      state.stats[d.id] = { ...state.stats[d.id], scanning: false };
      feed(`${d.name}: ${n(entry.leads.length)} negócios sem website`, "good");
      if (state.district === d.id && !state.concelho) { applyEntry(entry); render(); }
    } catch (err) {
      if (ctrl.signal.aborted) break;
      failed++;
      state.stats[d.id] = { ...state.stats[d.id], scanning: false, error: true };
      feed(`${d.name}: falhou (${err.message})`, "bad");
    }
    updateTile(d.id);
    updateTiles();
    if (state.mapReady && !state.district) M.showOverview(state.stats);
  }
  DISTRICTS.forEach((d) => { if (state.stats[d.id]) state.stats[d.id].scanning = false; updateTile(d.id); });
  const aborted = ctrl.signal.aborted;
  state.scan = null;
  btn.disabled = false;
  $("#scanStop").hidden = true;
  setLive("live", `Ao vivo, ${hhmm(Date.now())}`);
  const msg = aborted
    ? `Varredura parada. ${n(found)} negócios encontrados.`
    : `Varredura concluída: ${n(found)} negócios sem website${failed ? `, ${failed} distrito${failed > 1 ? "s" : ""} por repetir` : ""}.`;
  $("#scanStatus").textContent = msg;
  feed(msg, aborted || failed ? "" : "good");
  if (!aborted) toast(msg, { action: { label: "Abrir relatório", fn: openReport }, timeout: 9000 });
}

// ─────────────────────────── relatório ───────────────────────────
async function allCachedLeads() {
  const all = await store.cacheAll();
  const byId = new Map();
  const districts = new Set();
  all.sort((a, b) => (a.value?.fetchedAt || 0) - (b.value?.fetchedAt || 0));
  for (const { value } of all) {
    if (!value?.leads) continue;
    if (!value.concelho) districts.add(value.district);
    value.leads.forEach((l) => byId.set(l.id, l));
  }
  return { leads: [...byId.values()], districts };
}

const rpData = { all: null, current: null, pipeline: null };

async function openReport() {
  const dlg = $("#reportDialog");
  const { leads, districts } = await allCachedLeads();
  rpData.all = leads;
  rpData.current = state.district ? filtered().list : [];
  rpData.pipeline = Object.values(store.getCrm()).map((e) => e.lead).filter(Boolean);
  const d = DISTRICT_BY_ID[state.district];
  const scopes = [
    ["all", "Tudo o que já foi pesquisado", `${n(leads.length)} negócios em ${districts.size} distrito${districts.size === 1 ? "" : "s"}`],
    ["current", "Só a pesquisa atual, com os filtros", d ? `${n(rpData.current.length)} negócios em ${state.concelho || d.name}` : "Ainda não há pesquisa aberta"],
    ["pipeline", "Só o pipeline", `${n(rpData.pipeline.length)} negócios acompanhados`],
  ];
  const sel = $("#reportForm").dataset.scope || "all";
  $("#rpScope").innerHTML = scopes.map(([v, t, s]) =>
    `<label class="scope"><input type="radio" name="scope" value="${v}" ${v === sel ? "checked" : ""} ${v === "current" && !d ? "disabled" : ""}><b>${t}</b><small>${s}</small></label>`).join("");
  const missing = DISTRICTS.filter((x) => !districts.has(x.id));
  const miss = $("#rpMissing");
  miss.hidden = missing.length === 0;
  miss.innerHTML = missing.length
    ? `<span>Faltam ${missing.length} distrito${missing.length > 1 ? "s" : ""} para o relatório cobrir o país inteiro.</span><button type="button" class="btn btn-quiet btn-sm" id="rpScan">Varrer os que faltam</button>` : "";
  $("#rpScan")?.addEventListener("click", () => { dlg.close(); scanAll({ onlyMissing: true }); $("#heroTitle").scrollIntoView({ behavior: reduceMotion() ? "auto" : "smooth" }); });
  $("#rpEmail").value = $("#rpEmail").value || state.settings.reportEmail || "";
  $("#rpHint").textContent = "";
  updateReportPreview();
  if (!dlg.open) dlg.showModal();
}

function currentReport() {
  const scope = $('#rpScope input[name="scope"]:checked')?.value || "all";
  $("#reportForm").dataset.scope = scope;
  const leads = (rpData[scope] || []).map(enrich);
  const d = DISTRICT_BY_ID[state.district];
  const label = { all: "Todos os distritos pesquisados", current: d ? `Pesquisa em ${state.concelho || d.name}` : "Pesquisa atual", pipeline: "Pipeline de vendas" }[scope];
  return R.buildReport({ leads, crm: store.getCrm(), settings: state.settings, scope: label });
}

function updateReportPreview() {
  const r = currentReport();
  const t = r.totals;
  $("#rpPreview").innerHTML = [["Negócios", n(t.leads)], ["Quentes", n(t.quente)], ["Com WhatsApp", n(t.whatsapp)], ["Potencial", eur(t.potential)]]
    .map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("");
}

async function withBusy(btn, fn) {
  btn.classList.add("is-busy");
  try { await fn(); } catch (err) { toast(`Não foi possível gerar: ${err.message}`); } finally { btn.classList.remove("is-busy"); }
}

function bindReport() {
  $("#openReport").addEventListener("click", openReport);
  $("#rpScope").addEventListener("change", updateReportPreview);
  $("#reportDialog").addEventListener("click", (e) => {
    const b = e.target.closest("[data-rp]");
    if (!b) return;
    const report = currentReport();
    const kind = b.dataset.rp;
    if (!report.leads.length && kind !== "whatsapp" && report.entries.length === 0) {
      toast("Ainda não há dados. Pesquisa um distrito ou varre o país primeiro.");
      return;
    }
    if (kind === "pdf") withBusy(b, () => R.downloadPdf(report, { fullList: $("#rpFull").checked }).then(() => toast("PDF descarregado")));
    if (kind === "xlsx") withBusy(b, () => R.downloadXlsx(report).then(() => toast("Excel descarregado")));
    if (kind === "csv") { R.downloadCsv(report); toast("CSV descarregado"); }
    if (kind === "whatsapp") {
      const ph = parsePhone(state.settings.sellerPhone);
      const text = R.summaryText(report);
      const url = ph ? `https://wa.me/${ph.e164.replace("+", "")}?text=${encodeURIComponent(text)}` : `https://wa.me/?text=${encodeURIComponent(text)}`;
      window.open(url, "_blank", "noopener");
      if (!ph) $("#rpHint").textContent = "Dica: guarda o teu número nas Definições para o resumo ir diretamente para ti.";
    }
    if (kind === "email") {
      const to = $("#rpEmail").value.trim();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) { $("#rpEmail").focus(); $("#rpHint").textContent = "Escreve um email válido."; return; }
      if (to !== state.settings.reportEmail) { state.settings.reportEmail = to; store.saveSettings(state.settings); }
      withBusy(b, async () => {
        const res = await R.sendEmail(report, to);
        if (res.ok) {
          $("#rpHint").textContent = `Relatório enviado para ${to}.`;
          toast(`Relatório enviado para ${to}`);
          feed(`Relatório enviado por email para ${to}`, "good");
        } else {
          R.downloadBlob(res.xlsx, `relatorio-leads-${new Date().toISOString().slice(0, 10)}.xlsx`);
          const body = R.summaryText(report) + "\n\n(O ficheiro Excel com a lista completa foi descarregado — anexa-o a este email.)";
          window.location.href = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent("Relatório de leads")}&body=${encodeURIComponent(body.slice(0, 1800))}`;
          $("#rpHint").textContent = "O envio automático ainda não está ativo neste site (ver README). Descarregámos o Excel e abrimos o teu email com o resumo; anexa o ficheiro e envia.";
        }
      });
    }
  });
}

// ─────────────────────────── definições ───────────────────────────
function fillTplSelect(sel, value) {
  sel.innerHTML = Object.entries(TEMPLATES).map(([id, t]) => `<option value="${id}" ${id === value ? "selected" : ""}>${esc(t.label)}</option>`).join("");
}

let tplDraft = {};
function openSettings() {
  const s = state.settings;
  $("#stName").value = s.sellerName || "";
  $("#stPrice").value = s.sitePrice ?? "";
  $("#stPhone").value = s.sellerPhone || "";
  $("#stEmail").value = s.reportEmail || "";
  $("#stMax").value = s.maxResults;
  $("#stRefresh").value = String(s.autoRefreshMin ?? 10);
  $("#stChains").checked = Boolean(s.excludeChains);
  $("#stNoSite").checked = s.onlyNoSite !== false;
  fillTplSelect($("#stTplWa"), s.template || "primeiro");
  fillTplSelect($("#stTplIg"), s.templateIg || "instagram");
  fillTplSelect($("#stTplEdit"), "primeiro");
  tplDraft = { ...(s.templates || {}) };
  $("#stTplText").value = tplDraft.primeiro || TEMPLATES.primeiro.text;
  $("#settingsDialog").showModal();
}

function bindSettings() {
  $("#openSettings").addEventListener("click", openSettings);
  $("#stTplEdit").addEventListener("change", (e) => { $("#stTplText").value = tplDraft[e.target.value] || TEMPLATES[e.target.value].text; });
  $("#stTplText").addEventListener("input", (e) => { tplDraft[$("#stTplEdit").value] = e.target.value; });
  $("#stTplReset").addEventListener("click", () => { const id = $("#stTplEdit").value; delete tplDraft[id]; $("#stTplText").value = TEMPLATES[id].text; });
  $("#stSave").addEventListener("click", () => {
    const prevKey = state.district ? keyFor(state.district, state.concelho) : null;
    const prevMax = state.settings.maxResults;
    for (const id of Object.keys(tplDraft)) if (tplDraft[id] === TEMPLATES[id]?.text || !tplDraft[id]?.trim()) delete tplDraft[id];
    state.settings = {
      ...state.settings,
      sellerName: $("#stName").value.trim(),
      sitePrice: Number($("#stPrice").value) || 0,
      sellerPhone: $("#stPhone").value.trim(),
      reportEmail: $("#stEmail").value.trim(),
      maxResults: Math.max(100, Math.min(10000, Number($("#stMax").value) || CONFIG.defaults.maxResults)),
      autoRefreshMin: Number($("#stRefresh").value),
      excludeChains: $("#stChains").checked,
      onlyNoSite: $("#stNoSite").checked,
      template: $("#stTplWa").value,
      templateIg: $("#stTplIg").value,
      templates: tplDraft,
    };
    store.saveSettings(state.settings);
    $("#settingsDialog").close();
    toast("Definições guardadas");
    const changedQuery = (state.district && keyFor(state.district, state.concelho) !== prevKey) || prevMax !== state.settings.maxResults;
    if (state.district) changedQuery ? runSearch({ force: prevMax !== state.settings.maxResults }) : render();
  });
  $("#stExport").addEventListener("click", () => {
    const data = { app: "leadradar", version: 1, exportedAt: new Date().toISOString(), crm: store.getCrm(), settings: state.settings };
    R.downloadBlob(new Blob([JSON.stringify(data, null, 1)], { type: "application/json" }), `leadradar-pipeline-${new Date().toISOString().slice(0, 10)}.json`);
  });
  $("#stImport").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (data.app !== "leadradar" || typeof data.crm !== "object") throw new Error("ficheiro inválido");
      let count = 0;
      for (const [id, entry] of Object.entries(data.crm)) {
        if (!entry?.lead?.id) continue;
        const cur = store.getEntry(id);
        if (!cur || (entry.updated || 0) > (cur.updated || 0)) { store.updateEntry(entry.lead, { ...entry, lead: undefined }); count++; }
      }
      toast(`${count} negócio${count === 1 ? "" : "s"} importado${count === 1 ? "" : "s"} para o pipeline`);
      refreshAfterCrm();
    } catch (err) {
      toast(`Não foi possível importar: ${err.message}`);
    }
    e.target.value = "";
  });
  $("#stClear").addEventListener("click", async () => {
    await store.cacheClear();
    state.stats = {};
    updateTiles();
    toast("Resultados guardados apagados. O pipeline mantém-se.");
  });
}

// ─────────────────────────── tempo real ───────────────────────────
function tick() {
  const m = state.meta;
  const every = Number(state.settings.autoRefreshMin) || 0;
  if (!m || !state.district || state.loading || document.hidden) return;
  if (every > 0 && Date.now() - m.fetchedAt > every * 60000) {
    feed(`Atualização automática de ${state.concelho || DISTRICT_BY_ID[state.district].name}`);
    runSearch({ force: true, silent: true });
  }
}

// ─────────────────────────── mapa ───────────────────────────
function popupFor(l) {
  const el = document.createElement("div");
  const phone = l.phones[0];
  el.innerHTML = `<div class="pop-name">${esc(l.name)}</div>
    <div class="pop-meta">${esc(l.type)}${l.city ? ", " + esc(l.city) : ""}. ${l.score} pontos</div>
    <div class="pop-actions">
      ${l.whatsapp ? `<a class="pop-wa" data-act="wa" href="${esc(whatsappLink(l, messageFor(enrich(l), waTemplate(l))))}" target="_blank" rel="noopener">${icon("wa")}WhatsApp</a>` : ""}
      ${l.instagram ? `<a data-act="ig" href="https://instagram.com/${esc(l.instagram)}" target="_blank" rel="noopener">${icon("ig")}Instagram</a>` : ""}
      ${phone ? `<a data-act="call" href="tel:${esc(phone.e164)}">${icon("phone")}Ligar</a>` : ""}
      <button type="button" data-act="open">Ficha</button>
    </div>`;
  el.addEventListener("click", (e) => {
    const a = e.target.closest("[data-act]");
    if (a) handleLeadAction(a.dataset.act, l, a.dataset.act === "open" ? e : null);
  });
  return el;
}

function setMobileMode(mode) {
  $(".results").dataset.mode = mode;
  $$(".mobile-toggle button").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.mode === mode)));
  if (mode === "map") setTimeout(() => M.invalidate({ refit: true }), 30);
}

function setupMap() {
  if (!window.L || !window.L.markerClusterGroup) {
    $("#map").innerHTML = `<p class="hint" style="padding:16px">Não foi possível carregar o mapa. A lista continua a funcionar.</p>`;
    return;
  }
  M.initMap($("#map"), {
    onSelectLead: (l) => {
      const row = $(`.lead[data-id="${l.id}"]`);
      $$(".lead.is-focus").forEach((r) => r.classList.remove("is-focus"));
      if (row) { row.classList.add("is-focus"); if (window.innerWidth > 900) row.scrollIntoView({ block: "nearest", behavior: reduceMotion() ? "auto" : "smooth" }); }
    },
    onSelectDistrict: (id) => selectDistrict(id, { scroll: false }),
    buildPopup: popupFor,
  });
  state.mapReady = true;
  if (!state.district) M.showOverview(state.stats);
}

// ─────────────────────────── eventos ───────────────────────────
function bindSearch() {
  $("#concelho").addEventListener("change", (e) => selectDistrict(state.district, { concelho: e.target.value }));
  $("#refresh").addEventListener("click", () => runSearch({ force: true }));
  let qTimer;
  $("#q").addEventListener("input", (e) => { clearTimeout(qTimer); qTimer = setTimeout(() => { state.filters.q = norm(e.target.value); state.page = 1; render(); }, 140); });
  $("#city").addEventListener("change", (e) => { state.filters.city = e.target.value; state.page = 1; render(); });
  $("#sort").addEventListener("change", (e) => { state.filters.sort = e.target.value; state.page = 1; render(); });
  $("#hideTracked").addEventListener("change", (e) => { state.filters.hideTracked = e.target.checked; state.page = 1; render(); });
  $("#channel").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-v]");
    if (!b) return;
    state.filters.channel = b.dataset.v;
    syncFilterControls();
    state.page = 1;
    render();
  });
  $("#heat").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-v]");
    if (!b) return;
    const h = state.filters.heat;
    h.has(b.dataset.v) ? h.delete(b.dataset.v) : h.add(b.dataset.v);
    syncFilterControls();
    state.page = 1;
    render();
  });
  $("#cats").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-cat]");
    if (!b) return;
    const id = b.dataset.cat;
    const c = state.filters.cats;
    if (!id) c.clear();
    else c.has(id) ? c.delete(id) : c.add(id);
    state.page = 1;
    render();
  });
  $("#more").addEventListener("click", () => { state.page++; render(); });
  $("#leadList").addEventListener("click", (e) => {
    const a = e.target.closest("[data-act]");
    if (!a) return;
    const lead = findLead(a.closest(".lead")?.dataset.id);
    handleLeadAction(a.dataset.act, lead, e);
  });
  $$(".mobile-toggle button").forEach((b) => b.addEventListener("click", () => setMobileMode(b.dataset.mode)));
  $("#scanAll").addEventListener("click", () => scanAll());
  $("#scanStop").addEventListener("click", () => state.scan?.abort());
  $$(".view-tab").forEach((b) => b.addEventListener("click", () => setView(b.dataset.view)));
}

function readHash() {
  const p = new URLSearchParams(location.hash.slice(1));
  return { d: p.get("distrito"), c: p.get("concelho") || "" };
}

async function init() {
  document.title = `${CONFIG.brand} — negócios sem website em Portugal`;
  $$("[data-brand]").forEach((el) => { el.textContent = CONFIG.brand; });
  if (CONFIG.supportEmail) $("#supportLine").innerHTML = `Suporte: <a href="mailto:${esc(CONFIG.supportEmail)}">${esc(CONFIG.supportEmail)}</a>`;
  $(".results").dataset.mode = "list";
  buildTiles();
  bindSearch();
  bindLeadDialog();
  bindPipeline();
  bindReport();
  bindSettings();
  updatePipeCount();
  await loadStatsFromCache();
  setupMap();

  store.onSync((msg) => {
    if (msg.type === "crm") {
      store.reloadCrm();
      if (msg.name) feed(`Noutra janela: ${msg.name}${msg.status ? " passou a " + stageLabel(msg.status) : " saiu do pipeline"}`);
      refreshAfterCrm();
    }
    if (msg.type === "settings") state.settings = store.getSettings();
  });
  window.addEventListener("storage", (e) => { if (e.key === "leadradar:crm") { store.reloadCrm(); refreshAfterCrm(); } });
  window.addEventListener("hashchange", () => {
    const { d, c } = readHash();
    if (d && DISTRICT_BY_ID[d] && (d !== state.district || c !== state.concelho)) selectDistrict(d, { concelho: c, updateHash: false });
  });
  document.addEventListener("visibilitychange", () => { if (!document.hidden) tick(); });
  setInterval(tick, 20000);

  const { d, c } = readHash();
  if (d && DISTRICT_BY_ID[d]) selectDistrict(d, { concelho: c, updateHash: false });
  else feed("Pronto. Escolhe um distrito ou varre Portugal inteiro.");

  if (!state.settings.sellerName && !store.getUi("hintedName", false)) {
    store.setUi("hintedName", true);
    setTimeout(() => toast("Põe o teu nome e preço nas Definições para personalizar as mensagens.", { action: { label: "Abrir", fn: openSettings }, timeout: 9000 }), 1200);
  }
}

init();
