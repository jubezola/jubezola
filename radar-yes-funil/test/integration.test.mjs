import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mockOverpass, fixture, tmpDb, client, until } from "./helpers.mjs";

let ov, app, base, db, owner, member, failNames = new Set();
before(async () => {
  ov = await mockOverpass({ elements: fixture(60, 1) });
  process.env.OVERPASS_URL = ov.url;
  const { createApp } = await import("../server/app.mjs");
  const { hashPassword } = await import("../server/auth.mjs");
  const { firstMessage } = await import("../server/messages.mjs");
  app = createApp({ dbFile: tmpDb(), jobOptions: { batchPauseMs: 30, batchSize: 10,
    generate: (lead, ctx, v) => { if (failNames.has(lead.nome)) throw new Error("falha simulada"); return firstMessage(lead, ctx, v); } } });
  db = app.db;
  const add = db.prepare("INSERT INTO users(username, nome, role, pass_hash, created_at) VALUES (?,?,?,?,?)");
  add.run("dona", "Dona Ana", "dono", hashPassword("segredo-dona"), Date.now());
  add.run("rui", "Rui", "membro", hashPassword("segredo-rui"), Date.now());
  await new Promise((r) => app.server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${app.server.address().port}`;
  owner = client(base); member = client(base);
  assert.equal((await owner.login("dona", "segredo-dona")).status, 200);
  assert.equal((await member.login("rui", "segredo-rui")).status, 200);
});
after(() => { app.server.close(); ov.server.close(); });

const waitCampaign = (c, id) => until(async () => { const r = await c.call("/api/campaigns"); const x = r.data.campanhas.find((k) => k.id === id); return x && x.estado !== "a_correr" && x; });
const waitWritten = (c, q = "campanha=todas") => until(async () => { const s = (await c.call("/api/stats?" + q)).data.counts; return s.por_escrever === 0 && s; });

test("401 sem sessão em todas as rotas", async () => {
  const anon = client(base);
  for (const [p, m] of [["/api/me", "GET"], ["/api/stats", "GET"], ["/api/leads", "GET"], ["/api/campaigns", "POST"], ["/api/leads/1/send", "POST"], ["/api/settings", "PUT"]]) {
    assert.equal((await anon.call(p, { method: m, body: m === "GET" ? undefined : {} })).status, 401, p);
  }
  assert.equal((await anon.login("dona", "errada")).status, 401);
});

test("CSRF: Origin estranho e Content-Type errado são recusados", async () => {
  assert.equal((await member.call("/api/campaigns", { method: "POST", body: {}, headers: { Origin: "https://mal.example" } })).status, 403);
  const r = await fetch(base + "/api/campaigns", { method: "POST", headers: { "Content-Type": "text/plain" }, body: "{}" });
  assert.equal(r.status, 401); // sem cookie
});

let memberCamp;
test("START duplicado cria uma só campanha; pesquisa encontra, deduplica e escreve", async () => {
  const body = { nicho: "todos", regiao: "lisboa", concelho: "", request_key: "chave-duplo-clique-1" };
  const [a, b] = await Promise.all([member.call("/api/campaigns", { method: "POST", body }), member.call("/api/campaigns", { method: "POST", body })]);
  assert.equal(a.data.campanha.id, b.data.campanha.id);
  const other = await member.call("/api/campaigns", { method: "POST", body: { ...body, request_key: "outra-chave-xyz" } });
  assert.equal(other.data.campanha.id, a.data.campanha.id, "uma pesquisa a correr por pessoa");
  memberCamp = a.data.campanha.id;
  assert.equal(db.prepare("SELECT COUNT(*) n FROM campaigns").get().n, 1);
  const done = await waitCampaign(member, memberCamp);
  assert.equal(done.estado, "concluida");
  const s = await waitWritten(member);
  // 60 elementos: 10 inválidos (800…), 5 fechados → 45 leads
  assert.equal(s.encontradas, 45);
  assert.equal(s.escritas, 45);
  assert.equal(done.invalidas, 10);
  const leads = (await member.call("/api/leads?campanha=todas&limite=100")).data.leads;
  assert.ok(leads.every((l) => l.mensagem && l.mensagem_origem === "template"));
  assert.ok(leads.some((l) => l.site_tipo === "so_redes"));
  assert.ok(leads.filter((l) => l.tipo_tel === "fixo").every((l) => l.guiao?.length === 3 && !l.wa));
  assert.ok(leads.filter((l) => l.tipo_tel === "movel").every((l) => l.wa.startsWith("https://wa.me/351")));
});

test("deduplicação na equipa: o dono repete a pesquisa e tudo é ignorado", async () => {
  const r = await owner.call("/api/campaigns", { method: "POST", body: { nicho: "todos", regiao: "lisboa", request_key: "dono-chave-0001" } });
  const done = await waitCampaign(owner, r.data.campanha.id);
  assert.equal(done.ignoradas, 45);
  const s = (await owner.call("/api/stats?campanha=" + done.id)).data.counts;
  assert.equal(s.encontradas, 0);
});

test("permissões: membro não vê nem altera leads alheios (403); dono vê tudo", async () => {
  const ownerLeadId = db.prepare("INSERT INTO leads(campanha_id, place_id, nome, categoria, nicho, url_maps, site_tipo, telefone_e164, tipo_tel, etapa, mensagem, mensagem_origem, atribuida_a, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
    .run(memberCamp, "osm:node/999999", "<img src=x onerror=alert(1)>", "Café", "restauracao", "https://maps", "nenhum", "+351919999999", "movel", "escrita", "Olá, mensagem de teste suficientemente longa?", "template", 1, Date.now(), Date.now()).lastInsertRowid;
  assert.equal((await member.call(`/api/leads/${ownerLeadId}/send`, { method: "POST", body: {} })).status, 403);
  assert.equal((await member.call(`/api/leads/${ownerLeadId}`)).status, 403);
  assert.equal((await member.call(`/api/leads/${ownerLeadId}/regenerate`, { method: "POST", body: {} })).status, 403);
  const mine = (await member.call("/api/leads?campanha=todas&limite=100")).data;
  assert.ok(mine.leads.every((l) => l.atribuida_a === 2));
  const all = (await owner.call("/api/leads?campanha=todas&limite=100")).data;
  assert.equal(all.total, 46);
  assert.equal((await member.call(`/api/leads/${ownerLeadId}/assign`, { method: "POST", body: { user_id: 2 } })).status, 403);
  assert.equal((await owner.call(`/api/leads/${ownerLeadId}/assign`, { method: "POST", body: { user_id: 2 } })).status, 200);
  assert.equal((await member.call(`/api/leads/${ownerLeadId}`)).status, 200);
  assert.equal((await member.call("/api/settings", { method: "PUT", body: { limite_diario: 1 } })).status, 403);
});

test("transições: só para a frente, Anular recua um passo, invariante e taxa", async () => {
  const st0 = (await member.call("/api/stats?campanha=todas")).data.counts;
  assert.equal(st0.taxa, null);
  const leads = (await member.call("/api/leads?campanha=todas&so_etapa=escrita&limite=100")).data.leads;
  const [a, b] = leads;
  assert.equal((await member.call(`/api/leads/${a.id}/respond`, { method: "POST", body: { resultado: "interessado" } })).status, 409);
  assert.equal((await member.call(`/api/leads/${a.id}/send`, { method: "POST", body: { canal: "whatsapp" } })).status, 200);
  assert.equal((await member.call(`/api/leads/${a.id}/send`, { method: "POST", body: {} })).status, 409);
  assert.equal((await member.call(`/api/leads/${a.id}/edit`, { method: "POST", body: { mensagem: "x".repeat(30) } })).status, 409);
  assert.equal((await member.call(`/api/leads/${a.id}/respond`, { method: "POST", body: { resultado: "hack" } })).status, 400);
  assert.equal((await member.call(`/api/leads/${a.id}/respond`, { method: "POST", body: { resultado: "reuniao", nota: "Quinta 10h" } })).data.lead.etapa, "respondida");
  let s = (await member.call("/api/stats?campanha=todas")).data.counts;
  assert.equal(s.enviadas, 1); assert.equal(s.respostas, 1); assert.equal(s.reunioes, 1); assert.equal(s.taxa, 1);
  assert.ok(s.encontradas >= s.escritas && s.escritas >= s.enviadas && s.enviadas >= s.respostas);
  assert.equal((await member.call(`/api/leads/${a.id}/undo`, { method: "POST", body: {} })).data.lead.etapa, "enviada");
  assert.equal((await member.call(`/api/leads/${a.id}/undo`, { method: "POST", body: {} })).data.lead.etapa, "escrita");
  s = (await member.call("/api/stats?campanha=todas")).data;
  assert.equal(s.counts.enviadas, 0); assert.equal(s.envios_hoje, 0);
  // edição: limites e sem links
  assert.equal((await member.call(`/api/leads/${b.id}/edit`, { method: "POST", body: { mensagem: "veja https://x.pt agora por favor" } })).status, 400);
  assert.equal((await member.call(`/api/leads/${b.id}/edit`, { method: "POST", body: { mensagem: "Olá! Mensagem editada à mão, posso enviar?" } })).data.lead.mensagem_origem, "editada");
});

test("sem interesse e não contactar vão para a lista de exclusão e não voltam em pesquisas", async () => {
  const leads = (await member.call("/api/leads?campanha=todas&so_etapa=escrita&limite=100")).data.leads.filter((l) => l.place_id !== "osm:node/999999");
  const [a, b] = leads;
  await member.call(`/api/leads/${a.id}/send`, { method: "POST", body: {} });
  await member.call(`/api/leads/${a.id}/respond`, { method: "POST", body: { resultado: "sem_interesse" } });
  await member.call(`/api/leads/${b.id}/exclude`, { method: "POST", body: {} });
  // Apaga os leads (simula outra campanha) e verifica que a nova pesquisa os ignora pela lista de exclusão.
  const keepIds = [a.id, b.id];
  db.prepare(`DELETE FROM leads WHERE id NOT IN (${keepIds.join(",")})`).run();
  db.prepare(`DELETE FROM leads WHERE id IN (${keepIds.join(",")})`).run();
  db.prepare("DELETE FROM sends").run();
  const r = await member.call("/api/campaigns", { method: "POST", body: { nicho: "todos", regiao: "lisboa", request_key: "depois-exclusao-01" } });
  const done = await waitCampaign(member, r.data.campanha.id);
  assert.equal(done.ignoradas, 2);
  const names = (await member.call(`/api/leads?campanha=${done.id}&limite=100`)).data.leads.map((l) => l.place_id);
  assert.ok(!names.includes(a.place_id) && !names.includes(b.place_id));
  await waitWritten(member);
});

test("limite diário e follow-up (máximo 1)", async () => {
  assert.equal((await owner.call("/api/settings", { method: "PUT", body: { limite_diario: 2, dias_followup: 3 } })).status, 200);
  assert.equal((await owner.call("/api/settings", { method: "PUT", body: { limite_diario: 0 } })).status, 400);
  const leads = (await member.call("/api/leads?campanha=todas&so_etapa=escrita&limite=3")).data.leads;
  assert.equal((await member.call(`/api/leads/${leads[0].id}/send`, { method: "POST", body: {} })).status, 200);
  assert.equal((await member.call(`/api/leads/${leads[1].id}/send`, { method: "POST", body: {} })).status, 200);
  assert.equal((await member.call(`/api/leads/${leads[2].id}/send`, { method: "POST", body: {} })).status, 429);
  await owner.call("/api/settings", { method: "PUT", body: { limite_diario: 40 } });
  assert.equal((await member.call(`/api/leads/${leads[0].id}/followup`, { method: "POST", body: {} })).status, 409, "ainda cedo");
  db.prepare("UPDATE leads SET enviada_em = ? WHERE id = ?").run(Date.now() - 4 * 86400000, leads[0].id);
  const l = (await member.call(`/api/leads/${leads[0].id}`)).data.lead;
  assert.equal(l.followup, true); assert.ok(l.followup_msg.endsWith("y.e.s"));
  assert.equal((await member.call("/api/stats?campanha=todas")).data.counts.followups, 1);
  assert.equal((await member.call(`/api/leads/${leads[0].id}/followup`, { method: "POST", body: {} })).status, 200);
  assert.equal((await member.call(`/api/leads/${leads[0].id}/followup`, { method: "POST", body: {} })).status, 409, "máximo 1 follow-up");
});

test("falha na escrita de um lead não pára os outros; Tentar de novo resolve", async () => {
  const els = fixture(12, 7);
  failNames = new Set([els[0].tags.name, els[1].tags.name]);
  ov.state.elements = els;
  const r = await owner.call("/api/campaigns", { method: "POST", body: { nicho: "todos", regiao: "lisboa", request_key: "falhas-escrita-01" } });
  const done = await waitCampaign(owner, r.data.campanha.id);
  const s = await waitWritten(owner, "campanha=" + done.id);
  assert.equal(s.falhas_escrita, 2);
  assert.equal(s.escritas, s.encontradas - 2);
  failNames = new Set();
  const failed = (await owner.call(`/api/leads?campanha=${done.id}&falha=1`)).data.leads;
  for (const l of failed) assert.equal((await owner.call(`/api/leads/${l.id}/retry`, { method: "POST", body: {} })).status, 200);
  const s2 = await until(async () => { const c = (await owner.call("/api/stats?campanha=" + done.id)).data.counts; return c.falhas_escrita === 0 && c.por_escrever === 0 && c; });
  assert.equal(s2.escritas, s2.encontradas);
});

test("cancelamento a meio guarda o parcial e termina como cancelada", async () => {
  ov.state.elements = fixture(200, 9);
  ov.state.delayMs = 0;
  app.jobs; // lotes de 10 com pausa de 30ms → cancelar a meio
  const r = await member.call("/api/campaigns", { method: "POST", body: { nicho: "todos", regiao: "lisboa", request_key: "cancelar-meio-01" } });
  const id = r.data.campanha.id;
  await until(async () => (await member.call("/api/stats?campanha=" + id)).data.counts.encontradas > 0);
  assert.equal((await member.call(`/api/campaigns/${id}/cancel`, { method: "POST", body: {} })).data.campanha.estado, "cancelada");
  await new Promise((r) => setTimeout(r, 200));
  const c = (await member.call("/api/stats?campanha=" + id)).data;
  assert.equal(c.campanha.estado, "cancelada");
  assert.ok(c.counts.encontradas > 0 && c.counts.encontradas < 150, `parcial: ${c.counts.encontradas}`);
  assert.equal((await owner.call(`/api/campaigns/${id}/cancel`, { method: "POST", body: {} })).status, 200);
  assert.equal((await member.call(`/api/campaigns/999/cancel`, { method: "POST", body: {} })).status, 404);
});

test("validação de inputs", async () => {
  assert.equal((await member.call("/api/campaigns", { method: "POST", body: { nicho: "todos", regiao: "atlantida", request_key: "valida-0001" } })).status, 400);
  assert.equal((await member.call("/api/campaigns", { method: "POST", body: { nicho: "x", regiao: "lisboa", request_key: "valida-0002" } })).status, 400);
  assert.equal((await member.call("/api/campaigns", { method: "POST", body: { nicho: "todos", regiao: "lisboa", request_key: "a" } })).status, 400);
  assert.equal((await member.call("/api/leads?nome=%25&limite=9999")).status, 200);
  const r = await fetch(base + "/../server/app.mjs"); assert.notEqual(r.status, 200);
});
