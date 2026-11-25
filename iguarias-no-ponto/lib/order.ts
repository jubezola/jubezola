/** Validação e mensagem do pedido de catering/encomenda. Partilhado entre o formulário e a rota de API. */

export type OrderInput = {
  nome: string;
  telefone: string;
  data: string; // AAAA-MM-DD
  pessoas: string;
  mensagem: string;
};

export type OrderErrors = Partial<Record<keyof OrderInput, string>>;

export const LIMITS = { nomeMax: 80, mensagemMax: 1000, pessoasMax: 1000 } as const;

const onlyDigits = (s: string) => s.replace(/\D/g, "");

/** Aceita números portugueses (9 dígitos começados por 2 ou 9, com ou sem +351/00351) e internacionais (+ e 8–15 dígitos). */
export function isValidPhone(raw: string): boolean {
  const s = raw.trim().replace(/[\s().-]/g, "");
  if (/^(\+351|00351)?[29]\d{8}$/.test(s)) return true;
  if (/^(\+|00)[1-9]\d{7,14}$/.test(s)) return true;
  return false;
}

/** Data de hoje (AAAA-MM-DD) no fuso de Lisboa. */
export function todayInLisbon(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Lisbon", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

function isRealDate(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function validateOrder(input: OrderInput, now: Date = new Date()): OrderErrors {
  const errors: OrderErrors = {};
  const nome = input.nome.trim();
  if (nome.length < 2) errors.nome = "Indique o seu nome.";
  else if (nome.length > LIMITS.nomeMax) errors.nome = `Máximo de ${LIMITS.nomeMax} caracteres.`;

  if (!input.telefone.trim()) errors.telefone = "Indique um telefone para o contactarmos.";
  else if (!isValidPhone(input.telefone)) errors.telefone = "Telefone inválido. Ex.: 912 345 678";

  if (!input.data) errors.data = "Escolha a data do evento ou da encomenda.";
  else if (!isRealDate(input.data)) errors.data = "Data inválida.";
  else if (input.data < todayInLisbon(now)) errors.data = "A data não pode ser no passado.";

  const p = input.pessoas.trim();
  if (!p) errors.pessoas = "Indique o número de pessoas.";
  else if (!/^\d+$/.test(p) || Number(p) < 1) errors.pessoas = "Número inteiro a partir de 1.";
  else if (Number(p) > LIMITS.pessoasMax) errors.pessoas = `Para mais de ${LIMITS.pessoasMax} pessoas, ligue-nos.`;

  if (input.mensagem.length > LIMITS.mensagemMax) errors.mensagem = `Máximo de ${LIMITS.mensagemMax} caracteres.`;
  return errors;
}

export function formatDatePt(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-PT", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, d)),
  );
}

export function buildOrderMessage(input: OrderInput): string {
  const lines = [
    "Olá! Gostaria de pedir um orçamento de catering / encomenda.",
    "",
    `Nome: ${input.nome.trim()}`,
    `Telefone: ${input.telefone.trim()}`,
    `Data: ${formatDatePt(input.data)}`,
    `Pessoas: ${onlyDigits(input.pessoas)}`,
  ];
  const msg = input.mensagem.trim();
  if (msg) lines.push("", "Detalhes:", msg);
  return lines.join("\n");
}
