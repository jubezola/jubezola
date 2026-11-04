// Transforma elementos do OpenStreetMap em leads prontos a contactar.
import { categorize, TYPE_LABELS, PUBLIC_NAME_RE } from "./data.js";

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

  const instagram = parseInstagram(t["contact:instagram"] || t.instagram);
  if (!phones.length && !instagram) return null;

  const facebook = parseFacebook(t["contact:facebook"] || t.facebook);
  const email = (t.email || t["contact:email"] || "").split(/[;,\s]/)[0] || null;
  const hasWebsite = Boolean(t.website || t["contact:website"] || t.url || t["contact:url"]);

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
    hours: t.opening_hours || "",
  };
  const { score, reasons } = scoreLead(lead, cat.weight);
  lead.score = score;
  lead.reasons = reasons;
  lead.heat = score >= 75 ? "quente" : score >= 55 ? "morno" : "frio";
  return lead;
}

/** Pontuação 0–100: probabilidade de o negócio responder e comprar um website. */
export function scoreLead(l, weight = 10) {
  let s = 22 + weight;
  const reasons = [];
  if (l.whatsapp) { s += 28; reasons.push("WhatsApp"); }
  else if (l.phones.length) { s += 12; reasons.push("Telefone fixo"); }
  if (l.instagram) { s += 12; reasons.push("Ativo no Instagram"); }
  if (l.facebook) { s += 6; reasons.push("Tem Facebook"); }
  if (l.email) { s += 5; reasons.push("Email público"); }
  if (l.hours) { s += 6; reasons.push("Horário publicado"); }
  if (l.street) s += 4;
  if (l.hasWebsite) { s -= 45; reasons.push("Já tem website"); }
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
