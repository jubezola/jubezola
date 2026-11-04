// Envia o relatório por email através da Resend (https://resend.com).
// Ativa-se definindo no Netlify (Site configuration → Environment variables):
//   RESEND_API_KEY   a chave da tua conta Resend
//   REPORT_FROM      remetente verificado, ex.: "LeadRadar <relatorios@o-teu-dominio.pt>"
// Opcional:
//   REPORT_ALLOWED_TO  lista de emails (separados por vírgula) que podem receber relatórios.
// Sem RESEND_API_KEY, a função responde 501 e o site usa o plano B (descarrega o Excel e abre o email).

const MAX_BYTES = 5 * 1024 * 1024;

const json = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8" } });

export default async (req) => {
  if (req.method !== "POST") return json(405, { error: "Usa POST." });

  const apiKey = Netlify.env.get("RESEND_API_KEY");
  const from = Netlify.env.get("REPORT_FROM") || "LeadRadar <onboarding@resend.dev>";
  if (!apiKey) return json(501, { error: "Envio por email não configurado (falta RESEND_API_KEY)." });

  const raw = await req.text();
  if (raw.length > MAX_BYTES) return json(413, { error: "Relatório demasiado grande para email." });

  let data;
  try { data = JSON.parse(raw); } catch { return json(400, { error: "Pedido inválido." }); }

  const to = String(data.to || "").trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) return json(400, { error: "Email de destino inválido." });

  const allowed = (Netlify.env.get("REPORT_ALLOWED_TO") || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (allowed.length && !allowed.includes(to.toLowerCase())) return json(403, { error: "Este email não está autorizado a receber relatórios." });

  const attachments = Array.isArray(data.attachments)
    ? data.attachments.slice(0, 3).map((a) => ({ filename: String(a.filename || "relatorio.xlsx").slice(0, 120), content: String(a.content || "") }))
    : [];

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [to],
      subject: String(data.subject || "Relatório de leads").slice(0, 200),
      html: String(data.html || "").slice(0, 200000),
      text: String(data.text || "").slice(0, 50000),
      attachments,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    return json(502, { error: `O serviço de email recusou o envio (${res.status}). ${detail.slice(0, 200)}` });
  }
  return json(200, { ok: true });
};

export const config = { path: "/api/send-report" };
