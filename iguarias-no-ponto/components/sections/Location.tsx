import Image from "next/image";
import fachadaImg from "@/public/images/IMG_2661.jpeg";
import { SectionHeading } from "../SectionHeading";
import { MapEmbed } from "../MapEmbed";
import { IconArrowUpRight, IconDirections, IconParking, IconPhone } from "../Icons";
import { MAPS, PHONES, SITE } from "@/lib/site";

export function Location() {
  return (
    <section id="localizacao" aria-labelledby="localizacao-title" className="on-light bg-cream py-20 md:py-28">
      <div className="container-x">
        <SectionHeading id="localizacao-title" index="06" kicker="Localização" title={<>Venha buscar <span className="italic">ou sente-se</span></>} />

        <div className="mt-14 grid gap-10 lg:grid-cols-12 lg:gap-12">
          <figure data-reveal className="lg:col-span-7">
            <div className="photo aspect-[16/11] rounded-2xl">
              <Image
                src={fachadaImg}
                alt="Fachada do Iguarias no Ponto à noite, com o letreiro iluminado TAKE AWAY, o logótipo verde-lima e o grelhador de frangos à entrada"
                fill
                placeholder="blur"
                sizes="(min-width: 1024px) 55vw, 100vw"
                className="object-cover"
              />
            </div>
            <figcaption className="mt-3 text-sm text-muted">A entrada da loja, com o grelhador à porta.</figcaption>
          </figure>

          <div data-reveal className="flex flex-col lg:col-span-5">
            <address className="not-italic">
              <p className="font-serif text-3xl leading-tight">
                {SITE.address.street}
                <br />
                {SITE.address.postalCode} {SITE.address.locality}
              </p>
              <p className="mt-2 text-muted">{SITE.address.area}</p>
            </address>

            <p className="mt-6 flex items-start gap-3 rounded-lg bg-lime/30 p-4 text-[0.98rem]">
              <IconParking className="mt-0.5 shrink-0 text-olive" />
              <span><strong>Estacionamento gratuito na rua</strong>: prático para levantar a encomenda.</span>
            </p>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row lg:flex-col xl:flex-row">
              <a href={MAPS.directionsUrl} target="_blank" rel="noopener noreferrer" className="btn btn-ink">
                <IconDirections size={20} className="text-lime" /> Como chegar
              </a>
              <a href={MAPS.openUrl} target="_blank" rel="noopener noreferrer" className="btn btn-ghost-light">
                Abrir no Google Maps <IconArrowUpRight size={18} />
              </a>
            </div>

            <ul className="mt-8 space-y-1 border-t border-ink/15 pt-6">
              {PHONES.map((p) => (
                <li key={p.tel}>
                  <a href={`tel:${p.tel}`} className="flex min-h-11 items-center gap-3 hover:text-olive">
                    <IconPhone size={18} className="text-olive" />
                    <span className="font-semibold tabular-nums">{p.display}</span>
                    <span className="text-sm text-muted">{p.label}</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div data-reveal className="lg:col-span-12">
            <MapEmbed />
          </div>
        </div>
      </div>
    </section>
  );
}
