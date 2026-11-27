// Interface do funil: Encontradas → Escritas → Enviadas → Respostas.
import { api, qs, ApiError } from "./api.js";

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const icon = (id) => `<svg class="ic" aria-hidden="true"><use href="#i-${id}"/></svg>`;
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : "—");
const PAGE = 50;

const S = {
  me: null, team: [], settings: null, regioes: [], nichos: [],
  sel: { campanha: "ultima", pessoa: "" },
  f: { etapa: "", so_etapa: "", tipo: "", resultado: "", nome: "" },
  stats: null, campaigns: [], running: null,
  leads: [], total: 0, page: 0,
  dirty: new Set(), shown: {}, stepState: {}, firstPaint: true,
  startKey: null, pollTimer: null, listCtrl: null,
};

// ───────────── utilitários de UI ─────────────
function toast(text, { undo, bad = false, timeout = 5000 } = {}) {
  const host = $("dialog[open] .toasts") || $("#toasts");
  const el = document.createElement("div");
  el.className = "toast" + (bad ? " is-bad" : "");
  el.innerHTML = `<span>${esc(text)}</span>${undo ? '<button type="button" class="btn btn-ghost btn-sm">Anular</button>' : ""}`;
  let done = false;
  const close = () => { if (!done) { done = true; el.remove(); } };
  if (undo) el.querySelector("button").addEventListener("click", async () => { close(); try { await undo(); toast("Anulado."); } catch (e) { toast(e.message, { bad: true }); } });
  host.append(el);
  while (host.children.length > 3) host.firstElementChild.remove();
  setTimeout(close, timeout);
}
const fail = (e) => { if (e?.name !== "AbortError" && e?.status !== 401) toast(e.message || "Erro inesperado.", { bad: true }); };

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; }
  catch {
    const ta = Object.assign(document.createElement("textarea"), { value: text });
    ta.style.position = "fixed"; ta.style.opacity = "0"; document.body.append(ta); ta.select();
    let ok = false; try { ok = document.execCommand("copy"); } catch { /* */ }
    ta.remove(); return ok;
  }
}

function countUp(el, to) {
  const from = Number(el.dataset.v || 0);
  el.dataset.v = to;
  if (from === to) { el.textContent = to; return; }
  if (reduced() || S.firstPaint) { el.textContent = to; return; }
  const t0 = performance.now();
  const step = (t) => {
    const k = Math.min(1, (t - t0) / 500), e = 1 - (1 - k) ** 3;
    el.textContent = Math.round(from + (to - from) * e);
    if (k < 1 && el.dataset.v == to) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

const newKey = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36)).replace(/[^A-Za-z0-9_-]/g, "");

// ───────────── sessão ─────────────
async function boot() {
  try {
    if (!(await api("/api/session")).autenticado) return showLogin();
    const me = await api("/api/me");
    Object.assign(S, { me: me.user, team: me.team, settings: me.settings, regioes: me.regioes, nichos: me.nichos });
    $("#tempBanner").hidden = !me.temporario;
    showApp();
  } catch (e) {
    if (e.status === 401) showLogin(); else { showLogin(); $("#loginError").textContent = e.message; }
  }
}

function showLogin() {
  stopPolling();
  $("#app").hidden = true; $("#login").hidden = false;
  setTimeout(() => $("#loginForm [name=username]").focus(), 0);
}

$("#loginForm").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const f = ev.currentTarget, btn = f.querySelector("button[type=submit]");
  const username = f.username.value.trim(), password = f.password.value;
  $("#loginError").textContent = "";
  if (!username || !password) { $("#loginError").textContent = "Preenche o utilizador e a palavra-passe."; return; }
  btn.disabled = true; btn.textContent = "A entrar…";
  try { await api("/api/login", { method: "POST", body: { username, password } }); f.password.value = ""; await boot(); }
  catch (e) { $("#loginError").textContent = e.message; }
  finally { btn.disabled = false; btn.textContent = "Entrar"; }
});

window.addEventListener("funil:unauth", () => { if (!$("#app").hidden) { toast("A sessão expirou. Entra outra vez.", { bad: true }); showLogin(); } });

$("#logout").addEventListener("click", async () => { try { await api("/api/logout", { method: "POST", body: {} }); } catch { /* */ } location.reload(); });

function showApp() {
  $("#login").hidden = true; $("#app").hidden = false;
  const owner = S.me.role === "dono";
  $("#who").textContent = `${S.me.nome} · ${owner ? "dono" : "membro"}`;
  $("#openSettings").hidden = !owner;
  $("#pessoaWrap").hidden = !owner;
  fillSelectors();
  refreshAll(true);
}

