import { SCHEMA_DAY, WEEK_SCHEDULE } from "./hours";
import { PHONES, SITE, siteUrl } from "./site";

export function restaurantJsonLd() {
  const url = siteUrl();
  // Agrupa dias com o mesmo horário.
  const groups = new Map<string, string[]>();
  WEEK_SCHEDULE.forEach((intervals, day) => {
    intervals.forEach((it) => {
      const key = `${it.open}-${it.close}`;
      groups.set(key, [...(groups.get(key) ?? []), SCHEMA_DAY[day]]);
    });
  });
  const openingHoursSpecification = [...groups.entries()].map(([key, days]) => {
    const [opens, closes] = key.split("-");
    return { "@type": "OpeningHoursSpecification", dayOfWeek: days, opens, closes };
  });

  return {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    "@id": `${url}/#restaurante`,
    name: SITE.name,
    description: SITE.description,
    url,
    image: [`${url}/images/IMG_2662.jpeg`, `${url}/images/IMG_2661.jpeg`, `${url}/images/IMG_2666.jpeg`],
    telephone: PHONES[0].tel,
    contactPoint: PHONES.map((p) => ({ "@type": "ContactPoint", telephone: p.tel, contactType: "reservations", areaServed: "PT", availableLanguage: "pt-PT" })),
    address: {
      "@type": "PostalAddress",
      streetAddress: SITE.address.street,
      postalCode: SITE.address.postalCode,
      addressLocality: SITE.address.locality,
      addressRegion: "Coimbra",
      addressCountry: SITE.address.country,
    },
    servesCuisine: ["Portuguesa", "Comida caseira"],
    priceRange: SITE.priceRange,
    currenciesAccepted: "EUR",
    paymentAccepted: "Dinheiro, Cartão de débito, MB Way, NFC",
    acceptsReservations: true,
    hasMenu: `${url}/#ementa`,
    openingHoursSpecification,
    amenityFeature: [
      "Acesso a cadeira de rodas", "Estacionamento gratuito na rua", "Wi-Fi grátis", "Climatizado",
      "Adequado a crianças", "Adequado a grupos", "Aceita cães",
    ].map((name) => ({ "@type": "LocationFeatureSpecification", name, value: true })),
    sameAs: [SITE.facebook, ...SITE.instagram.map((i) => i.url), SITE.eatbuUrl],
  };
}
