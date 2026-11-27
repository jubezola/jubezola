// E2E: fluxo completo a 1280 e 390 px com Playwright (Overpass simulado). Uso: npm run e2e
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { createServer } from "node:http";
import { mockOverpass, fixture, freshDbUrl } from "./helpers.mjs";

const OUT = process.env.E2E_OUT || "test-results";
mkdirSync(OUT, { recursive: true });
const ov = await mockOverpass({ elements: fixture(60, 3), delayMs: 400 });
process.env.OVERPASS_URL = ov.url;
const { createApp } = await import("../server/app.mjs");
const { hashPassword } = await import("../server/auth.mjs");
const { createDb } = await import("../server/db.mjs");
const db = createDb(await freshDbUrl());
const app = createApp({ db, jobOptions: { batchSize: 5 } });
await db.ready();
for (const [u, n, r, p] of [["dona", "Dona Ana", "dono", "segredo-dona"], ["rui", "Rui", "membro", "segredo-rui"]])
  await db.q("INSERT INTO users(username, nome, role, pass_hash, created_at) VALUES ($1,$2,$3,$4,$5)", [u, n, r, hashPassword(p), Date.now()]);
const server = createServer(app.handle);
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const BASE = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch();
const errors = [];
async function newPage(viewport, label) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: "text/css", body: "" }));
  await ctx.route(/wa\.me|web\.whatsapp/, (r) => r.fulfill({ status: 200, contentType: "text/html", body: "<title>WA</title>" }));
  const page = await ctx.newPage();
  page.on("console", (m) => { if (m.type() === "error") errors.push(`[${label}] ${m.text()}`); });
  page.on("pageerror", (e) => errors.push(`[${label}] ${e.message}`));
  page.on("dialog", (d) => { errors.push(`[${label}] dialog inesperado: ${d.message()}`); d.dismiss(); });
  return { ctx, page };
}
const num = (page, k) => page.locator(`[data-count="${k}"]`).evaluate((el) => Number(el.dataset.v));
async function login(page, u, p) {
  await page.goto(BASE + "/");
  await page.fill("[name=username]", u); await page.fill("[name=password]", p);
  await page.click("#loginForm button[type=submit]");
  await page.waitForSelector("#app:not([hidden])");
}
const step = (name) => console.log("✓", name);