function fillSelectors() {
  const saved = (() => { try { return JSON.parse(localStorage.getItem("funil:params") || "{}"); } catch { return {}; } })();
  $("#nicho").innerHTML = `<option value="todos">Todos</option>` + S.nichos.map((n) => `<option value="${esc(n.id)}">${esc(n.nome)}</option>`).join("");
  $("#regiao").innerHTML = S.regioes.map((r) => `<option value="${esc(r.id)}">${esc(r.nome)}</option>`).join("");
  if (saved.nicho && S.nichos.some((n) => n.id === saved.nicho)) $("#nicho").value = saved.nicho;
  $("#regiao").value = S.regioes.some((r) => r.id === saved.regiao) ? saved.regiao : "lisboa";
  fillConcelhos(saved.concelho);
  if (S.me.role === "dono") $("#pessoa").innerHTML = `<option value="">Equipa</option>` + S.team.map((u) => `<option value="${u.id}">${esc(u.nome)}</option>`).join("");
}
function fillConcelhos(value = "") {
  const r = S.regioes.find((x) => x.id === $("#regiao").value);
  $("#concelho").innerHTML = `<option value="">Todos</option>` + (r?.concelhos || []).map((c) => `<option>${esc(c)}</option>`).join("");
  if (value && r?.concelhos.includes(value)) $("#concelho").value = value;
}
function saveParams() { try { localStorage.setItem("funil:params", JSON.stringify({ nicho: $("#nicho").value, regiao: $("#regiao").value, concelho: $("#concelho").value })); } catch { /* */ } }
$("#regiao").addEventListener("change", () => { fillConcelhos(); saveParams(); });
$("#nicho").addEventListener("change", saveParams);
$("#concelho").addEventListener("change", saveParams);

// ───────────── dados ─────────────
const scopeQ = () => ({ campanha: S.sel.campanha, pessoa: S.sel.pessoa });

async function refreshAll(resetList = false) {
  try {
    const [st, cs] = await Promise.all([api("/api/stats?" + qs(scopeQ())), api("/api/campaigns")]);
    S.campaigns = cs.campanhas;
    S.running = cs.campanhas.find((c) => c.estado === "a_correr" && c.criada_por === S.me.id) || null;
    const changed = JSON.stringify(st.counts) !== JSON.stringify(S.stats?.counts) || st.campanha?.estado !== S.stats?.campanha?.estado;
    S.stats = st;
    renderCampaignSelect();
    renderFunnel();
    if (resetList) await loadLeads(true);
    else if (changed) await loadLeads(false, true);
  } catch (e) { fail(e); }
  schedulePoll();
}

function schedulePoll() {
  stopPolling();
  const c = S.stats?.counts;
  const busy = S.running || (c && c.por_escrever > 0);
  if (busy) drive();
  S.pollTimer = setTimeout(() => { if (!document.hidden || busy) refreshAll(); else schedulePoll(); }, busy ? 1200 : 10000);
}

// O servidor é serverless: a pesquisa e a escrita avançam por passos curtos que este separador vai pedindo.
// Tudo fica guardado no servidor; fechar ou recarregar a página retoma do ponto onde estava.
let driving = false;
async function drive() {
  if (driving) return;
  driving = true;
  let errors = 0;
  try {
    for (;;) {
      const c = S.stats?.counts;
      const tasks = [];
      if (S.running) tasks.push(api(`/api/campaigns/${S.running.id}/step`, { method: "POST", body: {} }));
      if (c && c.por_escrever > 0) tasks.push(api("/api/write", { method: "POST", body: {} }));
      if (!tasks.length) break;
      try { await Promise.all(tasks); errors = 0; }
      catch (e) { if (e.status === 401 || ++errors >= 5) throw e; await new Promise((r) => setTimeout(r, 1000 * errors)); }
      await refreshAll(false, { fromDriver: true });
      await new Promise((r) => setTimeout(r, 150));
    }
  } catch (e) { fail(e); }
  finally { driving = false; }
}
function stopPolling() { clearTimeout(S.pollTimer); }

async function loadLeads(reset, keepPages = false) {
  if (S.listCtrl) S.listCtrl.abort();
  const ctrl = (S.listCtrl = new AbortController());
  const list = $("#list");
  if (reset) { S.page = 0; S.leads = []; list.innerHTML = '<div class="skel"></div><div class="skel"></div><div class="skel"></div>'; list.setAttribute("aria-busy", "true"); }
  const limit = keepPages ? Math.min(100, Math.max(PAGE, S.leads.length)) : PAGE;
  const page = keepPages ? 0 : S.page;
  try {
    const r = await api("/api/leads?" + qs({ ...scopeQ(), ...S.f, limite: limit, pagina: page }), { signal: ctrl.signal });
    S.total = r.total;
    if (keepPages || reset) S.leads = r.leads; else S.leads = S.leads.concat(r.leads);
    renderList();
  } catch (e) { if (e.name !== "AbortError") { fail(e); if (reset) list.innerHTML = `<div class="empty"><strong>Não foi possível carregar os leads.</strong><span>${esc(e.message)}</span><button class="btn btn-ghost" data-act="reload">Tentar de novo</button></div>`; } }
  finally { if (S.listCtrl === ctrl) list.setAttribute("aria-busy", "false"); }
}

// ───────────── funil ─────────────
function stepStates(c, camp) {
  const running = camp?.estado === "a_correr";
  const st = {};
  st.encontrada = running ? "active" : camp?.estado === "erro" ? "error" : c.encontradas > 0 ? "done" : "idle";
  if (c.falhas_escrita > 0) st.escrita = "error";
  else if (c.por_escrever > 0) st.escrita = "active";
  else st.escrita = c.escritas > 0 && !running ? "done" : c.escritas > 0 ? "active" : "idle";
  st.enviada = c.fila_envio > 0 && c.escritas > 0 ? (st.escrita === "done" || c.enviadas > 0 ? "active" : "idle") : c.enviadas > 0 ? "done" : "idle";
  st.respondida = c.enviadas === 0 ? "idle" : c.respostas >= c.enviadas ? "done" : st.enviada === "done" || c.respostas > 0 ? "active" : "idle";
  return st;
}

