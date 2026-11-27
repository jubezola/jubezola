// Postgres (Neon/Supabase/local). Projeto/BD próprios: nunca partilha dados com o LeadRadar original.
import pg from "pg";

pg.types.setTypeParser(20, (v) => Number(v)); // BIGINT/COUNT → number (timestamps em ms cabem em 2^53)
pg.types.setTypeParser(1700, (v) => Number(v)); // NUMERIC

export const STAGES = ["encontrada", "escrita", "enviada", "respondida"];
export const RESULTS = ["interessado", "reuniao", "sem_interesse"];
export const DEFAULT_SETTINGS = { limite_diario: 40, dias_followup: 3, assinatura: "{remetente}, y.e.s" };

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY, username TEXT NOT NULL UNIQUE, nome TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('dono','membro')), pass_hash TEXT NOT NULL, created_at BIGINT NOT NULL);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY, user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at BIGINT NOT NULL);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value JSONB NOT NULL);
CREATE TABLE IF NOT EXISTS campaigns (
  id SERIAL PRIMARY KEY, criada_por INT NOT NULL REFERENCES users(id),
  nicho TEXT NOT NULL, regiao TEXT NOT NULL, concelho TEXT NOT NULL DEFAULT '', pais TEXT NOT NULL DEFAULT 'PT',
  estado TEXT NOT NULL CHECK (estado IN ('a_correr','concluida','cancelada','erro')),
  request_key TEXT UNIQUE, ignoradas INT NOT NULL DEFAULT 0, invalidas INT NOT NULL DEFAULT 0, erro TEXT,
  pendentes JSONB, obtida BOOLEAN NOT NULL DEFAULT FALSE, tentativas_pesquisa INT NOT NULL DEFAULT 0, lock_until BIGINT,
  created_at BIGINT NOT NULL, updated_at BIGINT NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS campaigns_one_running ON campaigns(criada_por) WHERE estado = 'a_correr';
CREATE TABLE IF NOT EXISTS leads (
  id SERIAL PRIMARY KEY, campanha_id INT NOT NULL REFERENCES campaigns(id),
  place_id TEXT NOT NULL UNIQUE, nome TEXT NOT NULL, categoria TEXT NOT NULL, nicho TEXT NOT NULL, cidade TEXT NOT NULL DEFAULT '',
  url_maps TEXT NOT NULL, avaliacao REAL, n_avaliacoes INT,
  site_tipo TEXT NOT NULL CHECK (site_tipo IN ('nenhum','so_redes')), rede_social TEXT,
  telefone_e164 TEXT NOT NULL UNIQUE, tipo_tel TEXT NOT NULL CHECK (tipo_tel IN ('movel','fixo')),
  etapa TEXT NOT NULL DEFAULT 'encontrada' CHECK (etapa IN ('encontrada','escrita','enviada','respondida')),
  resultado TEXT CHECK (resultado IN ('interessado','reuniao','sem_interesse')),
  mensagem TEXT, mensagem_origem TEXT CHECK (mensagem_origem IN ('ia','template','editada')),
  variante INT NOT NULL DEFAULT 0, falha_escrita TEXT, tentativas INT NOT NULL DEFAULT 0, escrita_lock BIGINT,
  canal TEXT CHECK (canal IN ('whatsapp','chamada')), enviada_em BIGINT, enviada_por INT REFERENCES users(id),
  respondida_em BIGINT, nota TEXT, followup_em BIGINT, invalido BOOLEAN NOT NULL DEFAULT FALSE, excluida BOOLEAN NOT NULL DEFAULT FALSE,
  atribuida_a INT NOT NULL REFERENCES users(id), created_at BIGINT NOT NULL, updated_at BIGINT NOT NULL);
CREATE INDEX IF NOT EXISTS leads_camp ON leads(campanha_id, etapa);
CREATE INDEX IF NOT EXISTS leads_owner ON leads(atribuida_a, etapa);
CREATE TABLE IF NOT EXISTS exclusions (
  key TEXT PRIMARY KEY, motivo TEXT NOT NULL, lead_id INT, created_by INT, created_at BIGINT NOT NULL);
CREATE TABLE IF NOT EXISTS sends (
  id SERIAL PRIMARY KEY, lead_id INT NOT NULL, user_id INT NOT NULL, dia TEXT NOT NULL, kind TEXT NOT NULL, created_at BIGINT NOT NULL);
CREATE INDEX IF NOT EXISTS sends_day ON sends(user_id, dia);
CREATE TABLE IF NOT EXISTS rate_hits (key TEXT NOT NULL, ts BIGINT NOT NULL);
CREATE INDEX IF NOT EXISTS rate_hits_key ON rate_hits(key, ts);
`;

function wrap(runner) {
  return {
    q: (sql, params = []) => runner(sql, params),
    one: async (sql, params = []) => (await runner(sql, params)).rows[0] || null,
    all: async (sql, params = []) => (await runner(sql, params)).rows,
  };
}

export function createDb(url = process.env.DATABASE_URL) {
  if (!url) throw new Error("DATABASE_URL em falta. Define a ligação ao Postgres (ver .env.example).");
  const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
  const pool = new pg.Pool({
    connectionString: url, max: process.env.VERCEL ? 3 : 10, idleTimeoutMillis: 10000, connectionTimeoutMillis: 10000,
    ssl: local || /sslmode=disable/.test(url) ? false : { rejectUnauthorized: true },
  });
  pool.on("error", (e) => console.error("pg pool:", e.message));
  const db = wrap((sql, p) => pool.query(sql, p));
  let ready;
  db.ready = () => (ready ||= pool.query(SCHEMA).catch((e) => { ready = null; throw e; }));
  db.tx = async (fn) => {
    const c = await pool.connect();
    try {
      await c.query("BEGIN");
      const r = await fn(wrap((sql, p) => c.query(sql, p)));
      await c.query("COMMIT");
      return r;
    } catch (e) { await c.query("ROLLBACK").catch(() => {}); throw e; }
    finally { c.release(); }
  };
  db.end = () => pool.end();
  return db;
}

export async function getSettings(db) {
  const out = { ...DEFAULT_SETTINGS };
  for (const r of await db.all("SELECT key, value FROM settings")) out[r.key] = r.value;
  return out;
}
export async function putSettings(db, patch) {
  for (const [k, v] of Object.entries(patch)) if (k in DEFAULT_SETTINGS)
    await db.q("INSERT INTO settings(key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value", [k, JSON.stringify(v)]);
  return getSettings(db);
}

/** Rate limit persistente (funciona entre instâncias serverless). */
export async function allow(db, key, max, windowMs) {
  const now = Date.now();
  await db.q("DELETE FROM rate_hits WHERE key = $1 AND ts < $2", [key, now - windowMs]);
  const { n } = await db.one("SELECT COUNT(*) n FROM rate_hits WHERE key = $1", [key]);
  if (n >= max) return false;
  await db.q("INSERT INTO rate_hits(key, ts) VALUES ($1, $2)", [key, now]);
  return true;
}
