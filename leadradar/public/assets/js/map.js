// Mapa (Leaflet + agrupamento de marcadores).
import { DISTRICTS } from "./data.js";

let map = null;
let cluster = null;
let overview = null;
let tiles = null;
let markers = new Map();   // id -> marker visível no cluster
const pool = new Map();    // id -> { m, ikey, lead } (marcadores reutilizados entre renderizações)
let onPick = null;
let popupBuilder = null;

const PT_CENTER = [39.6, -8.1];

function dark() {
  const forced = document.documentElement.dataset.theme;
  if (forced) return forced === "dark";
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches;
}

function tileUrl() {
  return dark()
    ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
    : "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
}

export function initMap(el, { onSelectLead, onSelectDistrict, buildPopup }) {
  if (map || !window.L) return map;
  const L = window.L;
  onPick = onSelectLead;
  popupBuilder = buildPopup;
  map = L.map(el, { zoomControl: true, attributionControl: true, preferCanvas: true }).setView(PT_CENTER, 6);
  tiles = L.tileLayer(tileUrl(), {
    maxZoom: 19,
    subdomains: "abcd",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions" target="_blank" rel="noopener">CARTO</a>',
  }).addTo(map);
  cluster = L.markerClusterGroup({
    chunkedLoading: true,
    maxClusterRadius: 46,
    showCoverageOnHover: false,
    spiderfyOnMaxZoom: true,
    iconCreateFunction: (c) => {
      const n = c.getChildCount();
      const size = n < 10 ? 34 : n < 100 ? 40 : 48;
      return L.divIcon({ html: `<span>${n}</span>`, className: "map-cluster", iconSize: [size, size] });
    },
  });
  map.addLayer(cluster);
  overview = L.layerGroup().addTo(map);
  overview._onSelect = onSelectDistrict;
  window.matchMedia?.("(prefers-color-scheme: dark)").addEventListener?.("change", () => tiles.setUrl(tileUrl()));
  return map;
}

export function refreshTiles() { tiles?.setUrl(tileUrl()); }

let lastBounds = null;
export function invalidate({ refit = false } = {}) {
  if (!map) return;
  map.invalidateSize();
  if (refit && lastBounds) map.fitBounds(lastBounds, { maxZoom: 14, animate: false });
}

const icons = {};
function iconFor(heat, saved) {
  const key = heat + (saved ? "s" : "");
  if (!icons[key]) {
    icons[key] = window.L.divIcon({
      className: `map-pin heat-${heat}${saved ? " is-saved" : ""}`,
      html: "<i></i>",
      iconSize: [18, 18],
      iconAnchor: [9, 9],
      popupAnchor: [0, -8],
    });
  }
  return icons[key];
}

/**
 * Mostra os leads no mapa. Em vez de apagar e recriar tudo a cada filtro,
 * reaproveita os marcadores: só adiciona os que entram, tira os que saem
 * e muda o ícone dos que mudaram de estado.
 */
export function setLeads(leads, { fit = true, savedIds = new Set() } = {}) {
  if (!map) return;
  const L = window.L;
  if (overviewOn) { overview.clearLayers(); overviewOn = false; }
  const next = new Map();
  const toAdd = [];
  let s = 90, w = 180, n = -90, e = -180;
  for (const l of leads) {
    const saved = savedIds.has(l.id);
    const ikey = l.heat + (saved ? "s" : "");
    let rec = pool.get(l.id);
    if (!rec) {
      rec = { m: L.marker([l.lat, l.lon], { icon: iconFor(l.heat, saved), title: l.name, keyboard: false }), ikey, lead: l };
      rec.m.bindPopup(() => popupBuilder(rec.lead), { maxWidth: 260, minWidth: 200 });
      rec.m.on("click", () => onPick?.(rec.lead, { fromMap: true }));
      pool.set(l.id, rec);
    } else {
      rec.lead = l;
      if (rec.ikey !== ikey) { rec.ikey = ikey; rec.m.setIcon(iconFor(l.heat, saved)); }
    }
    next.set(l.id, rec.m);
    if (!markers.has(l.id)) toAdd.push(rec.m);
    if (l.lat < s) s = l.lat; if (l.lat > n) n = l.lat; if (l.lon < w) w = l.lon; if (l.lon > e) e = l.lon;
  }
  const toRemove = [];
  for (const [id, m] of markers) if (!next.has(id)) toRemove.push(m);
  if (toRemove.length) cluster.removeLayers(toRemove);
  if (toAdd.length) cluster.addLayers(toAdd);
  markers = next;
  // Evita que a memória cresça sem fim depois de muitas pesquisas.
  if (pool.size > 15000) for (const id of pool.keys()) if (!next.has(id)) pool.delete(id);
  if (leads.length) lastBounds = L.latLngBounds([s, w], [n, e]).pad(0.08);
  if (fit && lastBounds) map.fitBounds(lastBounds, { maxZoom: 14, animate: false });
}

export function focusDistrict(d) {
  if (!map || !d) return;
  const [s, w, n, e] = d.bbox;
  map.fitBounds([[s, w], [n, e]], { animate: false });
}

let overviewOn = false;
export function showOverview(stats) {
  if (!map) return;
  const L = window.L;
  cluster.clearLayers();
  overview.clearLayers();
  markers = new Map();
  overviewOn = true;
  const max = Math.max(1, ...Object.values(stats).map((s) => s.total || 0));
  for (const d of DISTRICTS) {
    const s = stats[d.id];
    const n = s?.total ?? null;
    const size = n == null ? 26 : 30 + Math.round(34 * Math.sqrt(n / max));
    const icon = L.divIcon({
      className: `map-district${n == null ? " is-empty" : ""}`,
      html: `<b>${n == null ? "?" : n}</b><small>${d.name}</small>`,
      iconSize: [size, size],
    });
    const m = L.marker(d.center, { icon, title: d.name, keyboard: false });
    m.on("click", () => overview._onSelect?.(d.id));
    overview.addLayer(m);
  }
  map.setView(PT_CENTER, window.innerWidth < 700 ? 6 : 7, { animate: false });
}

export function highlight(id, { open = true } = {}) {
  const m = markers.get(id);
  if (!m || !map) return;
  cluster.zoomToShowLayer(m, () => {
    if (open) m.openPopup();
  });
}