function renderFunnel() {
  const { counts: c, campanha: camp } = S.stats;
  const runningShown = S.running || (camp?.estado === "a_correr" ? camp : null);
  $("#funnel").dataset.running = String(!!runningShown);
  for (const el of $$("[data-count]")) countUp(el, c[el.dataset.count]);
  $('[data-conv="escritas"]').textContent = c.encontradas ? `↓ ${pct(c.escritas, c.encontradas)}` : "";
  $('[data-conv="enviadas"]').textContent = c.escritas ? `↓ ${pct(c.enviadas, c.escritas)}` : "";
  $('[data-conv="respostas"]').textContent = c.enviadas ? `↓ ${pct(c.respostas, c.enviadas)}` : "";
  $("#rateSub").textContent = `taxa de resposta ${c.taxa == null ? "—" : Math.round(c.taxa * 100) + "%"}`;

  const st = stepStates(c, camp);
  const order = ["encontrada", "escrita", "enviada", "respondida"];
  let fill = 0;
  order.forEach((k, i) => {
    const li = $(`.step[data-step="${k}"]`);
    li.dataset.state = st[k];
    if (st[k] === "done" || st[k] === "active") fill = Math.max(fill, st[k] === "done" ? Math.min(i + 1, 3) : i);
    const prev = S.stepState[k];
    if (!S.firstPaint && prev && prev !== "done" && st[k] === "done") {
      const label = { encontrada: `Encontradas concluído: ${c.encontradas} empresas.`, escrita: `Escritas concluído: ${c.escritas} mensagens.`, enviada: `Enviadas concluído: ${c.enviadas} envios.`, respondida: `Respostas: todas as enviadas responderam.` }[k];
      $("#announcer").textContent = label;
    }
  });
  S.stepState = st;
  $("#steps").style.setProperty("--fill", String(fill / 3));

  // Notas por passo
  const nf = $("#noteFound");
  const parts = [];
  if (camp) {
    if (camp.ignoradas) parts.push(`${camp.ignoradas} ignoradas (já contactadas ou excluídas)`);
    if (camp.invalidas) parts.push(`${camp.invalidas} sem telefone válido`);
    if (camp.estado === "cancelada") parts.push("Pesquisa cancelada");
  }
  nf.innerHTML = esc(parts.join(" · "));
  if (camp?.estado === "erro") nf.innerHTML = `<span>${esc(camp.erro || "A pesquisa falhou.")}</span><button type="button" class="btn btn-bad btn-sm" data-act="retry-search">${icon("refresh")}Tentar de novo</button>`;
  $("#noteWrite").innerHTML = c.falhas_escrita
    ? `<span>${c.falhas_escrita} falharam.</span><button type="button" class="btn btn-bad btn-sm" data-act="retry-writes">${icon("refresh")}Tentar de novo</button>`
    : c.por_escrever ? esc(`A escrever… faltam ${c.por_escrever}`) : "";
  $("#noteSend").textContent = c.fila_envio ? `${c.fila_envio} prontas a enviar` : "";
  $("#noteReply").textContent = c.interessados ? `${c.interessados} interessados` : "";
  $("#meetings").textContent = c.reunioes ? `${c.reunioes} ${c.reunioes === 1 ? "reunião marcada" : "reuniões marcadas"}` : "";
  $("#sprintCount").textContent = c.fila_envio;
  $("#sprintBtn").disabled = !c.fila_envio;
  $("#followBtn").hidden = !c.followups;
  $("#followCount").textContent = c.followups;

  // Quota diária
  const q = $("#quota"), used = S.stats.envios_hoje, lim = S.stats.limite_diario;
  q.textContent = `${used}/${lim} hoje`;
  q.classList.toggle("is-near", used >= lim * 0.8 && used < lim);
  q.classList.toggle("is-full", used >= lim);

  // START
  const btn = $("#startBtn");
  if (S.running) { btn.dataset.state = "running"; $("#startLabel").textContent = "A procurar…"; btn.disabled = true; $("#cancelBtn").hidden = false; }
  else { btn.disabled = false; $("#cancelBtn").hidden = true; const any = S.campaigns.some((x) => x.criada_por === S.me.id); btn.dataset.state = any ? "done" : "idle"; $("#startLabel").textContent = any ? "Nova pesquisa" : "Começar"; }

  const shown = runningShown || camp;
  const reg = (id) => S.regioes.find((r) => r.id === id)?.nome || id;
  const nic = (id) => (id === "todos" ? "Todos os nichos" : S.nichos.find((n) => n.id === id)?.nome || id);
  $("#campaignInfo").textContent = shown
    ? `${nic(shown.nicho)} · ${shown.concelho ? shown.concelho + ", " : ""}${reg(shown.regiao)}${S.me.role === "dono" && shown.autor ? " · " + shown.autor : ""}`
    : S.sel.campanha === "todas" ? "Todas as campanhas" : "Escolhe um nicho e uma região para começar.";
  S.firstPaint = false;
}

function renderCampaignSelect() {
  const sel = $("#campanha"), cur = S.sel.campanha;
  const label = (c) => `#${c.id} · ${c.nicho === "todos" ? "Todos" : S.nichos.find((n) => n.id === c.nicho)?.nome || c.nicho} · ${S.regioes.find((r) => r.id === c.regiao)?.nome || c.regiao}`;
  const html = `<option value="ultima">Última</option><option value="todas">Todas</option>` + S.campaigns.map((c) => `<option value="${c.id}">${esc(label(c))}</option>`).join("");
  if (sel.dataset.html !== html) { sel.innerHTML = html; sel.dataset.html = html; sel.value = cur; if (sel.value !== cur) { sel.value = "ultima"; S.sel.campanha = "ultima"; } }
}

