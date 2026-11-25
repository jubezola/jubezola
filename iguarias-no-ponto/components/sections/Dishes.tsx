import Image from "next/image";
import omeleteImg from "@/public/images/IMG_2665.jpeg";
import empadasImg from "@/public/images/IMG_2667.jpeg";
import { SectionHeading } from "../SectionHeading";
import { IconWhatsApp } from "../Icons";
import { whatsappUrl } from "@/lib/site";

const BY_ORDER = ["Secretos de porco preto", "Bitoque de porco ou frango", "Bacalhau à Brás", "Bacalhau à Braga"];
const REGULARS = [
  { name: "Escalopes de novilho salteados" },
  { name: "Frango de fricassé" },
  { name: "Cordon bleu" },
  { name: "Sobremesas caseiras" },
  { name: "Cafetaria", note: "café, salgados e empadas" },
  { name: "Bebidas", note: "cerveja e vinho" },
];

export function Dishes() {
  return (
    <section id="pratos" aria-labelledby="pratos-title" className="on-light bg-cream-2 py-20 md:py-28">
      <div className="container-x">
        <SectionHeading
          id="pratos-title"
          index="02"
          kicker="Por encomenda e habituais"
          title={<>Os pratos <span className="italic">da casa</span></>}
          intro="Além da ementa do dia, há pratos que fazemos por encomenda e outros que estão sempre por cá."
        />

        <div className="mt-14 grid gap-12 lg:grid-cols-12 lg:gap-16">
          <figure data-reveal className="lg:col-span-5 lg:row-span-2">
            <div className="photo aspect-[4/5] rounded-2xl">
              <Image
                src={omeleteImg}
                alt="Omelete dourada com camarão e rebentos verdes, acompanhada de tomate cherry assado, em prato branco sobre toalha verde-lima"
                fill
                placeholder="blur"
                sizes="(min-width: 1024px) 38vw, 100vw"
                className="object-cover"
              />
            </div>
            <figcaption className="mt-3 text-sm text-muted">Omelete com camarão e tomate cherry.</figcaption>
          </figure>

          <div className="grid gap-12 sm:grid-cols-2 lg:col-span-7 lg:gap-10">
            <div data-reveal>
              <h3 className="text-3xl">Por encomenda</h3>
              <p className="mt-2 text-muted">Peça com antecedência e nós preparamos.</p>
              <ul className="mt-6 border-t border-ink/15">
                {BY_ORDER.map((d) => (
                  <li key={d} className="border-b border-ink/15 py-3.5 font-serif text-xl">{d}</li>
                ))}
              </ul>
              <a
                href={whatsappUrl("Olá! Queria encomendar um prato por encomenda: ")}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-6 inline-flex min-h-11 items-center gap-2 font-semibold text-olive hover:text-ink"
              >
                <IconWhatsApp size={20} /> <span className="link-underline">Encomendar pelo WhatsApp</span>
              </a>
            </div>
            <div data-reveal>
              <h3 className="text-3xl">Sempre na casa</h3>
              <p className="mt-2 text-muted">Os habituais de quem cá vem todas as semanas.</p>
              <ul className="mt-6 border-t border-ink/15">
                {REGULARS.map((d) => (
                  <li key={d.name} className="flex items-baseline justify-between gap-4 border-b border-ink/15 py-3.5">
                    <span className="font-serif text-xl">{d.name}</span>
                    {d.note && <span className="text-right text-sm text-muted">{d.note}</span>}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <figure data-reveal className="lg:col-span-7">
            <div className="photo aspect-[16/10] rounded-2xl">
              <Image
                src={empadasImg}
                alt="Vitrine da cafetaria com empadas douradas em formas de alumínio e pastéis folhados numa travessa preta"
                fill
                placeholder="blur"
                sizes="(min-width: 1024px) 52vw, 100vw"
                className="object-cover"
              />
            </div>
            <figcaption className="mt-3 text-sm text-muted">Na cafetaria: empadas e salgados caseiros.</figcaption>
          </figure>
        </div>
      </div>
    </section>
  );
}
