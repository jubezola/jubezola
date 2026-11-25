export const DISH_TYPES = ["sopa", "carne", "peixe", "vegetariano"] as const;
export type DishType = (typeof DISH_TYPES)[number];

export const DISH_TYPE_LABEL: Record<DishType, string> = {
  sopa: "Sopa",
  carne: "Carne",
  peixe: "Peixe",
  vegetariano: "Vegetariano",
};

export type Dish = { prato: string; descricao?: string; tipo: DishType; preco?: string };
export type DailyMenu = { atualizado?: string; nota?: string; pratos: Dish[] };

/** Valida o JSON editado à mão: ignora entradas inválidas em vez de partir o site, e avisa no build. */
export function parseMenu(input: unknown): DailyMenu {
  const obj = (input ?? {}) as Record<string, unknown>;
  const list = Array.isArray(obj.pratos) ? obj.pratos : [];
  const pratos: Dish[] = [];
  list.forEach((item, i) => {
    const it = (item ?? {}) as Record<string, unknown>;
    const prato = typeof it.prato === "string" ? it.prato.trim() : "";
    const tipo = typeof it.tipo === "string" ? it.tipo.trim().toLowerCase() : "";
    if (!prato || !(DISH_TYPES as readonly string[]).includes(tipo)) {
      console.warn(`[menu.json] Prato #${i + 1} ignorado: precisa de "prato" e "tipo" (${DISH_TYPES.join("/")}).`);
      return;
    }
    const descricao = typeof it.descricao === "string" && it.descricao.trim() ? it.descricao.trim() : undefined;
    const precoRaw = typeof it.preco === "number" ? String(it.preco) : typeof it.preco === "string" ? it.preco.trim() : "";
    const preco = precoRaw ? formatPrice(precoRaw) : undefined;
    pratos.push({ prato, descricao, tipo: tipo as DishType, preco });
  });
  pratos.sort((a, b) => DISH_TYPES.indexOf(a.tipo) - DISH_TYPES.indexOf(b.tipo));
  return {
    atualizado: typeof obj.atualizado === "string" ? obj.atualizado : undefined,
    nota: typeof obj.nota === "string" && obj.nota.trim() ? obj.nota.trim() : undefined,
    pratos,
  };
}

/** "8.5" -> "8,50 €"; texto livre (ex.: "meia dose 5 €") é mantido. */
export function formatPrice(p: string): string {
  const n = Number(p.replace(",", ".").replace("€", "").trim());
  if (Number.isFinite(n) && /^[\d.,\s€]+$/.test(p)) {
    return new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(n);
  }
  return p;
}

export function formatMenuDate(iso?: string): string | null {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-PT", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, d)),
  );
}
