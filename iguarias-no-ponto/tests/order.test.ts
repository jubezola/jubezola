import { test } from "node:test";
import assert from "node:assert/strict";
import { validateOrder, buildOrderMessage, isValidPhone, todayInLisbon } from "../lib/order.ts";
import { whatsappUrl } from "../lib/site.ts";
import { parseMenu, formatPrice } from "../lib/menu-parse.ts";

const now = new Date("2026-11-25T10:00:00Z");
const ok = { nome: "Ana Sá", telefone: "912 345 678", data: "2026-12-20", pessoas: "25", mensagem: "Almoço de Natal.\nSem glúten para 2." };

test("pedido válido não tem erros", () => assert.deepEqual(validateOrder(ok, now), {}));

test("campos obrigatórios", () => {
  const e = validateOrder({ nome: " ", telefone: "", data: "", pessoas: "", mensagem: "" }, now);
  assert.deepEqual(Object.keys(e).sort(), ["data", "nome", "pessoas", "telefone"]);
});

test("data no passado e inválida", () => {
  assert.ok(validateOrder({ ...ok, data: "2026-11-24" }, now).data);
  assert.ok(validateOrder({ ...ok, data: "2026-02-30" }, now).data);
  assert.equal(validateOrder({ ...ok, data: "2026-11-25" }, now).data, undefined);
});

test("pessoas", () => {
  assert.ok(validateOrder({ ...ok, pessoas: "0" }, now).pessoas);
  assert.ok(validateOrder({ ...ok, pessoas: "2.5" }, now).pessoas);
  assert.ok(validateOrder({ ...ok, pessoas: "abc" }, now).pessoas);
  assert.ok(validateOrder({ ...ok, pessoas: "5000" }, now).pessoas);
});

test("telefones", () => {
  for (const t of ["912345678", "+351 962 473 807", "00351965632844", "239 123 456", "+44 7700 900123"]) assert.ok(isValidPhone(t), t);
  for (const t of ["12345", "812345678", "abc", "+351 12"]) assert.ok(!isValidPhone(t), t);
});

test("today em Lisboa vira à meia-noite local", () => {
  assert.equal(todayInLisbon(new Date("2026-07-04T23:30:00Z")), "2026-07-05");
});

test("mensagem e URL do WhatsApp com acentos e quebras de linha", () => {
  const msg = buildOrderMessage(ok);
  assert.match(msg, /Data: domingo, 20 de dezembro de 2026/);
  assert.match(msg, /Pessoas: 25/);
  const url = whatsappUrl(msg);
  assert.ok(url.startsWith("https://wa.me/351962473807?text="));
  assert.ok(url.includes("%0A"), "quebras de linha codificadas");
  assert.ok(url.includes("Almo%C3%A7o"), "ç em UTF-8");
  assert.ok(!/[\s\n]/.test(url));
  assert.equal(decodeURIComponent(url.split("?text=")[1]), msg);
});

test("menu: ignora entradas inválidas, ordena e formata preço opcional", () => {
  const m = parseMenu({ pratos: [
    { prato: "Peixe", tipo: "peixe", preco: "8.5" },
    { prato: "", tipo: "carne" },
    { prato: "X", tipo: "sobremesa" },
    { prato: "Sopa", tipo: "Sopa", preco: "" },
  ] });
  assert.deepEqual(m.pratos.map((p) => p.prato), ["Sopa", "Peixe"]);
  assert.equal(m.pratos[0].preco, undefined);
  assert.equal(m.pratos[1].preco, formatPrice("8,50"));
  assert.match(formatPrice("8.5"), /8,50/);
  assert.equal(formatPrice("meia dose 5 €"), "meia dose 5 €");
});
