// Cliente da API do funil. Sessão por cookie HttpOnly; nenhuma chave no cliente.
export class ApiError extends Error { constructor(status, msg) { super(msg); this.status = status; } }

export async function api(path, { method = "GET", body, signal } = {}) {
  let res;
  try {
    res = await fetch(path, {
      method, signal, credentials: "same-origin",
      headers: body !== undefined ? { "Content-Type": "application/json" } : {},
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    if (err.name === "AbortError") throw err;
    throw new ApiError(0, "Sem ligação ao servidor. Verifica a internet e tenta de novo.");
  }
  let data = null;
  try { data = await res.json(); } catch { /* sem corpo */ }
  if (!res.ok) {
    const e = new ApiError(res.status, data?.error || `Erro ${res.status}`);
    if (res.status === 401 && path !== "/api/login") window.dispatchEvent(new CustomEvent("funil:unauth"));
    throw e;
  }
  return data;
}

export const qs = (o) => new URLSearchParams(Object.entries(o).filter(([, v]) => v !== "" && v != null)).toString();