$("#campanha").addEventListener("change", (e) => { S.sel.campanha = e.target.value; refreshAll(true); });
$("#pessoa").addEventListener("change", (e) => { S.sel.pessoa = e.target.value; refreshAll(true); });

$("#steps").addEventListener("click", (e) => {
  const b = e.target.closest("[data-filter]");
  if (!b) return;
  const on = b.getAttribute("aria-pressed") !== "true";
  $$("#steps [data-filter]").forEach((x) => x.setAttribute("aria-pressed", "false"));
  b.setAttribute("aria-pressed", String(on));
  S.f.etapa = on ? b.dataset.filter : "";
  S.f.so_etapa = ""; $("#fEtapa").value = "";
  loadLeads(true);
});

// START idempotente: a mesma chave é reutilizada até haver resposta (duplo clique = 1 campanha).
$("#startBtn").addEventListener("click", () => startSearch());
async function startSearch(params) {
  const btn = $("#startBtn");
  if (btn.dataset.pending === "1") return;
  btn.dataset.pending = "1"; btn.disabled = true;
  S.startKey = S.startKey || newKey();
  const body = params || { nicho: $("#nicho").value, regiao: $("#regiao").value, concelho: $("#concelho").value };
  try {
    const r = await api("/api/campaigns", { method: "POST", body: { ...body, request_key: S.startKey } });
    if (r.existente && r.campanha.estado === "a_correr") toast("Já tens uma pesquisa a correr.");
    S.sel.campanha = "ultima"; $("#campanha").value = "ultima";
    S.f.etapa = ""; $$("#steps [data-filter]").forEach((x) => x.setAttribute("aria-pressed", "false"));
    S.startKey = null;
    await refreshAll(true);
  } catch (e) { fail(e); if (e.status !== 0) S.startKey = null; }
  finally { btn.dataset.pending = "0"; if (!S.running) btn.disabled = false; }
}
$("#cancelBtn").addEventListener("click", async () => {
  if (!S.running) return;
  try { await api(`/api/campaigns/${S.running.id}/cancel`, { method: "POST", body: {} }); toast("Pesquisa cancelada. Os leads encontrados ficaram guardados."); } catch (e) { fail(e); }
  refreshAll();
});

// ───────────── lista de leads ─────────────
const STAGE = { encontrada: "Por escrever", escrita: "Escrita", enviada: "Enviada", respondida: "Respondida" };
const RES = { interessado: ["Interessado", "b-ok"], reuniao: ["Reunião marcada", "b-ok"], sem_interesse: ["Sem interesse", "b-bad"] };

