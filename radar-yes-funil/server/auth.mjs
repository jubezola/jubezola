import { randomBytes, scryptSync, timingSafeEqual, createHash, createHmac } from "node:crypto";

export const COOKIE = "rfunil_sid"; // nome distinto do original
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
// Com SESSION_SECRET definido, a sessão é um cookie assinado (HMAC) que não depende da BD:
// funciona entre instâncias serverless diferentes. Sem ele, usa a tabela sessions.
const SECRET = () => process.env.SESSION_SECRET || "";
const sign = (data) => createHmac("sha256", SECRET()).update(data).digest("base64url");
function signedToken(user) {
  const data = Buffer.from(JSON.stringify({ u: user.username, e: Date.now() + TTL })).toString("base64url");
  return `${data}.${sign(data)}`;
}
function readSigned(token) {
  const [data, mac] = String(token).split(".");
  if (!data || !mac) return null;
  const a = Buffer.from(mac), b = Buffer.from(sign(data));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try { const v = JSON.parse(Buffer.from(data, "base64url").toString()); return v.e > Date.now() ? v : null; } catch { return null; }
}

export async function createSession(db, userId) {
  if (SECRET()) return signedToken(await db.one("SELECT username FROM users WHERE id = $1", [userId]));
  const token = randomBytes(32).toString("base64url");
  await db.q("DELETE FROM sessions WHERE expires_at < $1", [Date.now()]);
  await db.q("INSERT INTO sessions(token_hash, user_id, expires_at) VALUES ($1,$2,$3)", [sha(token), userId, Date.now() + TTL]);
  return token;
}
export async function sessionUser(db, token) {
  if (!token) return null;
  if (SECRET()) {
    const v = readSigned(token);
    return v ? db.one("SELECT id, username, nome, role FROM users WHERE username = $1", [v.u]) : null;
  }
  return db.one("SELECT u.id, u.username, u.nome, u.role FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = $1 AND s.expires_at > $2", [sha(token), Date.now()]);
}
export async function destroySession(db, token) { if (token && !SECRET()) await db.q("DELETE FROM sessions WHERE token_hash = $1", [sha(token)]); }
export function cookieHeader(token, { secure = false, clear = false } = {}) {
  return `${COOKIE}=${clear ? "" : token}; Path=/; HttpOnly; SameSite=Strict${secure ? "; Secure" : ""}; Max-Age=${clear ? 0 : TTL / 1000}`;
}
export function readCookie(req) {
  const m = (req.headers.cookie || "").match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`));
  return m ? m[1] : null;
}
