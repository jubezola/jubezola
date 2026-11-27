// Gestão de utilizadores: npm run user -- add <username> <dono|membro> "<Nome>"   (palavra-passe pedida por PASSWORD=... ou stdin)
import { openDb } from "./db.mjs";
import { hashPassword } from "./auth.mjs";
import { createInterface } from "node:readline/promises";

const [cmd, username, role, ...nome] = process.argv.slice(2);
const db = openDb(process.env.DB_FILE || "data/funil.db");
if (cmd === "add" && username && ["dono", "membro"].includes(role)) {
  let pw = process.env.PASSWORD;
  if (!pw) { const rl = createInterface({ input: process.stdin, output: process.stdout }); pw = await rl.question("Palavra-passe (mín. 8): "); rl.close(); }
  if (!pw || pw.length < 8) { console.error("Palavra-passe com pelo menos 8 caracteres."); process.exit(1); }
  db.prepare("INSERT INTO users(username, nome, role, pass_hash, created_at) VALUES (?,?,?,?,?) ON CONFLICT(username) DO UPDATE SET nome=excluded.nome, role=excluded.role, pass_hash=excluded.pass_hash")
    .run(username.toLowerCase(), nome.join(" ") || username, role, hashPassword(pw), Date.now());
  console.log(`Utilizador ${username} (${role}) guardado.`);
} else if (cmd === "list") {
  console.table(db.prepare("SELECT id, username, nome, role FROM users").all());
} else {
  console.log('Uso: npm run user -- add <username> <dono|membro> "Nome"  |  npm run user -- list');
}