function cardHTML(l) {
  const owner = S.me.role === "dono";
  const badges = [
    l.tipo_tel === "movel" ? `<span class="badge b-wa">${icon("wa")}WhatsApp</span>` : `<span class="badge b-fixo">${icon("phone")}Fixo</span>`,
    l.site_tipo === "so_redes" ? `<span class="badge b-redes">Só redes sociais</span>` : "",
    `<span class="badge b-stage">${STAGE[l.etapa]}</span>`,
    l.resultado ? `<span class="badge ${RES[l.resultado][1]}">${RES[l.resultado][0]}</span>` : "",
    l.followup ? `<span class="badge b-follow">${icon("clock")}Follow-up</span>` : "",
    l.followup_em ? `<span class="badge">Follow-up enviado</span>` : "",
    l.mensagem_origem === "template" && l.etapa === "escrita" ? `<span class="badge b-tpl">template</span>` : "",
    l.mensagem_origem === "editada" && l.etapa === "escrita" ? `<span class="badge b-tpl">editada</span>` : "",
    l.excluida && l.resultado !== "sem_interesse" ? `<span class="badge b-bad">${icon("ban")}Não contactar</span>` : "",
    l.invalido ? `<span class="badge b-bad">Número inválido</span>` : "",
  ].join("");
  const rating = l.avaliacao != null ? `<span class="rating">${icon("star")}${esc(String(l.avaliacao).replace(".", ","))} (${esc(l.n_avaliacoes)})</span>` : "";
  const meta = `<p class="meta"><span>${esc(l.categoria)}</span>${l.cidade ? `<span>${esc(l.cidade)}</span>` : ""}${rating}<span>${esc(l.telefone)}</span></p>`;
  const blocked = l.excluida || l.invalido;
  let body = "";
  const editable = (l.etapa === "encontrada" || l.etapa === "escrita") && !blocked;
  if (l.etapa === "encontrada" && l.falha_escrita) {
    body = `<p class="err-line">Não foi possível escrever: ${esc(l.falha_escrita)} <button type="button" class="btn btn-bad btn-sm" data-act="retry">${icon("refresh")}Tentar de novo</button></p>`;
  } else if (l.etapa === "encontrada" && !blocked) {
    body = `<p class="meta">A escrever a mensagem…</p>`;
  }
  if (l.mensagem && l.etapa !== "encontrada") {
    body += `<div><textarea class="msg" data-msg aria-label="Mensagem para ${esc(l.nome)}" maxlength="1000" ${editable ? "" : "readonly"}>${esc(l.mensagem)}</textarea>
      <div class="msg-bar"><span data-chars>${l.mensagem.length} caracteres</span>${editable ? `<span class="actions"><button type="button" class="btn btn-ghost btn-sm" data-act="regen">${icon("refresh")}Regenerar</button><button type="button" class="btn btn-ghost btn-sm" data-act="save" disabled>Guardar</button></span>` : ""}</div></div>`;
  }
  if (l.guiao && l.etapa === "escrita" && !blocked) body += `<ol class="script" aria-label="Guião de chamada">${l.guiao.map((s) => `<li>${esc(s)}</li>`).join("")}</ol>`;

  let acts = "";
  if (!blocked && l.etapa === "escrita") {
    acts = l.tipo_tel === "movel" && l.wa
      ? `<a class="btn btn-wa" href="${esc(l.wa)}" target="_blank" rel="noopener noreferrer" data-act="open-wa">${icon("wa")}Abrir WhatsApp</a>
         <button type="button" class="btn btn-ghost" data-act="copy">${icon("copy")}Copiar mensagem</button>
         <button type="button" class="btn btn-ok" data-act="send">${icon("check")}Marcar enviada</button>`
      : `<a class="btn btn-accent" href="${esc(l.tel)}" data-act="call">${icon("phone")}Ligar</a>
         <button type="button" class="btn btn-ok" data-act="send-call">${icon("check")}Marcar como contactado</button>`;
  } else if (l.etapa === "enviada" && !l.excluida) {
    acts = `<input class="note-in" data-note maxlength="500" placeholder="Nota (opcional)" aria-label="Nota sobre a resposta" value="${esc(l.nota || "")}">
      <button type="button" class="btn btn-ok" data-act="r-interessado">Interessado</button>
      <button type="button" class="btn btn-ok" data-act="r-reuniao">Reunião marcada</button>
      <button type="button" class="btn btn-bad" data-act="r-sem_interesse">Sem interesse</button>`;
    if (l.followup && l.followup_msg) {
      acts += `<div class="actions" style="flex-basis:100%"><span class="meta">Follow-up: “${esc(l.followup_msg)}”</span></div>` +
        (l.followup_wa ? `<a class="btn btn-ghost" href="${esc(l.followup_wa)}" target="_blank" rel="noopener noreferrer" data-act="open-fu">${icon("wa")}Abrir follow-up</a>` : `<a class="btn btn-ghost" href="${esc(l.tel)}">${icon("phone")}Ligar</a>`) +
        `<button type="button" class="btn btn-ghost" data-act="followup">${icon("check")}Follow-up enviado</button>`;
    }
  } else if (l.etapa === "respondida" && l.nota) {
    acts = `<p class="meta">Nota: ${esc(l.nota)}</p>`;
  }

  const tools = [
    `<a class="btn btn-ghost btn-sm" href="${esc(l.url_maps)}" target="_blank" rel="noopener noreferrer">${icon("pin")}Maps</a>`,
    l.etapa === "enviada" && !l.excluida ? `<button type="button" class="btn btn-ghost btn-sm" data-act="undo-stage">Anular envio</button>` : "",
    l.invalido ? `<button type="button" class="btn btn-ghost btn-sm" data-act="uninvalid">Número afinal válido</button>` : "",
    !l.excluida ? `<button type="button" class="btn btn-ghost btn-sm" data-act="exclude">${icon("ban")}Não contactar</button>` : l.resultado !== "sem_interesse" ? `<button type="button" class="btn btn-ghost btn-sm" data-act="unexclude">Voltar a permitir</button>` : "",
    l.etapa === "respondida" ? `<button type="button" class="btn btn-ghost btn-sm" data-act="undo-stage">Anular resposta</button>` : "",
    owner ? `<label class="assign">Atribuída a <select data-act="assign" aria-label="Reatribuir ${esc(l.nome)}">${S.team.map((u) => `<option value="${u.id}" ${u.id === l.atribuida_a ? "selected" : ""}>${esc(u.nome)}</option>`).join("")}</select></label>` : "",
  ].join("");

  return `<article class="card ${l.etapa === "respondida" ? "is-done" : ""}" data-id="${l.id}">
    <div class="card-top"><div><h3>${esc(l.nome)}</h3>${meta}</div></div>
    <div class="badges">${badges}</div>
    ${body}
    ${acts ? `<div class="actions">${acts}</div>` : ""}
    <div class="actions">${tools}</div>
  </article>`;
}

function emptyHTML() {
  const c = S.stats?.counts;
  if (S.running) return `<div class="empty"><strong>A procurar empresas sem site…</strong><span>Os leads aparecem aqui assim que chegam.</span></div>`;
  if (!c?.encontradas) return `<div class="empty"><strong>Ainda não há leads aqui.</strong><span>Escolhe um nicho e uma região e carrega em Começar.</span></div>`;
  return `<div class="empty"><strong>Nenhum lead com estes filtros.</strong><button type="button" class="btn btn-ghost" data-act="clear-filters">Limpar filtros</button></div>`;
}

function renderList() {
  const list = $("#list");
  $("#leadsTotal").textContent = S.total ? `· ${S.total}` : "";
  if (!S.leads.length) { list.innerHTML = emptyHTML(); $("#moreBtn").hidden = true; return; }
  const existing = new Map($$(".card", list).map((el) => [Number(el.dataset.id), el]));
  if (!existing.size) list.innerHTML = "";
  const frag = [];
  for (const l of S.leads) {
    const sig = JSON.stringify(l);
    let el = existing.get(l.id);
    if (el && (S.dirty.has(l.id) || el.contains(document.activeElement)) && S.shown[l.id]?.etapa === l.etapa) { frag.push(el); existing.delete(l.id); continue; }
    if (!el || S.shown[l.id]?.sig !== sig) {
      const t = document.createElement("template"); t.innerHTML = cardHTML(l).trim();
      const fresh = t.content.firstElementChild;
      if (el) el.replaceWith(fresh);
      el = fresh;
    }
    S.shown[l.id] = { sig, etapa: l.etapa };
    existing.delete(l.id);
    frag.push(el);
  }
  for (const el of existing.values()) el.remove();
  $(".empty", list)?.remove(); $$(".skel", list).forEach((x) => x.remove());
  frag.forEach((el, i) => { if (list.children[i] !== el) list.insertBefore(el, list.children[i] || null); });
  $("#moreBtn").hidden = S.leads.length >= S.total;
}

