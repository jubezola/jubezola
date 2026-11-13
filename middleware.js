// Vercel Routing Middleware: proteção opcional por utilizador e palavra-passe.
// Ativa-se em Vercel → Project → Settings → Environment Variables com:
//   SITE_USERS = "joao:senha123,maria:outra-senha"
// e um novo deploy. Sem SITE_USERS o site fica aberto a todos.
export const config = { matcher: "/:path*" };

export default function middleware(request) {
  const list = (process.env.SITE_USERS || "").split(",").map((s) => s.trim()).filter((s) => s.includes(":"));
  if (!list.length) return; // continua normalmente

  const header = request.headers.get("authorization") || "";
  if (header.startsWith("Basic ")) {
    let decoded = "";
    try {
      const bytes = Uint8Array.from(atob(header.slice(6)), (c) => c.charCodeAt(0));
      decoded = new TextDecoder().decode(bytes);
    } catch { decoded = ""; }
    if (decoded && list.includes(decoded)) return;
  }

  return new Response("Acesso reservado a clientes. Pede as tuas credenciais.", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="LeadRadar", charset="UTF-8"',
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
