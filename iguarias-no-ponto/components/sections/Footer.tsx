import { Wordmark } from "../Wordmark";
import { IconArrowUpRight, IconFacebook, IconInstagram, IconWhatsApp } from "../Icons";
import { PHONES, SITE, whatsappUrl } from "@/lib/site";
import { NAV } from "@/lib/nav";

export function Footer() {
  return (
    <footer className="bg-ink pb-28 pt-16 text-cream md:pb-12 md:pt-20">
      <div className="container-x">
        <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <Wordmark className="text-2xl" />
            <p className="mt-4 max-w-xs text-muted-dark">Comida caseira portuguesa e take-away em Coimbra.</p>
            <a href={whatsappUrl()} target="_blank" rel="noopener noreferrer" className="btn btn-lime mt-6">
              <IconWhatsApp size={20} /> WhatsApp
            </a>
          </div>

          <div className="lg:col-span-3">
            <h2 className="kicker font-sans text-lime">Contactos</h2>
            <address className="mt-4 not-italic text-cream/85">
              {SITE.address.street}
              <br />
              {SITE.address.postalCode} {SITE.address.locality}
            </address>
            <ul className="mt-3">
              {PHONES.map((p) => (
                <li key={p.tel}>
                  <a href={`tel:${p.tel}`} className="inline-flex min-h-11 items-center tabular-nums text-cream/85 hover:text-cream">
                    {p.display}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div className="lg:col-span-3">
            <h2 className="kicker font-sans text-lime">Horário</h2>
            <dl className="mt-4 space-y-2 text-cream/85">
              <div><dt className="font-semibold text-cream">Segunda a sexta</dt><dd className="tabular-nums">12:00–14:30 · 19:00–21:00</dd></div>
              <div><dt className="font-semibold text-cream">Sábado</dt><dd className="tabular-nums">12:00–14:30</dd></div>
              <div><dt className="font-semibold text-cream">Domingo</dt><dd>Encerrado</dd></div>
            </dl>
          </div>

          <div className="lg:col-span-2">
            <h2 className="kicker font-sans text-lime">Siga-nos</h2>
            <ul className="mt-3">
              <li>
                <a href={SITE.facebook} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2.5 text-cream/85 hover:text-cream">
                  <IconFacebook size={20} /> Facebook
                </a>
              </li>
              {SITE.instagram.map((ig) => (
                <li key={ig.handle}>
                  <a href={ig.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2.5 text-cream/85 hover:text-cream">
                    <IconInstagram size={20} /> {ig.handle}
                  </a>
                </li>
              ))}
              <li>
                <a href={SITE.eatbuUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2.5 text-cream/85 hover:text-cream">
                  <IconArrowUpRight size={20} /> Encomendar online
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-14 flex flex-col gap-4 border-t border-cream/10 pt-6 text-sm text-muted-dark sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} {SITE.name} · {SITE.address.area}, Coimbra</p>
          <nav aria-label="Rodapé">
            <ul className="flex flex-wrap gap-x-4 gap-y-1">
              {NAV.map((n) => (
                <li key={n.href}><a href={n.href} className="inline-flex min-h-11 items-center px-1 hover:text-cream">{n.label}</a></li>
              ))}
            </ul>
          </nav>
        </div>
      </div>
    </footer>
  );
}