try {
  // ── Membro, desktop 1280 ──
  const { ctx: c1, page } = await newPage({ width: 1280, height: 860 }, "rui@1280");
  await login(page, "rui", "segredo-rui"); step("login membro");
  await page.selectOption("#regiao", "lisboa");
  await page.dblclick("#startBtn"); // duplo clique → 1 campanha
  await page.waitForSelector('#startBtn[data-state="running"]');
  assert.equal(await page.getAttribute("#funnel", "data-running"), "true");
  await page.waitForSelector('.step[data-step="encontrada"][data-state="active"]');
  const seen = new Set();
  for (let i = 0; i < 60 && (await num(page, "encontradas")) < 45; i++) { seen.add(await num(page, "encontradas")); await page.waitForTimeout(150); }
  assert.ok(seen.size >= 2, "o contador sobe por lotes: " + [...seen]);
  await page.waitForFunction(() => document.querySelector('[data-count="escritas"]').dataset.v === "45", null, { timeout: 15000 });
  await page.waitForSelector('.step[data-step="escrita"][data-state="done"]');
  assert.equal((await db.one("SELECT COUNT(*) n FROM campaigns")).n, 1);
  assert.equal(await page.getAttribute("#funnel", "data-running"), "false");
  assert.match(await page.textContent("#startLabel"), /Nova pesquisa/);
  await page.screenshot({ path: `${OUT}/desktop-escritas.png`, fullPage: true });
  step("pesquisa + escrita em tempo real (45 leads, 1 campanha)");

  await page.reload(); await page.waitForSelector("#app:not([hidden])");
  await page.waitForFunction(() => document.querySelector('[data-count="encontradas"]').textContent === "45");
  step("recarregar mantém os contadores");

  // filtro por linha da timeline
  await page.click('[data-filter="escrita"]');
  assert.equal(await page.getAttribute('[data-filter="escrita"]', "aria-pressed"), "true");
  await page.click('[data-filter="escrita"]');

  // XSS: nome externo malicioso não executa
  await db.q("UPDATE leads SET nome = $1 WHERE id = (SELECT MIN(id) FROM leads)", ['<img src=x onerror="alert(1)">Café']);
  await page.fill("#fNome", "Café"); await page.waitForTimeout(600);
  assert.match(await page.textContent("#list .card h3"), /<img src=x/);
  await page.fill("#fNome", ""); await page.waitForTimeout(500);
  step("dados externos escapados");

  // edição inline + regenerar
  const card = page.locator(".card").filter({ has: page.locator('[data-act="regen"]') }).first();
  const before = await card.locator("[data-msg]").inputValue();
  await card.locator('[data-act="regen"]').click();
  await page.waitForTimeout(400);
  const card2 = page.locator(`.card[data-id="${await card.getAttribute("data-id")}"]`);
  assert.notEqual(await card2.locator("[data-msg]").inputValue(), before);
  await card2.locator("[data-msg]").fill("Olá! Mensagem editada no teste, posso enviar um exemplo?");
  assert.match(await card2.locator("[data-chars]").textContent(), /\d+ caracteres/);
  await card2.locator('[data-act="save"]').click();
  await page.waitForSelector(`.card[data-id="${await card.getAttribute("data-id")}"] .b-tpl:has-text("editada")`);
  step("regenerar e editar mensagem");

  // Modo Sprint
  await page.click("#sprintBtn");
  await page.waitForSelector("#sprint[open] #spOpen");
  const first = await page.textContent("#sprintBody h3");
  await page.keyboard.press("n"); // salta
  await page.waitForFunction((f) => document.querySelector("#sprintBody h3")?.textContent !== f, first);
  await page.keyboard.press("s"); // marca enviado
  await page.waitForSelector("#sprint .toast:has-text('Anular')");
  // abrir WhatsApp → volta → "Enviaste?"
  while (!(await page.locator("#spOpen.btn-wa").count())) await page.keyboard.press("n");
  const href = await page.getAttribute("#spOpen", "href");
  assert.match(href, /^https:\/\/wa\.me\/3519\d{8}\?text=/);
  const [popup] = await Promise.all([c1.waitForEvent("page"), page.click("#spOpen")]);
  await popup.close();
  await page.waitForSelector("#spAsk .ask");
  await page.click('#spAsk [data-sp="sent"]');
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/desktop-sprint.png` });
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => document.querySelector('[data-count="enviadas"]').dataset.v === "2", null, { timeout: 5000 });
  step("Modo Sprint: saltar (N), enviar (S), WhatsApp + Enviaste?");

  // Respostas
  await page.click('[data-filter="enviada"]');
  await page.waitForSelector('.card [data-act="r-reuniao"]');
  await page.locator('.card [data-note]').first().fill("Quinta às 10h");
  await page.locator('.card [data-act="r-reuniao"]').first().click();
  await page.waitForFunction(() => document.querySelector('[data-count="respostas"]').dataset.v === "1");
  assert.match(await page.textContent("#rateSub"), /50%/);
  assert.match(await page.textContent("#meetings"), /1 reunião/);
  // Anular via toast
  await page.locator('.card [data-act="r-sem_interesse"]').first().click();
  await page.click("#toasts .toast:last-child button:has-text('Anular')");
  await page.waitForFunction(() => document.querySelector('[data-count="respostas"]').dataset.v === "1");
  await page.screenshot({ path: `${OUT}/desktop-respostas.png`, fullPage: true });
  step("respostas, taxa, reuniões e Anular");

  // Não contactar em qualquer lead
  await page.click('[data-filter="enviada"]');
  await page.locator('.card [data-act="exclude"]').first().click();
  await page.waitForSelector(".card .b-bad:has-text('Não contactar')");
  step("não contactar");

  // ── Dono ──
  const { page: op } = await newPage({ width: 1280, height: 860 }, "dona@1280");
  await login(op, "dona", "segredo-dona");
  await op.waitForSelector("#openSettings:not([hidden])");
  await op.click("#startBtn");
  await op.waitForSelector('#startBtn[data-state="done"]', { timeout: 15000 });
  await op.waitForSelector("#noteFound:has-text('45 ignoradas')");
  step("dono: pesquisa repetida → 45 ignoradas (sem sobreposição)");
  await op.selectOption("#campanha", "todas");
  await op.waitForFunction(() => document.querySelector('[data-count="encontradas"]').textContent === "45");
  await op.selectOption("#pessoa", { label: "Dona Ana" });
  await op.waitForFunction(() => document.querySelector('[data-count="encontradas"]').textContent === "0");
  await op.selectOption("#pessoa", "");
  await op.click("#openSettings");
  await op.fill("[name=limite_diario]", "3");
  await op.click("#saveSettings");
  await op.waitForSelector("#toasts .toast:has-text('Definições guardadas')");
  await op.waitForSelector(".card select[data-act=assign]");
  await op.locator(".card select[data-act=assign]").first().selectOption({ label: "Dona Ana" });
  await op.waitForSelector("#toasts .toast:has-text('Reatribuído')");
  step("dono: vê tudo, filtra por pessoa, definições e reatribuição");

  // membro deixa de ver o lead reatribuído; limite 3 aplica-se
  await page.reload(); await page.waitForSelector("#app:not([hidden])");
  await page.waitForFunction(() => document.querySelector('[data-count="encontradas"]').textContent === "44");
  assert.match(await page.textContent("#quota"), /2\/3/);
  step("membro vê só os seus leads; quota visível");

  // ── Telemóvel 390 ──
  const { page: mp } = await newPage({ width: 390, height: 844 }, "rui@390");
  await login(mp, "rui", "segredo-rui");
  await mp.waitForFunction(() => document.querySelector('[data-count="encontradas"]').textContent === "44");
  const overflow = await mp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(overflow <= 0, "sem scroll horizontal: " + overflow);
  const small = await mp.$$eval("button:not([hidden]), a.btn, select, input", (els) => els.filter((e) => e.offsetParent && Math.max(e.getBoundingClientRect().height, e.closest("label")?.getBoundingClientRect().height || 0) < 44).map((e) => e.outerHTML.slice(0, 80)));
  assert.deepEqual(small, [], "alvos de toque pequenos");
  await mp.screenshot({ path: `${OUT}/mobile-funil.png`, fullPage: false });
  await mp.click("#sprintBtn");
  await mp.waitForSelector("#sprint[open] #spOpen");
  const box = await mp.locator("#spOpen").boundingBox();
  assert.ok(box.height >= 52 && box.width > 300, "botão grande no telemóvel");
  await mp.screenshot({ path: `${OUT}/mobile-sprint.png` });
  await mp.click('[data-sp="sent"]').catch(() => {});
  step("390px: sem overflow, alvos de toque ≥44px, Sprint em ecrã inteiro");

  // 401 após logout
  await mp.click("#sprintClose");
  await mp.click("#logout");
  await mp.waitForSelector("#login:not([hidden])");
  step("logout");

  assert.deepEqual(errors, [], "consola limpa");
  step("consola sem erros");
  console.log("\nE2E OK");
} catch (e) {
  console.error("E2E FALHOU:", e.message, "\nErros de consola:", errors);
  process.exitCode = 1;
} finally {
  await browser.close(); server.close(); ov.server.close(); await db.end();
}
