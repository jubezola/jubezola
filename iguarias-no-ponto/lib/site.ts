/** Fonte única de dados do restaurante. Alterar aqui propaga para todo o site, SEO e schema.org. */

export const SITE = {
  name: "Iguarias no Ponto",
  tagline: "Comida caseira portuguesa, bem feita e bem servida.",
  description:
    "Restaurante de comida caseira portuguesa em Coimbra (Santo António dos Olivais). Ementa do dia, take-away, entregas ao domicílio em Coimbra, refeições no local e catering.",
  address: {
    street: "Rua Pedro Álvares Cabral, Loja 94 e 96",
    postalCode: "3030-069",
    locality: "Coimbra",
    area: "Santo António dos Olivais",
    country: "PT",
  },
  priceRange: "1 € – 15 €",
  eatbuUrl: "https://iguariasnoponto.eatbu.com",
  facebook: "https://www.facebook.com/IguariasNoPonto",
  instagram: [
    { handle: "@iguarias_no_ponto", url: "https://www.instagram.com/iguarias_no_ponto/" },
    { handle: "@marmitas.no.ponto", url: "https://www.instagram.com/marmitas.no.ponto/" },
  ],
} as const;

/** WhatsApp oficial — constante única. */
export const WHATSAPP_NUMBER = "351962473807";

export const PHONES = [
  { label: "Principal e WhatsApp", display: "+351 962 473 807", tel: "+351962473807" },
  { label: "Alternativo", display: "+351 965 632 844", tel: "+351965632844" },
] as const;

export const PRIMARY_PHONE = PHONES[0];

export function whatsappUrl(text?: string): string {
  const base = `https://wa.me/${WHATSAPP_NUMBER}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}

export function telUrl(tel: string = PRIMARY_PHONE.tel): string {
  return `tel:${tel}`;
}

const mapsQuery = `${SITE.address.street}, ${SITE.address.postalCode} ${SITE.address.locality}`;
export const MAPS = {
  query: mapsQuery,
  embedUrl: `https://www.google.com/maps?q=${encodeURIComponent(mapsQuery)}&output=embed&hl=pt-PT`,
  openUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsQuery)}`,
  directionsUrl: `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(mapsQuery)}`,
};

export function siteUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return "http://localhost:3000";
}

export const PAYMENTS = ["Dinheiro", "Cartão de débito", "MB Way", "NFC (sem contacto)"] as const;
