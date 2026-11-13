// Armazenamento local: definições, pipeline (CRM) e cache de resultados.
import { CONFIG } from "./config.js";

const NS = "leadradar:";

function lsGet(key, fallback) {
  try {
    const v = localStorage.getItem(NS + key);
    return v == null ? fallback : JSON.parse(v);
  } catch { return fallback; }
}
function lsSet(key, value) {
  try { localStorage.setItem(NS + key, JSON.stringify(value)); return true; } catch { return false; }
}

// ── Sincronização entre separadores (tempo real no mesmo browser) ──
const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("leadradar") : null;
const listeners = new Set();
channel?.addEventListener("message", (e) => listeners.forEach((fn) => fn(e.data)));
export function onSync(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function broadcast(msg) { try { channel?.postMessage(msg); } catch { /* ignorar */ } }

// ── Definições ──
export function getSettings() {
  return { ...CONFIG.defaults, ...lsGet("settings", {}) };
}
export function saveSettings(s) {
  lsSet("settings", s);
  broadcast({ type: "settings" });
}

export function getUi(key, fallback) { return lsGet("ui:" + key, fallback); }
export function setUi(key, value) { lsSet("ui:" + key, value); }

// ── Pipeline / CRM ──
// crm[id] = { status, note, value, updated, contactedAt, lead }
let crm = lsGet("crm", {});
export function getCrm() { return crm; }
export function getEntry(id) { return crm[id] || null; }

export function updateEntry(lead, patch) {
  const prev = crm[lead.id] || { status: "guardado", note: "", value: null, created: Date.now() };
  const next = { ...prev, ...patch, updated: Date.now(), lead: slimLead(lead) };
  if (patch.status === "contactado" && !prev.contactedAt) {
    next.contactedAt = Date.now();
    // Seguimento automático daqui a 3 dias, se ainda não houver data marcada.
    if (!("followUp" in patch) && !prev.followUp) next.followUp = dayKey(Date.now() + 3 * 86400000);
  }
  // Fechado ou perdido: já não há seguimento a fazer.
  if (["fechado", "perdido"].includes(next.status) && !("followUp" in patch)) next.followUp = null;
  crm[lead.id] = next;
  lsSet("crm", crm);
  broadcast({ type: "crm", id: lead.id, status: next.status, name: lead.name });
  return next;
}
export function removeEntry(id) {
  delete crm[id];
  lsSet("crm", crm);
  broadcast({ type: "crm", id, status: null });
}
export function reloadCrm() { crm = lsGet("crm", {}); blocked = lsGet("blocked", {}); indexBlocked(); return crm; }

/** "AAAA-MM-DD" na hora local. */
export function dayKey(t = Date.now()) {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
/** Entradas do pipeline com seguimento para hoje ou atrasado. */
export function dueEntries() {
  const today = dayKey();
  return Object.values(crm).filter((e) => e.followUp && e.followUp <= today && !["fechado", "perdido"].includes(e.status));
}

// ── Lista "não contactar" (RGPD): negócios que pediram para não ser contactados ──
// blocked[id] = { name, phones: [e164], at }
let blocked = lsGet("blocked", {});
let blockedPhones = new Set();
function indexBlocked() { blockedPhones = new Set(Object.values(blocked).flatMap((b) => b.phones || [])); }
indexBlocked();
export function getBlocked() { return blocked; }
/** O(1) por lead: índice de telefones bloqueados em vez de percorrer a lista. */
export function isBlocked(lead) {
  if (blocked[lead.id]) return true;
  if (!blockedPhones.size || !lead.phones) return false;
  for (const p of lead.phones) if (blockedPhones.has(p.e164)) return true;
  return false;
}
export function block(lead) {
  blocked[lead.id] = { name: lead.name, phones: (lead.phones || []).map((p) => p.e164), at: Date.now() };
  lsSet("blocked", blocked);
  indexBlocked();
  if (crm[lead.id]) { delete crm[lead.id]; lsSet("crm", crm); }
  broadcast({ type: "crm", id: lead.id, status: null, name: lead.name });
}
export function unblock(id) {
  delete blocked[id];
  lsSet("blocked", blocked);
  indexBlocked();
  broadcast({ type: "crm", id, status: null });
}
export function setBlocked(map) { blocked = { ...blocked, ...map }; lsSet("blocked", blocked); indexBlocked(); }

function slimLead(l) {
  const { id, osm, name, cat, type, district, street, postcode, city, lat, lon, phones, whatsapp, instagram, facebook, email, hasWebsite, site, siteUrl, hours, score, heat, reasons, concelho } = l;
  return { id, osm, name, cat, type, district, street, postcode, city, lat, lon, phones, whatsapp, instagram, facebook, email, hasWebsite, site, siteUrl, hours, score, heat, reasons, concelho };
}

// ── Cache de resultados em IndexedDB (sem limite de 5 MB do localStorage) ──
const memory = new Map();
let dbPromise = null;
function db() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    try {
      const req = indexedDB.open("leadradar", 1);
      req.onupgradeneeded = () => req.result.createObjectStore("cache");
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch { resolve(null); }
  });
  return dbPromise;
}
async function idb(mode, fn) {
  const d = await db();
  if (!d) return undefined;
  return new Promise((resolve) => {
    try {
      const tx = d.transaction("cache", mode);
      const req = fn(tx.objectStore("cache"));
      tx.oncomplete = () => resolve(req?.result);
      tx.onerror = () => resolve(undefined);
      tx.onabort = () => resolve(undefined);
    } catch { resolve(undefined); }
  });
}

export async function cacheGet(key) {
  if (memory.has(key)) return memory.get(key);
  const v = await idb("readonly", (s) => s.get(key));
  if (v) memory.set(key, v);
  return v || null;
}
export async function cachePut(key, value) {
  memory.set(key, value);
  await idb("readwrite", (s) => s.put(value, key));
}
export async function cacheAll() {
  const d = await db();
  if (!d) return [...memory.entries()].map(([key, value]) => ({ key, value }));
  return new Promise((resolve) => {
    const out = [];
    try {
      const tx = d.transaction("cache", "readonly");
      const req = tx.objectStore("cache").openCursor();
      req.onsuccess = () => {
        const c = req.result;
        if (c) { out.push({ key: c.key, value: c.value }); c.continue(); }
      };
      tx.oncomplete = () => resolve(out);
      tx.onerror = () => resolve(out);
    } catch { resolve(out); }
  });
}
export async function cacheClear() {
  memory.clear();
  await idb("readwrite", (s) => s.clear());
}
export function isFresh(entry) {
  return entry && Date.now() - entry.fetchedAt < CONFIG.cacheMinutes * 60000;
}
