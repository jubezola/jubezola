// Proteção opcional por utilizador e palavra-passe (para vender acessos).
// Ativa-se definindo no Netlify a variável de ambiente SITE_USERS, por exemplo:
//   SITE_USERS = "joao:senha123,maria:outra-senha"
// Cada cliente recebe o seu par utilizador:palavra-passe. Para cortar um acesso, remove-o da lista
// e faz "Trigger deploy". Sem SITE_USERS o site fica aberto a todos.

export default async (request, context) => {
  const list = (Netlify.env.get("SITE_USERS") || "").split(",").map((s) => s.trim()).filter((s) => s.includes(":"));
  if (!list.length) return context.next();

  const header = request.headers.get("authorization") || "";
  if (header.startsWith("Basic ")) {
    let decoded = "";
    try {
      const bytes = Uint8Array.from(atob(header.slice(6)), (c) => c.charCodeAt(0));
      decoded = new TextDecoder().decode(bytes);
    } catch { decoded = ""; }
    if (decoded && list.includes(decoded)) return context.next();
  }

  return new Response("Acesso reservado a clientes. Pede as tuas credenciais.", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="LeadRadar", charset="UTF-8"',
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
};

export const config = { path: "/*" };
