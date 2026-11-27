import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyPhone, waLink, telLink } from "../server/phone.mjs";
import { firstMessage, followUpMessage, callScript } from "../server/messages.mjs";
import { isClosed, toFunnelLead } from "../server/jobs.mjs";
import { siteKind } from "../public/assets/js/leads.js";

test("telefones PT", () => {
  assert.deepEqual(classifyPhone("+351 912 345 678"), { e164: "+351912345678", tipo: "movel", pais: "PT" });
  assert.deepEqual(classifyPhone("+351 213 456 789"), { e164: "+351213456789", tipo: "fixo", pais: "PT" });
  assert.equal(classifyPhone("963 000 111").tipo, "movel");
  assert.equal(classifyPhone("00351 220 000 111").tipo, "fixo");
  assert.equal(classifyPhone("800 123 456"), null);
  assert.equal(classifyPhone("+351 94 123 4567"), null);
});
test("telefones BR", () => {
  assert.deepEqual(classifyPhone("(47) 99123-4567", "BR"), { e164: "+5547991234567", tipo: "movel", pais: "BR" });
  assert.deepEqual(classifyPhone("(47) 3371-1234", "BR"), { e164: "+554733711234", tipo: "fixo", pais: "BR" });
  assert.equal(classifyPhone("+55 47 99123-4567").tipo, "movel");
  assert.equal(classifyPhone("(47) 89123-4567", "BR"), null); // 9 dígitos sem começar por 9
});
test("telefones inválidos", () => {
  for (const v of ["91234567", "9123456789", "abc", "", null, "+351 912 34", "tel: 912abc678", "(47) 9912-34", "+44 20 7946 0958"]) assert.equal(classifyPhone(v), null, String(v));
});
test("wa.me codifica acentos e quebras de linha; só aceita E.164", () => {
  const link = waLink("+351912345678", "Olá, equipa!\nPosso enviar? — Zé, y.e.s");
  assert.equal(link, "https://wa.me/351912345678?text=Ol%C3%A1%2C%20equipa!%0APosso%20enviar%3F%20%E2%80%94%20Z%C3%A9%2C%20y.e.s");
  assert.equal(decodeURIComponent(new URL(link).searchParams.get("text") ? link.split("text=")[1] : ""), "Olá, equipa!\nPosso enviar? — Zé, y.e.s");
  assert.equal(waLink("912345678", "x"), null);
  assert.equal(waLink("+351912345678\"><script>", "x"), null);
  assert.equal(telLink("javascript:alert(1)"), null);
});

const base = { place_id: "osm:node/1", nome: "Café Avó", cidade: "Lisboa", nicho: "restauracao", site_tipo: "nenhum", telefone_e164: "+351912345678", avaliacao: null, n_avaliacoes: null };
test("mensagens: 4 linhas, 1 pergunta, sem links, assinatura, língua por país", () => {
  const m = firstMessage(base, { remetente: "Rita" });
  const lines = m.split("\n");
  assert.ok(lines.length >= 3 && lines.length <= 4);
  for (let v = 0; v < 12; v++) assert.equal((firstMessage(base, { remetente: "Rita" }, v).match(/\?/g) || []).length, 1);
  assert.ok(m.trim().endsWith("— Rita, y.e.s"));
  assert.ok(!/https?:|www\./.test(m));
  assert.match(m, /vosso|vossa|têm/);
  const br = firstMessage({ ...base, telefone_e164: "+5547991234567" }, { remetente: "Rita" });
  assert.match(br, /vocês|Oi|pessoal/);
  const rated = firstMessage({ ...base, avaliacao: 4.7, n_avaliacoes: 128 }, { remetente: "Rita" });
  assert.match(rated, /4,7★ com 128 avaliações/);
  assert.match(firstMessage({ ...base, site_tipo: "so_redes", rede_social: "Instagram" }, {}), /Instagram/);
});
test("mensagens variam entre leads e no Regenerar", () => {
  const texts = new Set();
  for (let i = 0; i < 30; i++) texts.add(firstMessage({ ...base, place_id: "osm:node/" + i, nome: "X" }, { remetente: "R" }).replace(/X/g, ""));
  assert.ok(texts.size >= 5, `só ${texts.size} variantes`);
  const vs = new Set([0, 1, 2, 3, 4, 5].map((v) => firstMessage(base, { remetente: "R" }, v)));
  assert.ok(vs.size >= 3);
  assert.match(followUpMessage(base, { remetente: "R" }), /\?.*— R, y\.e\.s$/);
  assert.equal(callScript({ ...base, mensagem: firstMessage(base, { remetente: "R" }) }, { remetente: "R" }).length, 3);
});
test("só redes conta como sem site; fechados excluídos", () => {
  assert.equal(siteKind("https://linktr.ee/x"), "social");
  assert.equal(siteKind("https://wa.me/351912345678"), "social");
  assert.equal(siteKind("https://cafe.pt"), "real");
  assert.ok(isClosed({ opening_hours: "closed" }));
  assert.ok(isClosed({ "disused:shop": "bakery" }));
  assert.ok(!isClosed({ opening_hours: "Mo-Fr 09:00-18:00" }));
  const l = { osm: "node/1", name: "A", type: "Café", cat: "restauracao", city: "", phones: [{ e164: "+351212345678" }, { e164: "+351912345678" }], site: "social", siteUrl: "https://instagram.com/a", hasWebsite: false };
  const f = toFunnelLead(l);
  assert.equal(f.tipo_tel, "movel"); assert.equal(f.site_tipo, "so_redes"); assert.equal(f.rede_social, "Instagram");
  assert.equal(toFunnelLead({ ...l, phones: [{ e164: "+351800123456" }] }), null);
  assert.equal(toFunnelLead({ ...l, site: "real", hasWebsite: true }), null);
});
