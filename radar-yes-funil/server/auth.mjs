import { randomBytes, scryptSync, timingSafeEqual, createHash } from "node:crypto";

export const COOKIE = "rfunil_sid"; // nome distinto: em localhost os cookies são partilhados entre portas
const TTL = 14 * 86400000;
const sha = (s) => createHash("sha256").update(s).digest("hex");

export function hashPassword(pw) {
  const salt = randomBytes(16);
  return `scrypt$${salt.toString("hex")}$${scryptSync(pw, salt, 64).toString("hex")}`;
}
export function verifyPassword(pw, stored) {
  const [, salt, hash] = String(stored).split("$");
  if (!salt || !hash) return false;
  const a = scryptSync(String(pw), Buffer.from(salt, "hex"), 64), b = Buffer.from(hash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

export function createSession(db, userId) {
  const token = randomBytes(32).toString("base64url");
  db.prepare("DELETE FROM sessions WHERE expires_at < ?").run(Date.now());
  db.prepare("INSERT INTO sessions(token_hash, user_id, expires_at) VALUES (?,?,?)").run(sha(token), userId, Date.now() + TTL);
  return token;
}
export function sessionUser(db, token) {
  if (!token) return null;
  return db.prepare("SELECT u.id, u.username, u.nome, u.role FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?")
    .get(sha(token), Date.now()) || null;
}
export function destroySession(db, token) { if (token) db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(sha(token)); }

export function cookieHeader(token, { secure = false, clear = false } = {}) {
  return `${COOKIE}=${clear ? "" : token}; Path=/; HttpOnly; SameSite=Strict${secure ? "; Secure" : ""}; Max-Age=${clear ? 0 : TTL / 1000}`;
}
export function readCookie(req) {
  const m = (req.headers.cookie || "").match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`));
  return m ? m[1] : null;
}

/** Limite simples por chave (janela deslizante em memória). */
export function rateLimiter(max, windowMs) {
  const hits = new Map();
  return (key) => {
    const now = Date.now();
    const arr = (hits.get(key) || []).filter((t) => now - t < windowMs);
    if (arr.length >= max) { hits.set(key, arr); return false; }
    arr.push(now); hits.set(key, arr);
    if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(k);
    return true;
  };
}
