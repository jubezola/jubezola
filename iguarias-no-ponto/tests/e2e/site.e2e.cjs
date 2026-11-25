// Testes E2E com Playwright. Uso: BASE_URL=http://localhost:3000 node tests/e2e/site.e2e.cjs
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const BASE = process.env.BASE_URL || "http://localhost:3000";
let pass = 0, fail = 0;
async function t(name, fn) {
  try { await fn(); pass++; console.log("  ok   " + name); }
  catch (e) { fail++; console.log("  FAIL " + name + "\n       " + e.message.split("\n")[0]); }
}

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const newPage = async (opts = {}, when) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "pt-PT", ...opts });
    const p = await ctx.newPage();
    p.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    p.on("pageerror", (e) => errors.push(e.message));
    if (when) await p.clock.setFixedTime(new Date(when));
    await p.goto(BASE, { waitUntil: "networkidle" });
    return p;
  };

  console.log("Badge Aberto/Fechado (Europe/Lisbon, relógio simulado)");
  const badgeCases = [
    ["2026-11-23T13:00:00Z", "Aberto agora", "Fecha às 14:30"],
    ["2026-11-23T16:00:00Z", "Fechado", "Abre às 19:00"],
    ["2026-11-23T20:00:00Z", "Aberto agora", "Fecha às 21:00"],
    ["2026-11-23T10:00:00Z", "Fechado", "Abre às 12:00"],
    ["2026-11-27T21:30:00Z", "Fechado", "Abre amanhã às 12:00"],
    ["2026-11-28T16:00:00Z", "Fechado", "Abre segunda às 12:00"],
    ["2026-11-29T13:00:00Z", "Encerrado hoje", "Abre amanhã às 12:00"],
    ["2026-07-04T11:30:00Z", "Aberto agora", "Fecha às 14:30"],
  ];
  for (const [when, label, detail] of badgeCases) {
    await t(`${when} → ${label} · ${detail}`, async () => {
      const p = await newPage({}, when);
      const txt = await p.getByTestId("open-badge").first().innerText();
      assert.ok(txt.includes(label) && txt.includes(detail), txt);
      await p.context().close();
    });
  }

  console.log("Horário: dia de hoje destacado");
  await t("domingo destacado como hoje", async () => {
    const p = await newPage({}, "2026-11-29T13:00:00Z");
    const row = p.locator('[data-testid="hours-table"] tr[aria-current="date"]');
    assert.equal(await row.count(), 1);
    assert.match(await row.innerText(), /Domingo[\s\S]*Encerrado/);
    await p.context().close();
  });

  const p = await newPage({}, "2026-11-25T13:00:00Z");

  console.log("Links e âncoras");
  await t("todas as âncoras internas apontam para ids existentes", async () => {
    const missing = await p.$$eval('a[href^="#"]', (as) => as.map((a) => a.getAttribute("href")).filter((h) => !document.getElementById(h.slice(1))));
    assert.deepEqual([...new Set(missing)], []);
  });
  await t("links WhatsApp usam o número oficial e texto codificado", async () => {
    const hrefs = await p.$$eval('a[href*="wa.me"]', (as) => as.map((a) => a.href));
    assert.ok(hrefs.length >= 8, "n=" + hrefs.length);
    for (const h of hrefs) {
      assert.ok(h.startsWith("https://wa.me/351962473807"), h);
      assert.ok(!/\s/.test(h), "espaço por codificar: " + h);
      const q = new URL(h).searchParams.get("text");
      if (q !== null) assert.ok(q.length > 0);
    }
  });
  await t("links tel: apenas para os dois números", async () => {
    const tels = [...new Set(await p.$$eval('a[href^="tel:"]', (as) => as.map((a) => a.getAttribute("href"))))].sort();
    assert.deepEqual(tels, ["tel:+351962473807", "tel:+351965632844"]);
  });
  await t("links externos abrem em novo separador com rel=noopener", async () => {
    const bad = await p.$$eval('a[target="_blank"]', (as) => as.filter((a) => !/noopener/.test(a.rel)).map((a) => a.href));
    assert.deepEqual(bad, []);
  });
  await t("eatbu, Facebook e dois Instagram presentes", async () => {
    for (const sel of ['a[href="https://iguariasnoponto.eatbu.com"]', 'a[href*="facebook.com/IguariasNoPonto"]', 'a[href*="instagram.com/iguarias_no_ponto"]', 'a[href*="instagram.com/marmitas.no.ponto"]'])
      assert.ok((await p.locator(sel).count()) > 0, sel);
  });
  await t("clicar 'Ver ementa do dia' leva à secção", async () => {
    await p.getByRole("link", { name: "Ver ementa do dia" }).click();
    await p.waitForTimeout(900);
    const top = await p.$eval("#ementa", (el) => el.getBoundingClientRect().top);
    assert.ok(Math.abs(top) < 120, "top=" + top);
  });

  console.log("Imagens, SEO, acessibilidade básica");
  await t("todas as imagens carregadas e com alt", async () => {
    await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 500) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 50)); } });
    await p.waitForTimeout(1000);
    const imgs = await p.$$eval("main img", (is) => is.filter((i) => i.offsetParent !== null).map((i) => ({ alt: i.alt, ok: i.complete && i.naturalWidth > 0, src: i.currentSrc })));
    assert.ok(imgs.length >= 7, "n=" + imgs.length);
    for (const i of imgs) { assert.ok(i.ok, "não carregou: " + i.src); assert.ok(i.alt.length > 20, "alt curto: " + i.src); }
  });
  await t("JSON-LD Restaurant válido", async () => {
    const ld = JSON.parse(await p.$eval('script[type="application/ld+json"]', (s) => s.textContent));
    assert.equal(ld["@type"], "Restaurant");
    assert.equal(ld.acceptsReservations, true);
    assert.equal(ld.address.postalCode, "3030-069");
    assert.equal(ld.openingHoursSpecification.length, 2);
    assert.ok(ld.priceRange);
  });
  await t("meta pt-PT, title, description, og", async () => {
    assert.equal(await p.getAttribute("html", "lang"), "pt-PT");
    assert.match(await p.title(), /Iguarias no Ponto/);
    assert.ok(await p.$('meta[name="description"]'));
    assert.ok(await p.$('meta[property="og:image"]'));
    assert.equal(await p.$eval('meta[property="og:locale"]', (m) => m.content), "pt_PT");
  });
  await t("um único h1 e sem saltos de cabeçalho para h4+", async () => {
    assert.equal(await p.locator("h1").count(), 1);
    assert.equal(await p.locator("h4,h5,h6").count(), 0);
  });
  await t("primeiro Tab foca o link 'Saltar para a ementa'", async () => {
    const fresh = await newPage();
    await fresh.keyboard.press("Tab");
    assert.match(await fresh.evaluate(() => document.activeElement.textContent), /Saltar para a ementa/);
    await fresh.context().close();
  });
  await t("alvos de toque ≥ 40px no mobile (links/botões visíveis)", async () => {
    const small = await p.$$eval("a, button", (els) => els.filter((e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && s.visibility !== "hidden" && e.closest("[aria-hidden=true]") === null && e.offsetParent !== null && (r.height < 40 || r.width < 40) && !e.classList.contains("sr-only"); }).map((e) => `${e.textContent.trim().slice(0, 30)} ${Math.round(e.getBoundingClientRect().width)}x${Math.round(e.getBoundingClientRect().height)}`));
    if (small.length) console.log('       ', small);
    assert.deepEqual(small, []);
  });

  console.log("Barra fixa no mobile");
  await t("escondida no topo, visível após o hero", async () => {
    await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(400);
    assert.equal(await p.getByTestId("mobile-bar").getAttribute("aria-hidden"), "true");
    await p.evaluate(() => window.scrollTo(0, 1500)); await p.waitForTimeout(400);
    assert.equal(await p.getByTestId("mobile-bar").getAttribute("aria-hidden"), "false");
  });

  console.log("Menu mobile");
  await t("abre, Escape fecha e devolve foco; link fecha menu", async () => {
    await p.evaluate(() => window.scrollTo(0, 0));
    const btn = p.getByRole("button", { name: "Abrir menu" });
    await btn.click();
    assert.equal(await p.locator("#menu-mobile").isVisible(), true);
    await p.keyboard.press("Escape");
    assert.equal(await p.locator("#menu-mobile").isVisible(), false);
    assert.equal(await p.evaluate(() => document.activeElement.getAttribute("aria-controls")), "menu-mobile");
    await btn.click();
    await p.locator("#menu-mobile").getByRole("link", { name: /Catering/ }).click();
    await p.waitForTimeout(2200);
    assert.equal(await p.locator("#menu-mobile").isVisible(), false);
    const top = await p.$eval("#catering", (el) => el.getBoundingClientRect().top);
    assert.ok(Math.abs(top) < 120, "top=" + top);
  });

  console.log("Formulário de catering");
  await p.evaluate(() => { window.__opened = []; window.open = (u) => { window.__opened.push(u); return {}; }; });
  const form = p.locator("#catering form");
  await t("submeter vazio mostra erros e foca o primeiro campo", async () => {
    await form.getByRole("button", { name: /Enviar pedido/ }).click();
    assert.equal(await p.getByTestId("form-error").isVisible(), true);
    assert.match(await p.getByTestId("form-error").innerText(), /4 campos/);
    assert.equal(await p.evaluate(() => document.activeElement.name), "nome");
    assert.equal(await form.locator('[aria-invalid="true"]').count(), 4);
    assert.deepEqual(await p.evaluate(() => window.__opened), []);
  });
  await t("telefone inválido, data passada e pessoas=0 são rejeitados", async () => {
    await form.locator('[name="nome"]').fill("Ana Sá");
    await form.locator('[name="telefone"]').fill("12345");
    await form.locator('[name="data"]').fill("2026-11-20");
    await form.locator('[name="pessoas"]').fill("0");
    await form.getByRole("button", { name: /Enviar pedido/ }).click();
    const txt = await form.innerText();
    assert.match(txt, /Telefone inválido/); assert.match(txt, /não pode ser no passado/); assert.match(txt, /a partir de 1/);
    assert.deepEqual(await p.evaluate(() => window.__opened), []);
  });
  await t("pedido válido abre WhatsApp com mensagem correta e mostra sucesso", async () => {
    await form.locator('[name="telefone"]').fill("912 345 678");
    await form.locator('[name="data"]').fill("2026-12-20");
    await form.locator('[name="pessoas"]').fill("25");
    await form.locator('[name="mensagem"]').fill("Almoço de Natal da empresa.\nDuas pessoas sem glúten. Açúcar & café?");
    await form.getByRole("button", { name: /Enviar pedido/ }).click();
    await p.getByTestId("form-success").waitFor();
    const [url] = await p.evaluate(() => window.__opened);
    assert.ok(url.startsWith("https://wa.me/351962473807?text="), url);
    const msg = new URL(url).searchParams.get("text");
    console.log("       mensagem gerada:\n" + msg.split("\n").map((l) => "         | " + l).join("\n"));
    assert.match(msg, /Nome: Ana Sá\nTelefone: 912 345 678\nData: domingo, 20 de dezembro de 2026\nPessoas: 25/);
    assert.match(msg, /Almoço de Natal da empresa\.\nDuas pessoas sem glúten\. Açúcar & café\?/);
    assert.ok(url.includes("%26") && url.includes("%0A") && url.includes("%C3%A7"));
    assert.equal(await p.getByTestId("wa-link").getAttribute("href"), url);
    assert.ok(await p.getByTestId("form-success").locator('a[href="tel:+351962473807"]').count());
  });
  await t("pop-up bloqueado: sucesso continua com link manual", async () => {
    await p.getByRole("button", { name: "Fazer outro pedido" }).click();
    await p.evaluate(() => { window.open = () => null; });
    await form.locator('[name="nome"]').fill("Rui");
    await form.locator('[name="telefone"]').fill("+351 239 123 456");
    await form.locator('[name="data"]').fill("2026-11-25");
    await form.locator('[name="pessoas"]').fill("4");
    await form.getByRole("button", { name: /Enviar pedido/ }).click();
    await p.getByTestId("form-success").waitFor();
    assert.match(await p.getByTestId("wa-link").getAttribute("href"), /^https:\/\/wa\.me\/351962473807\?text=/);
  });

  console.log("Mapa");
  await t("mapa só carrega após clique", async () => {
    assert.equal(await p.locator("#localizacao iframe").count(), 0);
    await p.getByRole("button", { name: "Mostrar mapa" }).click();
    assert.match(await p.locator("#localizacao iframe").getAttribute("src"), /^https:\/\/www\.google\.com\/maps\?q=/);
    assert.ok(await p.locator('a[href^="https://www.google.com/maps/dir/?api=1&destination="]').count());
  });

  console.log("API opcional");
  await t("/api/encomenda responde 501 sem configuração", async () => {
    const r = await p.request.post(BASE + "/api/encomenda", { data: {} });
    assert.equal(r.status(), 501);
  });
  await t("robots.txt e sitemap.xml", async () => {
    assert.match(await (await p.request.get(BASE + "/robots.txt")).text(), /Sitemap:/);
    assert.match(await (await p.request.get(BASE + "/sitemap.xml")).text(), /<urlset/);
    assert.equal((await p.request.get(BASE + "/opengraph-image")).headers()["content-type"], "image/png");
  });

  const relevant = errors.filter((e) => !/google|maps|gstatic|ERR_|net::|Failed to load resource/i.test(e));
  await t("sem erros na consola", async () => assert.deepEqual(relevant, []));
  if (errors.length !== relevant.length) console.log("       (ignorados, rede externa do mapa:", errors.length - relevant.length, ")");

  await browser.close();
  console.log(`\n${pass} passaram, ${fail} falharam`);
  process.exit(fail ? 1 : 0);
})();
