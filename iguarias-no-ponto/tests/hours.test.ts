import { test } from "node:test";
import assert from "node:assert/strict";
import { getOpenStatus, lisbonClock } from "../lib/hours.ts";

// Lisboa: UTC+0 no inverno (WET), UTC+1 no verão (WEST).
// 2026-11-23 é segunda-feira (inverno). 2026-07-04 é sábado (verão).
const at = (iso: string) => getOpenStatus(new Date(iso));

const cases: [string, string, boolean, string, string][] = [
  ["seg antes de abrir", "2026-11-23T11:59:00Z", false, "Fechado", "Abre às 12:00"],
  ["seg abertura exata", "2026-11-23T12:00:00Z", true, "Aberto agora", "Fecha às 14:30"],
  ["seg almoço", "2026-11-23T13:15:00Z", true, "Aberto agora", "Fecha às 14:30"],
  ["seg 14:29", "2026-11-23T14:29:00Z", true, "Aberto agora", "Fecha às 14:30"],
  ["seg 14:30 fecha", "2026-11-23T14:30:00Z", false, "Fechado", "Abre às 19:00"],
  ["seg intervalo", "2026-11-23T16:45:00Z", false, "Fechado", "Abre às 19:00"],
  ["seg jantar", "2026-11-23T19:00:00Z", true, "Aberto agora", "Fecha às 21:00"],
  ["seg 21:00 fecha", "2026-11-23T21:00:00Z", false, "Fechado", "Abre amanhã às 12:00"],
  ["ter madrugada", "2026-11-24T02:00:00Z", false, "Fechado", "Abre às 12:00"],
  ["qua almoço", "2026-11-25T12:30:00Z", true, "Aberto agora", "Fecha às 14:30"],
  ["qui jantar", "2026-11-26T20:59:00Z", true, "Aberto agora", "Fecha às 21:00"],
  ["sex noite", "2026-11-27T22:00:00Z", false, "Fechado", "Abre amanhã às 12:00"],
  ["sáb almoço", "2026-11-28T13:00:00Z", true, "Aberto agora", "Fecha às 14:30"],
  ["sáb tarde (sem jantar)", "2026-11-28T15:00:00Z", false, "Fechado", "Abre segunda às 12:00"],
  ["sáb 19:30 (sem jantar)", "2026-11-28T19:30:00Z", false, "Fechado", "Abre segunda às 12:00"],
  ["domingo", "2026-11-29T13:00:00Z", false, "Encerrado hoje", "Abre amanhã às 12:00"],
  ["domingo manhã", "2026-11-29T09:00:00Z", false, "Encerrado hoje", "Abre amanhã às 12:00"],
  // Verão: 11:30 UTC = 12:30 em Lisboa
  ["verão sáb 12:30 Lisboa", "2026-07-04T11:30:00Z", true, "Aberto agora", "Fecha às 14:30"],
  ["verão sáb 11:30 Lisboa", "2026-07-04T10:30:00Z", false, "Fechado", "Abre às 12:00"],
  ["verão sex 20:30 Lisboa", "2026-07-03T19:30:00Z", true, "Aberto agora", "Fecha às 21:00"],
  ["verão dom 00:30 Lisboa (sáb 23:30 UTC)", "2026-07-04T23:30:00Z", false, "Encerrado hoje", "Abre amanhã às 12:00"],
];

for (const [name, iso, isOpen, label, detail] of cases) {
  test(name, () => {
    const s = at(iso);
    assert.equal(s.isOpen, isOpen);
    assert.equal(s.label, label);
    assert.equal(s.detail, detail);
  });
}

test("relógio de Lisboa no verão é UTC+1", () => {
  assert.deepEqual(lisbonClock(new Date("2026-07-04T11:30:00Z")), { day: 6, minutes: 12 * 60 + 30 });
});
