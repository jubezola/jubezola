// Normalização e classificação de telefones (PT +351 e BR +55) em E.164.
// Regras: PT móvel 91/92/93/96, fixo começa por 2. BR: DDD + 9 dígitos a começar por 9 = móvel; DDD + 8 dígitos = fixo.

const BR_DDD = new Set("11 12 13 14 15 16 17 18 19 21 22 24 27 28 31 32 33 34 35 37 38 41 42 43 44 45 46 47 48 49 51 53 54 55 61 62 63 64 65 66 67 68 69 71 73 74 75 77 79 81 82 83 84 85 86 87 88 89 91 92 93 94 95 96 97 98 99".split(" "));

function pt(n) {
  if (n.length !== 9) return null;
  if (/^9[1236]/.test(n)) return { e164: "+351" + n, tipo: "movel", pais: "PT" };
  if (/^2/.test(n)) return { e164: "+351" + n, tipo: "fixo", pais: "PT" };
  return null; // 80x, 70x, 30x, 9[4578] etc. ficam de fora
}

function br(n) {
  if (n.length !== 10 && n.length !== 11) return null;
  const ddd = n.slice(0, 2), sub = n.slice(2);
  if (!BR_DDD.has(ddd)) return null;
  if (sub.length === 9 && sub[0] === "9") return { e164: "+55" + n, tipo: "movel", pais: "BR" };
  if (sub.length === 8 && /^[2-5]/.test(sub)) return { e164: "+55" + n, tipo: "fixo", pais: "BR" };
  return null;
}

/**
 * @param {string} raw número em qualquer formato
 * @param {"PT"|"BR"} [country] país por omissão quando não há indicativo
 * @returns {{e164:string, tipo:"movel"|"fixo", pais:"PT"|"BR"}|null}
 */
export function classifyPhone(raw, country = "PT") {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s || /[a-z]/i.test(s.replace(/ext|ramal/gi, ""))) return null;
  let d = s.replace(/\D/g, "");
  let intl = s.startsWith("+");
  if (d.startsWith("00")) { d = d.slice(2); intl = true; }
  if (intl || (country === "PT" && d.length === 12 && d.startsWith("351")) || (country === "BR" && d.length >= 12 && d.startsWith("55"))) {
    if (d.startsWith("351")) return pt(d.slice(3));
    if (d.startsWith("55")) return br(d.slice(2));
    return null;
  }
  if (country === "BR") return br(d.replace(/^0/, ""));
  return pt(d);
}

/** Link wa.me só a partir de E.164 validado. */
export function waLink(e164, message) {
  if (!/^\+\d{10,15}$/.test(e164 || "")) return null;
  return `https://wa.me/${e164.slice(1)}?text=${encodeURIComponent(message || "")}`;
}

export function telLink(e164) {
  return /^\+\d{10,15}$/.test(e164 || "") ? `tel:${e164}` : null;
}

export function displayPhone(e164) {
  if (!e164) return "";
  if (e164.startsWith("+351")) { const n = e164.slice(4); return `+351 ${n.slice(0, 3)} ${n.slice(3, 6)} ${n.slice(6)}`; }
  if (e164.startsWith("+55")) { const n = e164.slice(3), d = n.slice(0, 2), s = n.slice(2); return `+55 (${d}) ${s.slice(0, s.length - 4)}-${s.slice(-4)}`; }
  return e164;
}
