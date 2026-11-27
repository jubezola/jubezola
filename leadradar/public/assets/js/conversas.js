// Conversas: lista de pessoas a pedir um site, com estado guardado no navegador.
const $ = (s) => document.querySelector(s);
const KEY = "lr.conversas.v1";
const PREFS = "lr.conversas.prefs";

const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

// state: { [url]: { s: "saved"|"replied"|"hidden", seen: ts } }
let state = load(KEY, {});
let items = [];
let timer = null;

const prefs = load(PREFS, {});
for (const id of ["region", "min", "status", "auto"]) if (prefs[id]) $("#" + id).value = prefs[id];

const REPLY = "Olá! Vi que procuras alguém para fazer um site. Faço websites para pequenos negócios em Portugal: rápidos, fáceis de gerir e a funcionar bem no telemóvel. Se quiseres, mostro-te exemplos e dou-te um orçamento sem compromisso.";

function setLive(state, text) { $("#live").dataset.state = state; $("#liveText").textContent = text; }

function relTime(iso) {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 60) return `há ${Math.max(1, m)} min`;
  if (m < 1440) return `há ${Math.round(m / 60)} h`;
  return `há ${Math.round(m / 1440)} d`;
}

async function run(fresh = false) {
  const btn = $("#run");
  btn.disabled = true; $("#feed").setAttribute("aria-busy", "true");
  setLive("loading", "A procurar…");
  try {
    const qs = new URLSearchParams({ region: $("#region").value, min: $("#min").value, ...(fresh ? { fresh: "1" } : {}) });
    const r = await fetch(`/api/social?${qs}`, { headers: { Accept: "application/json" } });
    if (!r.ok) throw new Error(`O servidor respondeu ${r.status}`);
    const data = await r.json();
    const now = Date.now();
    for (const it of data.items) if (!state[it.id]) state[it.id] = { seen: now, fresh: true };
    save(KEY, prune(state));
    items = data.items;
    renderSources(data.sources);
    render();
    setLive("live", `${data.count} conversas · ${new Date(data.updatedAt).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}`);
  } catch (e) {
    setLive("error", "Erro na pesquisa");
    $("#empty").hidden = false;
    $("#empty").innerHTML = "";
    const p = document.createElement("p");
    p.textContent = `Não foi possível procurar (${e.message}). Abre esta página no site publicado (Vercel ou Netlify): a pesquisa corre no servidor.`;
    $("#empty").append(p);
  } finally {
    btn.disabled = false; $("#feed").setAttribute("aria-busy", "false");
  }
}

// Mantém só os últimos 90 dias para o localStorage não crescer para sempre.
function prune(s) {
  const cut = Date.now() - 90 * 864e5;
  for (const k of Object.keys(s)) if ((s[k].seen || 0) < cut) delete s[k];
  return s;
}

function renderSources(src = {}) {
  const ul = $("#sources"); ul.innerHTML = "";
  for (const [name, st] of Object.entries(src)) {
    const li = document.createElement("li");
    const ok = st.ok > 0;
    li.dataset.ok = String(ok);
    li.title = ok ? `${st.items} posts analisados` : `Falhou: ${st.error || "sem resposta"}`;
    const b = document.createElement("b"); b.textContent = ok ? "●" : "×";
    li.append(b, ` ${name}`);
    ul.append(li);
  }
}

function render() {
  const filter = $("#status").value;
  const list = $("#list"); list.innerHTML = "";
  const shown = items.filter((it) => {
    const s = state[it.id]?.s;
    if (filter === "open") return !s;
    if (filter === "saved") return s === "saved";
    if (filter === "replied") return s === "replied";
    return s !== "hidden";
  });
  $("#empty").hidden = shown.length > 0;
  if (!shown.length) $("#empty").innerHTML = "<p><b>Nada por aqui.</b> Experimenta baixar o mínimo ou mudar a região.</p>";
  const tpl = $("#tpl");
  for (const it of shown) {
    const n = tpl.content.firstElementChild.cloneNode(true);
    const st = state[it.id] || {};
    n.dataset.state = st.s || "";
    const sc = n.querySelector(".cv-score");
    sc.textContent = it.score;
    sc.dataset.heat = it.score >= 6 ? "hot" : "warm";
    sc.title = "Pontuação de 0 a 10: quanto mais alta, mais claro é o pedido";
    n.querySelector(".cv-src").textContent = it.source;
    n.querySelector(".cv-where").textContent = it.where && it.where !== it.source ? it.where : "";
    const t = n.querySelector(".cv-date"); t.textContent = relTime(it.date); if (it.date) t.dateTime = it.date;
    n.querySelector(".cv-new").hidden = !st.fresh;
    n.querySelector(".cv-title").textContent = it.title || "";
    n.querySelector(".cv-text").textContent = it.text || "";
    const a = n.querySelector(".cv-open"); a.href = it.url;
    a.addEventListener("click", () => mark(it.id, null, true));
    n.querySelector(".cv-copy").addEventListener("click", async (e) => {
      try { await navigator.clipboard.writeText(REPLY); e.target.textContent = "Copiada"; }
      catch { e.target.textContent = "Não deu para copiar"; }
      setTimeout(() => (e.target.textContent = "Copiar resposta"), 1800);
    });
    for (const [cls, val] of [[".cv-save", "saved"], [".cv-replied", "replied"], [".cv-hide", "hidden"]]) {
      const b = n.querySelector(cls);
      if (val !== "hidden") b.setAttribute("aria-pressed", String(st.s === val));
      b.addEventListener("click", () => { mark(it.id, st.s === val ? undefined : val); render(); });
    }
    list.append(n);
  }
}

function mark(id, s, seenOnly = false) {
  const cur = state[id] || { seen: Date.now() };
  cur.fresh = false;
  if (!seenOnly) { if (s) cur.s = s; else delete cur.s; }
  state[id] = cur;
  save(KEY, state);
}

function savePrefs() {
  save(PREFS, Object.fromEntries(["region", "min", "status", "auto"].map((id) => [id, $("#" + id).value])));
}

function schedule() {
  clearInterval(timer);
  const min = Number($("#auto").value);
  if (min > 0) timer = setInterval(() => run(true), min * 60000);
}

$("#run").addEventListener("click", () => run(true));
$("#region").addEventListener("change", () => { savePrefs(); run(); });
$("#min").addEventListener("change", () => { savePrefs(); run(); });
$("#status").addEventListener("change", () => { savePrefs(); render(); });
$("#auto").addEventListener("change", () => { savePrefs(); schedule(); });

schedule();
run();