$("#moreBtn").addEventListener("click", () => { S.page = Math.floor(S.leads.length / PAGE); loadLeads(false); });

let nameTimer;
$("#fNome").addEventListener("input", (e) => { clearTimeout(nameTimer); nameTimer = setTimeout(() => { S.f.nome = e.target.value.trim(); loadLeads(true); }, 250); });
$("#fEtapa").addEventListener("change", (e) => { S.f.so_etapa = e.target.value; S.f.etapa = ""; $$("#steps [data-filter]").forEach((x) => x.setAttribute("aria-pressed", "false")); loadLeads(true); });
$("#fTipo").addEventListener("change", (e) => { S.f.tipo = e.target.value; loadLeads(true); });
$("#fResultado").addEventListener("change", (e) => { S.f.resultado = e.target.value; loadLeads(true); });

const findLead = (id) => S.leads.find((l) => l.id === id);
function replaceLead(l) {
  const i = S.leads.findIndex((x) => x.id === l.id);
  if (i >= 0) S.leads[i] = l;
  S.dirty.delete(l.id);
  delete S.shown[l.id];
  renderList();
}

async function leadAction(id, action, body = {}) {
  const r = await api(`/api/leads/${id}/${action}`, { method: "POST", body });
  replaceLead(r.lead);
  refreshAll();
  return r.lead;
}
const undo = (id, what = "stage") => () => leadAction(id, "undo", { what });

$("#list").addEventListener("input", (e) => {
  const ta = e.target.closest("[data-msg]");
  if (!ta) return;
  const card = ta.closest(".card"), id = Number(card.dataset.id);
  S.dirty.add(id);
  const n = ta.value.length;
  const chars = $("[data-chars]", card);
  chars.textContent = `${n} caracteres`;
  chars.classList.toggle("is-over", n > 1000 || n < 20);
  const save = $('[data-act="save"]', card); if (save) save.disabled = ta.value.trim() === (findLead(id)?.mensagem || "");
});

$("#list").addEventListener("change", async (e) => {
  const sel = e.target.closest('select[data-act="assign"]');
  if (!sel) return;
  const id = Number(sel.closest(".card").dataset.id), prev = findLead(id)?.atribuida_a;
  try {
    await leadAction(id, "assign", { user_id: Number(sel.value) });
    toast(`Reatribuído a ${S.team.find((u) => u.id === Number(sel.value))?.nome}.`, { undo: () => leadAction(id, "assign", { user_id: prev }) });
  } catch (err) { fail(err); sel.value = prev; }
});

$("#list").addEventListener("click", async (e) => {
  const b = e.target.closest("[data-act]");
  if (!b || b.tagName === "SELECT") return;
  const act = b.dataset.act;
  if (act === "reload") return loadLeads(true);
  if (act === "clear-filters") return clearFilters();
  const card = b.closest(".card"); if (!card) return;
  const id = Number(card.dataset.id), l = findLead(id); if (!l) return;
  const note = () => $("[data-note]", card)?.value.trim() || null;
  if (act === "open-wa" || act === "open-fu" || act === "call") {
    if (S.dirty.has(id)) { e.preventDefault(); toast("Guarda a mensagem editada antes de enviar.", { bad: true }); }
    return; // o link abre normalmente
  }
  if (b.tagName === "BUTTON") b.classList.add("is-busy");
  try {
    switch (act) {
      case "save": await leadAction(id, "edit", { mensagem: $("[data-msg]", card).value }); toast("Mensagem guardada."); break;
      case "regen": { const r = await api(`/api/leads/${id}/regenerate`, { method: "POST", body: {} }); replaceLead(r.lead); toast("Nova versão gerada."); break; }
      case "retry": { const r = await api(`/api/leads/${id}/retry`, { method: "POST", body: {} }); replaceLead(r.lead); refreshAll(); break; }
      case "copy": toast((await copyText(l.mensagem)) ? "Mensagem copiada." : "Não foi possível copiar.", { bad: false }); break;
      case "send": await leadAction(id, "send", { canal: "whatsapp" }); toast(`${l.nome}: marcada como enviada.`, { undo: undo(id) }); break;
      case "send-call": await leadAction(id, "send", { canal: "chamada" }); toast(`${l.nome}: marcado como contactado.`, { undo: undo(id) }); break;
      case "r-interessado": case "r-reuniao": case "r-sem_interesse": {
        const resultado = act.slice(2);
        await leadAction(id, "respond", { resultado, nota: note() });
        toast(`${l.nome}: ${RES[resultado][0].toLowerCase()}.${resultado === "sem_interesse" ? " Foi para a lista de exclusão." : ""}`, { undo: undo(id) });
        break;
      }
      case "followup": await leadAction(id, "followup"); toast("Follow-up registado.", { undo: undo(id, "followup") }); break;
      case "exclude": await leadAction(id, "exclude"); toast(`${l.nome} não volta a ser contactado.`, { undo: undo(id, "exclude") }); break;
      case "uninvalid": await leadAction(id, "undo", { what: "invalid" }); break;
      case "unexclude": await leadAction(id, "undo", { what: "exclude" }); break;
      case "undo-stage": await leadAction(id, "undo", { what: "stage" }); toast("Passo anulado."); break;
    }
  } catch (err) { fail(err); }
  finally { b.classList?.remove("is-busy"); }
});

