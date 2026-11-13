// Transforma elementos do OpenStreetMap em leads prontos a contactar.
import { categorize, TYPE_LABELS, PUBLIC_NAME_RE, CATEGORY_BY_ID } from "./data.js";

const PHONE_KEYS = ["contact:mobile", "mobile", "phone", "contact:phone", "phone:mobile"];
const TYPE_KEYS = ["amenity", "shop", "craft", "office", "tourism", "leisure", "healthcare"];

/** Normaliza um número português. Devolve null se não parecer válido. */
export function parsePhone(raw) {
  if (!raw) return null;
  let s = String(raw).trim();
  let plus = s.startsWith("+");
  let d = s.replace(/[^\d]/g, "");
  if (!d) return null;
  if (d.startsWith("00")) { d = d.slice(2); plus = true; }
  let national = null;
  if (plus || d.length === 12) {
    if (d.startsWith("351")) national = d.slice(3);
    else if (d.length >= 8) return { raw: s, e164: "+" + d, national: d, display: "+" + d, mobile: false, foreign: true };
  } else national = d;
  if (!national || national.length !== 9 || !/^[23789]/.test(national)) return null;
  const mobile = /^9[1236]/.test(national);
  return {
    raw: s,
    e164: "+351" + national,
    national,
    display: `+351 ${national.slice(0, 3)} ${national.slice(3, 6)} ${national.slice(6)}`,
    mobile,
    foreign: false,
  };
}

function splitPhones(value) {
  return String(value).split(/\s*(?:;|,|\/|\bou\b|\be\b|\|)\s*/i).filter(Boolean);
}

/**
 * Classifica o "website" de um negócio:
 *  none   — não tem
 *  social — só uma página de rede social / agregador de links (Facebook, Instagram, Linktree…)
 *  dead   — página do Google Business Profile (*.business.site), desligada pela Google em 2024
 *  real   — website próprio
 */
export function siteKind(url) {
  if (!url) return "none";
  const s = String(url).toLowerCase();
  if (/(business|negocio)\.site\b/.test(s)) return "dead";
  if (/(facebook\.com|fb\.com|fb\.me|instagram\.com|linktr\.ee|linkin\.bio|wa\.me|tiktok\.com|beacons\.ai)/.test(s)) return "social";
  return "real";
}

export function parseInstagram(v) {
  if (!v) return null;
  const s = String(v).trim();
  const m = s.match(/instagram\.com\/([A-Za-z0-9._]{1,30})/i);
  const h = (m ? m[1] : s.replace(/^@/, "")).replace(/\/$/, "");
  if (!/^[A-Za-z0-9._]{1,30}$/.test(h) || /^(p|reel|explore|stories)$/i.test(h)) return null;
  return h;
}

