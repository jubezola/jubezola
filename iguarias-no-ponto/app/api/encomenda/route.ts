/**
 * Rota OPCIONAL para receber pedidos de catering por email (via Resend).
 * Não é usada pelo formulário por defeito (que envia pelo WhatsApp).
 * Para ativar: definir RESEND_API_KEY, ORDER_EMAIL_TO e ORDER_EMAIL_FROM (ver .env.example)
 * e, no CateringForm, fazer POST para /api/encomenda com o JSON do pedido.
 */
import { NextResponse } from "next/server";
import { buildOrderMessage, validateOrder, type OrderInput } from "@/lib/order";

export const runtime = "nodejs";

// Limite simples por IP (memória da instância; suficiente para travar abuso básico).
const hits = new Map<string, number[]>();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 5;

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > MAX_PER_WINDOW;
}

const str = (v: unknown) => (typeof v === "string" ? v : "");

export async function POST(req: Request) {
  const { RESEND_API_KEY, ORDER_EMAIL_TO, ORDER_EMAIL_FROM } = process.env;
  if (!RESEND_API_KEY || !ORDER_EMAIL_TO || !ORDER_EMAIL_FROM) {
    return NextResponse.json({ ok: false, error: "Envio por email não configurado." }, { status: 501 });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anon";
  if (rateLimited(ip)) return NextResponse.json({ ok: false, error: "Demasiados pedidos. Tente mais tarde." }, { status: 429 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Pedido inválido." }, { status: 400 });
  }
  if (str(body.website)) return NextResponse.json({ ok: true }); // honeypot: bots preenchem, fingimos sucesso

  const input: OrderInput = {
    nome: str(body.nome),
    telefone: str(body.telefone),
    data: str(body.data),
    pessoas: str(body.pessoas),
    mensagem: str(body.mensagem),
  };
  const errors = validateOrder(input);
  if (Object.keys(errors).length) return NextResponse.json({ ok: false, errors }, { status: 422 });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: ORDER_EMAIL_FROM,
        to: [ORDER_EMAIL_TO],
        subject: `Pedido de catering: ${input.nome.trim()} (${input.pessoas} pessoas)`,
        text: buildOrderMessage(input), // texto simples: sem risco de injeção de HTML
      }),
      signal: controller.signal,
    });
    if (!res.ok) return NextResponse.json({ ok: false, error: "Não foi possível enviar. Use o WhatsApp ou ligue." }, { status: 502 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "Serviço de email indisponível. Use o WhatsApp ou ligue." }, { status: 504 });
  } finally {
    clearTimeout(timeout);
  }
}