function clearFilters() {
  Object.assign(S.f, { etapa: "", so_etapa: "", tipo: "", resultado: "", nome: "", followup: "" });
  ["#fEtapa", "#fTipo", "#fResultado", "#fNome"].forEach((s) => { $(s).value = ""; });
  $$("#steps [data-filter]").forEach((x) => x.setAttribute("aria-pressed", "false"));
  loadLeads(true);
}

// Ações no cartão do funil
$("#funnel").addEventListener("click", async (e) => {
  const b = e.target.closest("[data-act]");
  if (!b) return;
  if (b.dataset.act === "retry-search") {
    const camp = S.stats.campanha;
    if (camp) startSearch({ nicho: camp.nicho, regiao: camp.regiao, concelho: camp.concelho });
  }
  if (b.dataset.act === "retry-writes") {
    b.classList.add("is-busy");
    try {
      const r = await api("/api/leads?" + qs({ ...scopeQ(), falha: "1", limite: 100 }));
      for (const l of r.leads) await api(`/api/leads/${l.id}/retry`, { method: "POST", body: {} });
      toast(`${r.leads.length} a tentar de novo.`);
    } catch (err) { fail(err); }
    refreshAll(true);
  }
});
$("#followBtn").addEventListener("click", () => {
  clearFilters();
  S.f.so_etapa = "enviada"; $("#fEtapa").value = "enviada";
  S.f.followup = "1";
  loadLeads(true);
  $("#leads").focus();
});

// ───────────── Modo Sprint ─────────────
const SP = { queue: [], i: 0, awaiting: false, opened: false, done: 0 };
$("#sprintBtn").addEventListener("click", openSprint);
$("#sprintClose").addEventListener("click", () => $("#sprint").close());
$("#sprint").addEventListener("close", () => { document.removeEventListener("keydown", sprintKeys); refreshAll(true); });

async function openSprint() {
  try {
    const r = await api("/api/leads?" + qs({ ...scopeQ(), fila: "1", limite: 100 }));
    Object.assign(SP, { queue: r.leads, i: 0, awaiting: false, done: 0 });
    if (!SP.queue.length) return toast("Não há mensagens prontas a enviar.");
    if (!$("#sprint .toasts")) { const t = document.createElement("div"); t.className = "toasts"; t.setAttribute("role", "status"); t.setAttribute("aria-live", "polite"); $("#sprint").append(t); }
    $("#sprint").showModal();
    document.addEventListener("keydown", sprintKeys);
    renderSprint();
  } catch (e) { fail(e); }
}

function renderSprint() {
  const body = $("#sprintBody");
  const l = SP.queue[SP.i];
  const used = S.stats?.envios_hoje ?? 0, lim = S.stats?.limite_diario ?? 40;
  if (!l) {
    $("#sprintPos").textContent = "";
    body.innerHTML = `<div class="empty"><strong>Fila terminada.</strong><span>${SP.done} ${SP.done === 1 ? "envio" : "envios"} nesta sessão.</span><button type="button" class="btn btn-accent" data-sp="close">Voltar ao funil</button></div>`;
    return;
  }
  $("#sprintPos").textContent = `${SP.i + 1} de ${SP.queue.length} · ${used}/${lim} hoje`;
  const warn = used >= lim ? `<p class="err-line">Atingiste o limite diário de ${lim} envios.</p>` : used >= lim * 0.8 ? `<p class="meta" style="color:var(--warn)">Estás perto do limite diário (${used}/${lim}).</p>` : "";
  const mobile = l.tipo_tel === "movel";
  body.innerHTML = `
    <div><h3>${esc(l.nome)}</h3><p class="meta"><span>${esc(l.categoria)}</span>${l.cidade ? `<span>${esc(l.cidade)}</span>` : ""}<span>${esc(l.telefone)}</span></p></div>
    <div class="badges">${mobile ? `<span class="badge b-wa">${icon("wa")}WhatsApp</span>` : `<span class="badge">${icon("phone")}Fixo</span>`}${l.site_tipo === "so_redes" ? '<span class="badge b-redes">Só redes sociais</span>' : ""}<a class="badge" href="${esc(l.url_maps)}" target="_blank" rel="noopener noreferrer">${icon("pin")}Maps</a></div>
    ${warn}
    <textarea class="msg" id="spMsg" aria-label="Mensagem" maxlength="1000">${esc(l.mensagem)}</textarea>
    ${!mobile && l.guiao ? `<ol class="script" aria-label="Guião de chamada">${l.guiao.map((s) => `<li>${esc(s)}</li>`).join("")}</ol>` : ""}
    <div id="spAsk"></div>
    <div class="sprint-actions">
      ${mobile ? `<a class="btn btn-wa" id="spOpen" href="${esc(l.wa)}" target="_blank" rel="noopener noreferrer">${icon("wa")}Abrir WhatsApp</a>
                 <div class="row"><button type="button" class="btn btn-ghost" data-sp="copy">${icon("copy")}Copiar</button><button type="button" class="btn btn-ghost" data-sp="skip">Saltar</button></div>`
               : `<a class="btn btn-accent" id="spOpen" href="${esc(l.tel)}">${icon("phone")}Ligar</a>
                 <div class="row"><button type="button" class="btn btn-ok" data-sp="sent">Marcar como contactado</button><button type="button" class="btn btn-ghost" data-sp="skip">Saltar</button></div>`}
      <button type="button" class="btn btn-bad" data-sp="invalid">Número errado</button>
    </div>`;
  SP.awaiting = false;
  $("#spOpen").focus();
}