export function parseFacebook(v) {
  if (!v) return null;
  const s = String(v).trim();
  if (/^https?:\/\//i.test(s)) return s;
  if (/facebook\.com\//i.test(s)) return "https://" + s.replace(/^\/+/, "");
  if (/^[A-Za-z0-9.\-]{3,}$/.test(s)) return "https://www.facebook.com/" + s;
  return null;
}

function typeLabel(tags) {
  for (const k of TYPE_KEYS) {
    const v = tags[k];
    if (v && TYPE_LABELS[v]) return TYPE_LABELS[v];
  }
  if (tags.beauty === "nails") return "Unhas";
  for (const k of TYPE_KEYS) if (tags[k] && tags[k] !== "yes") return tags[k].replace(/_/g, " ");
  return "Negócio local";
}

function osmType(tags) {
  for (const k of TYPE_KEYS) if (tags[k]) return `${k}=${tags[k]}`;
  return "";
}

/** Converte um elemento OSM num lead. Devolve null se não for aproveitável. */
export function toLead(el, districtId) {
  const t = el.tags || {};
  const name = (t.name || "").trim();
  if (!name || PUBLIC_NAME_RE.test(name)) return null;

  const phones = [];
  const seen = new Set();
  for (const k of PHONE_KEYS) {
    if (!t[k]) continue;
    for (const p of splitPhones(t[k])) {
      const ph = parsePhone(p);
      if (ph && !seen.has(ph.e164)) { seen.add(ph.e164); phones.push(ph); }
    }
  }
  let whatsapp = null;
  const waTag = t["contact:whatsapp"] || t.whatsapp;
  if (waTag) {
    const m = String(waTag).match(/wa\.me\/(\d+)/);
    const ph = parsePhone(m ? "+" + m[1] : waTag);
    if (ph) { whatsapp = ph; if (!seen.has(ph.e164)) { seen.add(ph.e164); phones.push(ph); } }
  }
  if (!whatsapp) whatsapp = phones.find((p) => p.mobile) || null;
  phones.sort((a, b) => Number(b.mobile) - Number(a.mobile));

  const siteUrl = t.website || t["contact:website"] || t.url || t["contact:url"] || "";
  const site = siteKind(siteUrl);
  if (!whatsapp && site === "social") {
    const m = String(siteUrl).match(/wa\.me\/(\d+)/);
    const ph = m && parsePhone("+" + m[1]);
    if (ph) { whatsapp = ph; if (!seen.has(ph.e164)) { seen.add(ph.e164); phones.unshift(ph); } }
  }
  const igFromSite = /instagram\.com\//i.test(siteUrl) ? parseInstagram(siteUrl) : null;
  const instagram = parseInstagram(t["contact:instagram"] || t.instagram) || igFromSite;
  if (!phones.length && !instagram) return null;

  const fbFromSite = /(facebook|fb)\.(com|me)\//i.test(siteUrl) ? parseFacebook(siteUrl) : null;
  const facebook = parseFacebook(t["contact:facebook"] || t.facebook) || fbFromSite;
  const email = (t.email || t["contact:email"] || "").split(/[;,\s]/)[0] || null;
  const hasWebsite = site === "real";

  const street = [t["addr:street"], t["addr:housenumber"]].filter(Boolean).join(", ");
  const city = t["addr:city"] || t["addr:place"] || t["addr:village"] || t["addr:town"] || t["addr:suburb"] || t["addr:municipality"] || "";
  const lat = el.lat ?? el.center?.lat;
  const lon = el.lon ?? el.center?.lon;
  if (lat == null || lon == null) return null;

  const cat = categorize(t);
  const lead = {
    id: el.type[0] + el.id,
    osm: `${el.type}/${el.id}`,
    name,
    cat: cat.id,
    type: typeLabel(t),
    osmType: osmType(t),
    district: districtId,
    street,
    postcode: t["addr:postcode"] || "",
    city,
    lat: Math.round(lat * 1e5) / 1e5,
    lon: Math.round(lon * 1e5) / 1e5,
    phones: phones.map(({ e164, display, mobile }) => ({ e164, display, mobile })),
    whatsapp: whatsapp ? whatsapp.e164.replace("+", "") : null,
    instagram,
    facebook,
    email,
    hasWebsite,
    site,
    siteUrl: site === "none" ? "" : siteUrl,
    hours: t.opening_hours || "",
  };
  return rescore(lead);
}

/** (Re)calcula pontuação, razões e temperatura. */
export function rescore(lead) {
  const { score, reasons } = scoreLead(lead, CATEGORY_BY_ID[lead.cat]?.weight ?? 10);
  lead.score = score;
  lead.reasons = reasons;
  lead.heat = score >= 75 ? "quente" : score >= 55 ? "morno" : "frio";
  return lead;
}

const normName = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "");

/**
 * O OpenStreetMap tem muitas vezes o mesmo negócio duas vezes (ponto + edifício).
 * Junta leads com o mesmo nome e o mesmo telefone, ou o mesmo nome a menos de ~80 m.
 * Fica o mais completo; os contactos do outro são aproveitados.
 */
export function dedupeLeads(leads) {
  const out = [];
  const byName = new Map();
  const rich = (l) => l.score * 10 + l.phones.length + (l.street ? 1 : 0);
  for (const l of leads) {
    const k = normName(l.name);
    const group = byName.get(k) || [];
    const twin = group.find((o) =>
      o.phones.some((p) => l.phones.some((q) => q.e164 === p.e164)) ||
      (Math.abs(o.lat - l.lat) < 0.0008 && Math.abs(o.lon - l.lon) < 0.001));
    if (!twin) { group.push(l); byName.set(k, group); out.push(l); continue; }
    const [keep, drop] = rich(l) > rich(twin) ? [l, twin] : [twin, l];
    for (const p of drop.phones) if (!keep.phones.some((q) => q.e164 === p.e164)) keep.phones.push(p);
    for (const f of ["whatsapp", "instagram", "facebook", "email", "street", "postcode", "city", "hours"]) if (!keep[f] && drop[f]) keep[f] = drop[f];
    if (!keep.whatsapp) { const m = keep.phones.find((p) => p.mobile); if (m) keep.whatsapp = m.e164.replace("+", ""); }
    keep.phones.sort((a, b) => Number(b.mobile) - Number(a.mobile));
    rescore(keep);
    if (keep !== twin) { out[out.indexOf(twin)] = keep; group[group.indexOf(twin)] = keep; }
  }
  return out;
}

/** Pontuação 0–100: probabilidade de o negócio responder e comprar um website. */
export function scoreLead(l, weight = 10) {
  let s = 22 + weight;
  const reasons = [];
  if (l.whatsapp) { s += 28; reasons.push("WhatsApp"); }
  else if (l.phones.length) { s += 12; reasons.push("Telefone fixo"); }
  if (l.instagram) { s += 12; reasons.push("Tem Instagram"); }
  if (l.facebook) { s += 6; reasons.push("Tem Facebook"); }
  if (l.email) { s += 5; reasons.push("Email público"); }
  if (l.hours) { s += 6; reasons.push("Horário publicado"); }
  if (l.street) s += 4;
  if (l.site === "dead") { s += 10; reasons.unshift("Site do Google desativado"); }
  else if (l.site === "social") { s += 8; reasons.unshift("Usa redes sociais como site"); }
  else if (l.hasWebsite) { s -= 45; reasons.push("Já tem website"); }
  else reasons.unshift("Sem website");
  return { score: Math.max(1, Math.min(100, Math.round(s))), reasons };
}

export function heatLabel(h) {
  return h === "quente" ? "Quente" : h === "morno" ? "Morno" : "Frio";
}

/** Preenche um modelo de mensagem. */
export function fillTemplate(text, lead, settings, catLabel) {
  const vars = {
    nome: lead.name,
    cidade: lead.city || lead.concelho || lead.districtName || "a sua zona",
    categoria: catLabel || "negócios locais",
    meu_nome: settings.sellerName || "um web designer da zona",
    preco: settings.sitePrice || 450,
  };
  return text.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
}

export function whatsappLink(lead, message) {
  if (!lead.whatsapp) return null;
  return `https://wa.me/${lead.whatsapp}?text=${encodeURIComponent(message)}`;
}

export function mapsLink(lead) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lead.name} ${lead.city || ""}`.trim())}`;
}

export function googleCheckLink(lead, districtName) {
  return `https://www.google.com/search?q=${encodeURIComponent(`"${lead.name}" ${lead.city || districtName || ""}`)}`;
}
