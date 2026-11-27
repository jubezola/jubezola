// Armazenamento SQLite próprio da cópia (node:sqlite, sem dependências).
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

export const STAGES = ["encontrada", "escrita", "enviada", "respondida"];
export const RESULTS = ["interessado", "reuniao", "sem_interesse"];
export const DEFAULT_SETTINGS = { limite_diario: 40, dias_followup: 3, assinatura: "{remetente}, y.e.s" };

export function openDb(file) {
  if (file !== ":memory:") mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 3000;
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY, username TEXT NOT NULL UNIQUE, nome TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('dono','membro')), pass_hash TEXT NOT NULL, created_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS campaigns (
      id INTEGER PRIMARY KEY, criada_por INTEGER NOT NULL REFERENCES users(id),
      nicho TEXT NOT NULL, regiao TEXT NOT NULL, concelho TEXT NOT NULL DEFAULT '', pais TEXT NOT NULL DEFAULT 'PT',
      estado TEXT NOT NULL CHECK (estado IN ('a_correr','concluida','cancelada','erro')),
      request_key TEXT UNIQUE, ignoradas INTEGER NOT NULL DEFAULT 0, invalidas INTEGER NOT NULL DEFAULT 0, erro TEXT,
      created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS leads (
      id INTEGER PRIMARY KEY, campanha_id INTEGER NOT NULL REFERENCES campaigns(id),
      place_id TEXT NOT NULL UNIQUE, nome TEXT NOT NULL, categoria TEXT NOT NULL, nicho TEXT NOT NULL, cidade TEXT NOT NULL DEFAULT '',
      url_maps TEXT NOT NULL, avaliacao REAL, n_avaliacoes INTEGER,
      site_tipo TEXT NOT NULL CHECK (site_tipo IN ('nenhum','so_redes')), rede_social TEXT,
      telefone_e164 TEXT NOT NULL UNIQUE, tipo_tel TEXT NOT NULL CHECK (tipo_tel IN ('movel','fixo')),
      etapa TEXT NOT NULL DEFAULT 'encontrada' CHECK (etapa IN ('encontrada','escrita','enviada','respondida')),
      resultado TEXT CHECK (resultado IN ('interessado','reuniao','sem_interesse')),
      mensagem TEXT, mensagem_origem TEXT CHECK (mensagem_origem IN ('ia','template','editada')),
      variante INTEGER NOT NULL DEFAULT 0, falha_escrita TEXT, tentativas INTEGER NOT NULL DEFAULT 0,
      canal TEXT CHECK (canal IN ('whatsapp','chamada')), enviada_em INTEGER, enviada_por INTEGER REFERENCES users(id),
      respondida_em INTEGER, nota TEXT, followup_em INTEGER, invalido INTEGER NOT NULL DEFAULT 0, excluida INTEGER NOT NULL DEFAULT 0,
      atribuida_a INTEGER NOT NULL REFERENCES users(id), created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS leads_camp ON leads(campanha_id, etapa);
    CREATE INDEX IF NOT EXISTS leads_owner ON leads(atribuida_a, etapa);
    CREATE TABLE IF NOT EXISTS exclusions (
      key TEXT PRIMARY KEY, motivo TEXT NOT NULL, lead_id INTEGER, created_by INTEGER, created_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS sends (
      id INTEGER PRIMARY KEY, lead_id INTEGER NOT NULL, user_id INTEGER NOT NULL, dia TEXT NOT NULL, kind TEXT NOT NULL, created_at INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS sends_day ON sends(user_id, dia);
  `);
  // Campanhas que ficaram "a correr" quando o processo caiu: os leads já estão guardados.
  db.prepare("UPDATE campaigns SET estado='erro', erro='Interrompida (servidor reiniciado). Os leads encontrados foram guardados.' WHERE estado='a_correr'").run();
  return db;
}

export function tx(db, fn) {
  db.exec("BEGIN IMMEDIATE");
  try { const r = fn(); db.exec("COMMIT"); return r; } catch (e) { db.exec("ROLLBACK"); throw e; }
}

export function getSettings(db) {
  const out = { ...DEFAULT_SETTINGS };
  for (const r of db.prepare("SELECT key, value FROM settings").all()) out[r.key] = JSON.parse(r.value);
  return out;
}
export function putSettings(db, patch) {
  const st = db.prepare("INSERT INTO settings(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value");
  for (const [k, v] of Object.entries(patch)) if (k in DEFAULT_SETTINGS) st.run(k, JSON.stringify(v));
  return getSettings(db);
}