function showAsk() {
  SP.awaiting = true;
  $("#spAsk").innerHTML = `<div class="ask" role="group" aria-labelledby="askT"><p id="askT">Enviaste?</p><div class="row">
    <button type="button" class="btn btn-ok" data-sp="sent">Sim → próximo</button>
    <button type="button" class="btn btn-ghost" data-sp="skip">Saltar</button>
    <button type="button" class="btn btn-bad" data-sp="invalid">Número errado</button></div></div>`;
  $('#spAsk [data-sp="sent"]').focus();
}

async function saveSprintEdit() {
  const l = SP.queue[SP.i], v = $("#spMsg")?.value.trim();
  if (l && v && v !== l.mensagem) {
    const r = await api(`/api/leads/${l.id}/edit`, { method: "POST", body: { mensagem: v } });
    SP.queue[SP.i] = r.lead;
    return r.lead;
  }
  return l;
}

$("#sprintBody").addEventListener("click", async (e) => {
  const open = e.target.closest("#spOpen");
  if (open) {
    const l = SP.queue[SP.i];
    if ($("#spMsg").value.trim() !== l.mensagem) {
      e.preventDefault();
      try { const nl = await saveSprintEdit(); window.open(nl.tipo_tel === "movel" ? nl.wa : nl.tel, "_blank", "noopener"); } catch (err) { return fail(err); }
    }
    if (l.tipo_tel === "movel") { SP.opened = true; showAsk(); }
    return;
  }
  const b = e.target.closest("[data-sp]");
  if (b) sprintDo(b.dataset.sp);
});

let spBusy = false;
async function sprintDo(what) {
  if (spBusy) return;
  const l = SP.queue[SP.i];
  if (what === "close") return $("#sprint").close();
  if (!l) return;
  spBusy = true;
  try {
    if (what === "copy") { await saveSprintEdit(); toast((await copyText($("#spMsg").value)) ? "Mensagem copiada." : "Não foi possível copiar."); return; }
    if (what === "sent") {
      await saveSprintEdit();
      await api(`/api/leads/${l.id}/send`, { method: "POST", body: { canal: l.tipo_tel === "movel" ? "whatsapp" : "chamada" } });
      SP.done++;
      if (S.stats) S.stats.envios_hoje++;
      toast(`${l.nome}: enviada.`, { undo: async () => { await api(`/api/leads/${l.id}/undo`, { method: "POST", body: { what: "stage" } }); SP.done--; if (S.stats) S.stats.envios_hoje--; SP.queue.splice(SP.i, 0, l); renderSprint(); } });
      SP.queue.splice(SP.i, 1);
    } else if (what === "skip") {
      SP.i++;
    } else if (what === "invalid") {
      await api(`/api/leads/${l.id}/invalid`, { method: "POST", body: {} });
      toast(`${l.nome}: número marcado como inválido.`, { undo: async () => { await api(`/api/leads/${l.id}/undo`, { method: "POST", body: { what: "invalid" } }); SP.queue.splice(SP.i, 0, l); renderSprint(); } });
      SP.queue.splice(SP.i, 1);
    }
    renderSprint();
  } catch (err) { fail(err); }
  finally { spBusy = false; }
}

function sprintKeys(e) {
  if (!$("#sprint").open || e.target.matches("textarea, input") || e.ctrlKey || e.metaKey || e.altKey) return;
  const k = e.key.toLowerCase();
  if (k === "enter" && !SP.awaiting && document.activeElement?.tagName !== "BUTTON") { e.preventDefault(); $("#spOpen")?.click(); }
  else if (k === "s") { e.preventDefault(); sprintDo("sent"); }
  else if (k === "n") { e.preventDefault(); sprintDo("skip"); }
}

// Ao voltar do WhatsApp, pergunta "Enviaste?"
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && $("#sprint").open && SP.opened) { SP.opened = false; showAsk(); }
});

// ───────────── Definições (dono) ─────────────
$("#openSettings").addEventListener("click", () => {
  const f = $("#settingsForm");
  f.limite_diario.value = S.settings.limite_diario; f.dias_followup.value = S.settings.dias_followup; f.assinatura.value = S.settings.assinatura;
  $("#settingsError").textContent = "";
  $("#settings").showModal();
});
$("#saveSettings").addEventListener("click", async (e) => {
  e.preventDefault();
  const f = $("#settingsForm");
  try {
    const r = await api("/api/settings", { method: "PUT", body: { limite_diario: Number(f.limite_diario.value), dias_followup: Number(f.dias_followup.value), assinatura: f.assinatura.value } });
    S.settings = r.settings; $("#settings").close(); toast("Definições guardadas."); refreshAll(true);
  } catch (err) { $("#settingsError").textContent = err.message; }
});

document.addEventListener("visibilitychange", () => { if (!document.hidden && S.me && !$("#app").hidden) refreshAll(); });
boot();
export { ApiError };
