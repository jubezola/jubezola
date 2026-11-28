// Gestão de utilizadores (corre localmente contra a BD de produção ou de desenvolvimento):
//   DATABASE_URL=... npm run user -- add <username> <dono|membro> "Nome"   (palavra-passe por PASSWORD=... ou pedida no terminal)
//   DATABASE_URL=... npm run user -- list
import { createDb } from "./db.mjs";
import { hashPassword } from "./auth.mjs";
import { createInterface } from "node:readline/promises";

const [cmd, username, role, ...nome] = process.argv.slice(2);
const db = createDb();
await db.ready();
if (cmd === "add" && username && ["dono", "membro"].includes(role)) {
  let pw = process.env.PASSWORD;
  if (!pw) { const rl = createInterface({ input: process.stdin, output: process.stdout }); pw = await rl.question("Palavra-passe (mín. 8): "); rl.close(); }
  if (!pw || pw.length < 8) { console.error("Palavra-passe com pelo menos 8 caracteres."); process.exit(1); }
  await db.q(`INSERT INTO users(username, nome, role, pass_hash, created_at) VALUES ($1,$2,$3,$4,$5)
    ON CONFLICT (username) DO UPDATE SET nome = EXCLUDED.nome, role = EXCLUDED.role, pass_hash = EXCLUDED.pass_hash`,
    [username.toLowerCase(), nome.join(" ") || username, role, hashPassword(pw), Date.now()]);
  console.log(`Utilizador ${username} (${role}) guardado.`);
} else if (cmd === "list") {
  console.table(await db.all("SELECT id, username, nome, role FROM users ORDER BY id"));
} else {
  console.log('Uso: npm run user -- add <username> <dono|membro> "Nome"  |  npm run user -- list');
}
await db.end();
