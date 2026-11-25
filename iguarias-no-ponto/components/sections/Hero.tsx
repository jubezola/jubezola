import Image from "next/image";
import heroImg from "@/public/images/IMG_2662.jpeg";
import { OpenBadge } from "../OpenBadge";
import { IconArrowRight, IconPhone, IconWhatsApp, IconPin } from "../Icons";
import { PRIMARY_PHONE, SITE, telUrl, whatsappUrl } from "@/lib/site";

export function Hero() {
  return (
    <section id="inicio" aria-labelledby="hero-title" className="relative overflow-hidden bg-ink text-cream">
      <div className="lg:grid lg:min-h-[min(100svh,56rem)] lg:grid-cols-[1.1fr_0.9fr]">
        {/* Foto: no telemóvel em cima, no desktop à direita a toda a altura */}
        <div className="photo relative h-[46svh] min-h-[18rem] bg-ink-2 lg:order-2 lg:h-auto">
          <Image
            src={heroImg}
            alt="Prato de carne com molho cremoso e camarão, legumes salteados e tomate cherry, com uma garrafa de vinho Vidigueira, numa mesa com toalha verde-lima"
            fill
            preload
            placeholder="blur"
            sizes="(min-width: 1024px) 45vw, 100vw"
            className="object-cover object-[50%_62%]"
          />
          {/* Véu só para legibilidade do badge e transição para o texto */}
          <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-b from-ink/60 via-transparent to-ink lg:bg-gradient-to-r lg:from-ink lg:via-ink/0 lg:via-30% lg:to-transparent" />
          <div className="absolute left-5 top-20 md:left-10 md:top-24 lg:hidden">
            <OpenBadge />
          </div>
        </div>

        <div className="relative flex flex-col justify-end lg:order-1 lg:justify-center">
          <div className="container-x pb-14 pt-2 lg:max-w-none lg:py-32 lg:pl-[max(2.5rem,calc((100vw-76rem)/2+2.5rem))] lg:pr-16">
            <div className="mb-8 hidden lg:block">
              <OpenBadge />
            </div>
            <p className="kicker flex items-center gap-2 text-lime">
              <IconPin size={16} /> {SITE.address.area} · {SITE.address.locality}
            </p>
            <h1 id="hero-title" className="mt-4 text-[3.4rem] leading-[0.95] sm:text-7xl lg:text-[5.6rem]">
              Iguarias <span className="block italic text-lime">no ponto.</span>
            </h1>
            <p className="mt-6 max-w-md text-xl leading-snug text-cream/90 sm:text-2xl">
              Comida caseira portuguesa, bem feita e bem servida.
            </p>
            <p className="mt-3 max-w-md text-muted-dark">
              Almoço rápido, take-away, entregas em Coimbra e catering. Doses generosas a preço justo.
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <a
                href={whatsappUrl("Olá! Queria encomendar a ementa de hoje.")}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-lime text-[1.05rem] sm:px-6"
              >
                <IconWhatsApp size={22} /> Encomendar no WhatsApp
              </a>
              <a href="#ementa" className="btn btn-ghost-dark group sm:px-6">
                Ver ementa do dia
                <IconArrowRight size={20} className="transition-transform group-hover:translate-x-1" />
              </a>
            </div>
            <a href={telUrl()} className="mt-5 inline-flex min-h-11 items-center gap-2 text-cream/85 hover:text-cream">
              <IconPhone size={18} className="text-lime" />
              <span>
                ou ligue <span className="link-underline font-semibold tabular-nums">{PRIMARY_PHONE.display}</span>
              </span>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
