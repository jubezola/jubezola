import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mockOverpass, fixture, freshDbUrl, client, drive } from "./helpers.mjs";

let ov, app, srv, base, db, owner, member, failNames = new Set();
before(async () => {
  ov = await mockOverpass({ elements: fixture(60, 1) });
  process.env.OVERPASS_URL = ov.url;
  const { createApp } = await import("../server/app.mjs");
  const { createDb } = await import("../server/db.mjs");
  const { hashPassword } = await import("../server/auth.mjs");
  const { firstMessage } = await import("../server/messages.mjs");
  db = createDb(await freshDbUrl());
  app = createApp({ db, jobOptions: { batchSize: 10,
    generate: (lead, ctx, v) => { if (failNames.has(lead.nome)) throw new Error("falha simulada"); return firstMessage(lead, ctx, v); } } });
  await db.ready();
  for (const [u, n, r, p] of [["dona", "Dona Ana", "dono", "segredo-dona"], ["rui", "Rui", "membro", "segredo-rui"]])
    await db.q("INSERT INTO users(username, nome, role, pass_hash, created_at) VALUES ($1,$2,$3,$4,$5)", [u, n, r, hashPassword(p), Date.now()]);
  srv = createServer(app.handle);
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${srv.address().port}`;
  owner = client(base); member = client(base);
  assert.equal((await owner.login("dona", "segredo-dona")).status, 200);
  assert.equal((await member.login("rui", "segredo-rui")).status, 200);
});
after(async () => { srv.close(); ov.server.close(); await db.end(); });

const stats = async (c, q = "campanha=todas") => (await c.call("/api/stats?" + q)).data.counts;
const camp = async (c, id) => (await c.call("/api/stats?campanha=" + id)).data.campanha;

test("401 sem sessão em todas as rotas", async () => {
  const anon = client(base);
  assert.equal((await anon.call("/api/session")).data.autenticado, false);
  for (const [p, m] of [["/api/me", "GET"], ["/api/stats", "GET"], ["/api/leads", "GET"], ["/api/campaigns", "POST"], ["/api/campaigns/1/step", "POST"], ["/api/write", "POST"], ["/api/leads/1/send", "POST"], ["/api/settings", "PUT"]]) {
    assert.equal((await anon.call(p, { method: m, body: m === "GET" ? undefined : {} })).status, 401, p);
  }
  assert.equal((await anon.login("dona", "errada")).status, 401);
});

test("CSRF: Origin estranho e Content-Type errado são recusados", async () => {
  assert.equal((await member.call("/api/campaigns", { method: "POST", body: {}, headers: { Origin: "https://mal.example" } })).status, 403);
  const r = await member.call("/api/leads/1/send", { method: "POST", headers: { "Content-Type": "text/plain" } });
  assert.equal(r.status, 415);
});

let memberCamp;
test("START duplicado cria uma só campanha; pesquisa por passos encontra, deduplica e escreve", async () => {
  const body = { nicho: "todos", regiao: "lisboa", concelho: "", request_key: "chave-duplo-clique-1" };
  const rs = await Promise.all([1, 2, 3].map(() => member.call("/api/campaigns", { method: "POST", body })));
  assert.equal(new Set(rs.map((r) => r.data.campanha.id)).size, 1);
  const other = await member.call("/api/campaigns", { method: "POST", body: { ...body, request_key: "outra-chave-xyz" } });
  assert.equal(other.data.campanha.id, rs[0].data.campanha.id, "uma pesquisa a correr por pessoa");
  memberCamp = rs[0].data.campanha.id;
  assert.equal((await db.one("SELECT COUNT(*) n FROM campaigns")).n, 1);
  // passos simultâneos (2 separadores) não duplicam nada
  await Promise.all([1, 2, 3].map(() => member.call(`/api/campaigns/${memberCamp}/step`, { method: "POST", body: {} })));
  await drive(member, memberCamp);
  const done = await camp(member, memberCamp);
  assert.equal(done.estado, "concluida");
  const s = await stats(member);
  assert.equal(s.encontradas, 45); // 60 elementos: 10 inválidos, 5 fechados
  assert.equal(s.escritas, 45);
  assert.equal(done.invalidas, 10);
  assert.equal(done.ignoradas, 0);
  const leads = (await member.call("/api/leads?campanha=todas&limite=100")).data.leads;
  assert.ok(leads.every((l) => l.mensagem && l.mensagem_origem === "template"));
  assert.ok(leads.some((l) => l.site_tipo === "so_redes"));
  assert.ok(leads.filter((l) => l.tipo_tel === "fixo").every((l) => l.guiao?.length === 3 && !l.wa));
  assert.ok(leads.filter((l) => l.tipo_tel === "movel").every((l) => l.wa.startsWith("https://wa.me/351")));
});

test("deduplicação na equipa: o dono repete a pesquisa e tudo é ignorado", async () => {
  const r = await owner.call("/api/campaigns", { method: "POST", body: { nicho: "todos", regiao: "lisboa", request_key: "dono-chave-0001" } });
  await drive(owner, r.data.campanha.id);
  const done = await camp(owner, r.data.campanha.id);
  assert.equal(done.ignoradas, 45);
  assert.equal((await stats(owner, "campanha=" + done.id)).encontradas, 0);
});

test("permissões: membro não vê nem altera leads alheios (403); dono vê tudo", async () => {
  const { id: ownerLeadId } = await db.one(`INSERT INTO leads(campanha_id, place_id, nome, categoria, nicho, url_maps, site_tipo, telefone_e164, tipo_tel, etapa, mensagem, mensagem_origem, atribuida_a, created_at, updated_at)
    VALUES ($1,'osm:node/999999','<img src=x onerror=alert(1)>','Café','restauracao','https://maps','nenhum','+351919999999','movel','escrita','Olá, mensagem de teste suficientemente longa?','template',1,$2,$2) RETURNING id`, [memberCamp, Date.now()]);
  assert.equal((await member.call(`/api/leads/${ownerLeadId}/send`, { method: "POST", body: {} })).status, 403);
  assert.equal((await member.call(`/api/leads/${ownerLeadId}`)).status, 403);
  assert.equal((await member.call(`/api/leads/${ownerLeadId}/regenerate`, { method: "POST", body: {} })).status, 403);
  const ownerCampId = (await db.one("SELECT id FROM campaigns WHERE criada_por = 1")).id;
  assert.equal((await member.call(`/api/campaigns/${ownerCampId}/step`, { method: "POST", body: {} })).status, 403);
  assert.equal((await member.call(`/api/stats?campanha=${ownerCampId}`)).status, 403);
  const mine = (await member.call("/api/leads?campanha=todas&limite=100")).data;
  assert.ok(mine.leads.every((l) => l.atribuida_a === 2));
  assert.equal((await owner.call("/api/leads?campanha=todas&limite=100")).data.total, 46);
  assert.equal((await member.call(`/api/leads/${ownerLeadId}/assign`, { method: "POST", body: { user_id: 2 } })).status, 403);
  assert.equal((await owner.call(`/api/leads/${ownerLeadId}/assign`, { method: "POST", body: { user_id: 2 } })).status, 200);
  assert.equal((await member.call(`/api/leads/${ownerLeadId}`)).status, 200);
  assert.equal((await member.call("/api/settings", { method: "PUT", body: { limite_diario: 1 } })).status, 403);
});

test("transições: só para a frente, Anular recua um passo, invariante e taxa", async () => {
  assert.equal((await stats(member)).taxa, null);
  const [a, b] = (await member.call("/api/leads?campanha=todas&so_etapa=escrita&limite=100")).data.leads;
  const post = (id, action, body = {}) => member.call(`/api/leads/${id}/${action}`, { method: "POST", body });
  assert.equal((await post(a.id, "respond", { resultado: "interessado" })).status, 409);
  assert.equal((await post(a.id, "send", { canal: "whatsapp" })).status, 200);
  assert.equal((await post(a.id, "send")).status, 409);
  assert.equal((await post(a.id, "edit", { mensagem: "x".repeat(30) })).status, 409);
  assert.equal((await post(a.id, "respond", { resultado: "hack" })).status, 400);
  assert.equal((await post(a.id, "respond", { resultado: "reuniao", nota: "Quinta 10h" })).data.lead.etapa, "respondida");
  let s = await stats(member);
  assert.equal(s.enviadas, 1); assert.equal(s.respostas, 1); assert.equal(s.reunioes, 1); assert.equal(s.taxa, 1);
  assert.ok(s.encontradas >= s.escritas && s.escritas >= s.enviadas && s.enviadas >= s.respostas);
  assert.equal((await post(a.id, "undo")).data.lead.etapa, "enviada");
  assert.equal((await post(a.id, "undo")).data.lead.etapa, "escrita");
  const full = (await member.call("/api/stats?campanha=todas")).data;
  assert.equal(full.counts.enviadas, 0); assert.equal(full.envios_hoje, 0);
  assert.equal((await post(b.id, "edit", { mensagem: "veja https://x.pt agora por favor" })).status, 400);
  assert.equal((await post(b.id, "edit", { mensagem: "Olá! Mensagem editada à mão, posso enviar?" })).data.lead.mensagem_origem, "editada");
  const regen = await member.call(`/api/leads/${b.id}/regenerate`, { method: "POST", body: {} });
  assert.equal(regen.data.lead.mensagem_origem, "template");
});

test("sem interesse e não contactar vão para a lista de exclusão e não voltam em pesquisas", async () => {
  const [a, b] = (await member.call("/api/leads?campanha=todas&so_etapa=escrita&limite=100")).data.leads.filter((l) => l.place_id !== "osm:node/999999");
  await member.call(`/api/leads/${a.id}/send`, { method: "POST", body: {} });
  await member.call(`/api/leads/${a.id}/respond`, { method: "POST", body: { resultado: "sem_interesse" } });
  await member.call(`/api/leads/${b.id}/exclude`, { method: "POST", body: {} });
  await db.q("DELETE FROM leads"); await db.q("DELETE FROM sends");
  const r = await member.call("/api/campaigns", { method: "POST", body: { nicho: "todos", regiao: "lisboa", request_key: "depois-exclusao-01" } });
  await drive(member, r.data.campanha.id);
  const done = await camp(member, r.data.campanha.id);
  assert.equal(done.ignoradas, 2);
  const ids = (await member.call(`/api/leads?campanha=${done.id}&limite=100`)).data.leads.map((l) => l.place_id);
  assert.ok(!ids.includes(a.place_id) && !ids.includes(b.place_id));
});

test("limite diário (também em pedidos simultâneos) e follow-up (máximo 1)", async () => {
  assert.equal((await owner.call("/api/settings", { method: "PUT", body: { limite_diario: 2, dias_followup: 3 } })).status, 200);
  assert.equal((await owner.call("/api/settings", { method: "PUT", body: { limite_diario: 0 } })).status, 400);
  const leads = (await member.call("/api/leads?campanha=todas&so_etapa=escrita&limite=5")).data.leads;
  const rs = await Promise.all(leads.map((l) => member.call(`/api/leads/${l.id}/send`, { method: "POST", body: {} })));
  assert.equal(rs.filter((r) => r.status === 200).length, 2);
  assert.equal(rs.filter((r) => r.status === 429).length, 3);
  await owner.call("/api/settings", { method: "PUT", body: { limite_diario: 40 } });
  const sent = rs.findIndex((r) => r.status === 200), id = leads[sent].id;
  assert.equal((await member.call(`/api/leads/${id}/followup`, { method: "POST", body: {} })).status, 409, "ainda cedo");
  await db.q("UPDATE leads SET enviada_em = $1 WHERE id = $2", [Date.now() - 4 * 86400000, id]);
  const l = (await member.call(`/api/leads/${id}`)).data.lead;
  assert.equal(l.followup, true); assert.ok(l.followup_msg.endsWith("y.e.s"));
  assert.equal((await stats(member)).followups, 1);
  assert.equal((await member.call(`/api/leads/${id}/followup`, { method: "POST", body: {} })).status, 200);
  assert.equal((await member.call(`/api/leads/${id}/followup`, { method: "POST", body: {} })).status, 409, "máximo 1 follow-up");
});

test("falha na escrita de um lead não pára os outros; Tentar de novo resolve", async () => {
  const els = fixture(12, 7);
  failNames = new Set([els[0].tags.name, els[1].tags.name]);
  ov.state.elements = els;
  const r = await owner.call("/api/campaigns", { method: "POST", body: { nicho: "todos", regiao: "lisboa", request_key: "falhas-escrita-01" } });
  const id = r.data.campanha.id;
  await drive(owner, id);
  const s = await stats(owner, "campanha=" + id);
  assert.equal(s.falhas_escrita, 2);
  assert.equal(s.escritas, s.encontradas - 2);
  failNames = new Set();
  for (const l of (await owner.call(`/api/leads?campanha=${id}&falha=1`)).data.leads)
    assert.equal((await owner.call(`/api/leads/${l.id}/retry`, { method: "POST", body: {} })).status, 200);
  await drive(owner);
  const s2 = await stats(owner, "campanha=" + id);
  assert.equal(s2.falhas_escrita, 0); assert.equal(s2.escritas, s2.encontradas);
});

test("cancelamento a meio guarda o parcial; recarregar não perde leads", async () => {
  ov.state.elements = fixture(200, 9);
  const r = await member.call("/api/campaigns", { method: "POST", body: { nicho: "todos", regiao: "lisboa", request_key: "cancelar-meio-01" } });
  const id = r.data.campanha.id;
  const c = await drive(member, id, { stopAfterSteps: 3 }); // obter + 2 lotes de 10
  assert.equal(c.estado, "a_correr");
  assert.ok(c.pendentes > 0);
  assert.equal((await member.call(`/api/campaigns/${id}/cancel`, { method: "POST", body: {} })).data.campanha.estado, "cancelada");
  assert.equal((await member.call(`/api/campaigns/${id}/step`, { method: "POST", body: {} })).data.campanha.estado, "cancelada");
  const s = await stats(member, "campanha=" + id);
  assert.ok(s.encontradas > 0 && s.encontradas <= 20, `parcial: ${s.encontradas}`);
  assert.equal((await member.call(`/api/campaigns/999/cancel`, { method: "POST", body: {} })).status, 404);
});

test("Overpass em baixo: 3 tentativas e depois erro, sem bloquear novas pesquisas", async () => {
  ov.state.status = 503;
  const r = await member.call("/api/campaigns", { method: "POST", body: { nicho: "todos", regiao: "porto", request_key: "overpass-em-baixo" } });
  const id = r.data.campanha.id;
  for (let i = 0; i < 3; i++) await member.call(`/api/campaigns/${id}/step`, { method: "POST", body: {} });
  const c = await camp(member, id);
  assert.equal(c.estado, "erro"); assert.match(c.erro, /OpenStreetMap|ocupado|servidor/i);
  ov.state.status = 0;
  const again = await member.call("/api/campaigns", { method: "POST", body: { nicho: "todos", regiao: "porto", request_key: "overpass-de-volta" } });
  assert.equal(again.status, 201);
  await member.call(`/api/campaigns/${again.data.campanha.id}/cancel`, { method: "POST", body: {} });
});

test("validação de inputs e caminhos", async () => {
  const post = (body) => member.call("/api/campaigns", { method: "POST", body });
  assert.equal((await post({ nicho: "todos", regiao: "atlantida", request_key: "valida-0001" })).status, 400);
  assert.equal((await post({ nicho: "x", regiao: "lisboa", request_key: "valida-0002" })).status, 400);
  assert.equal((await post({ nicho: "todos", regiao: "lisboa", request_key: "a" })).status, 400);
  assert.equal((await member.call("/api/leads?nome=%25&limite=9999&pagina=-5")).status, 200);
  assert.equal((await member.call("/api/leads?pessoa=1%3BDROP")).status, 200);
  assert.notEqual((await fetch(base + "/../server/app.mjs")).status, 200);
});
