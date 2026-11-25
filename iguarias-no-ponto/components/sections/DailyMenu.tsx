import Image from "next/image";
import bacalhauImg from "@/public/images/IMG_2666.jpeg";
import balcaoImg from "@/public/images/IMG_2663.jpeg";
import { SectionHeading } from "../SectionHeading";
import { IconPhone, IconWhatsApp } from "../Icons";
import { DISH_TYPES, DISH_TYPE_LABEL, formatMenuDate, getDailyMenu } from "@/lib/menu";
import { PRIMARY_PHONE, telUrl, whatsappUrl } from "@/lib/site";

export function DailyMenu() {
  const menu = getDailyMenu();
  const date = formatMenuDate(menu.atualizado);
  const groups = DISH_TYPES.map((t) => ({ tipo: t, pratos: menu.pratos.filter((p) => p.tipo === t) })).filter(
    (g) => g.pratos.length > 0,
  );

  return (
    <section id="ementa" aria-labelledby="ementa-title" className="on-light bg-cream py-20 md:py-28">
      <div className="container-x grid gap-14 lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-7">
          <SectionHeading
            id="ementa-title"
            index="01"
            kicker="Ementa do dia"
            title={<>O que há hoje <span className="italic">para almoçar</span></>}
            intro={date ? <>Ementa de <span className="font-semibold text-ink">{date}</span>. Muda todos os dias.</> : "Muda todos os dias."}
          />

          {groups.length === 0 ? (
            <p className="mt-10 rounded-lg bg-cream-2 p-6 text-muted">
              A ementa de hoje ainda não foi publicada. Pergunte-nos pelo WhatsApp o que há para almoçar.
            </p>
          ) : (
            <div className="mt-12 space-y-10">
              {groups.map((g) => (
                <div key={g.tipo} data-reveal>
                  <h3 className="kicker flex items-center gap-3 font-sans text-olive">
                    {DISH_TYPE_LABEL[g.tipo]}
                    <span aria-hidden="true" className="h-px flex-1 bg-ink/15" />
                  </h3>
                  <ul className="mt-2">
                    {g.pratos.map((p) => (
                      <li key={p.prato} className="flex items-center gap-4 border-b border-ink/10 py-4 last:border-b-0">
                        <div className="min-w-0 flex-1">
                          <p className="font-serif text-[1.45rem] leading-tight sm:text-[1.65rem]">{p.prato}</p>
                          {p.descricao && <p className="mt-1 text-[0.98rem] text-muted">{p.descricao}</p>}
                        </div>
                        {p.preco && <p className="shrink-0 font-serif text-xl tabular-nums">{p.preco}</p>}
                        <a
                          href={whatsappUrl(`Olá! Queria encomendar: ${p.prato}.`)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group inline-flex size-11 shrink-0 items-center justify-center gap-2 rounded-full text-olive ring-1 ring-ink/15 transition-colors hover:bg-ink hover:text-lime sm:w-auto sm:px-4"
                          aria-label={`Encomendar ${p.prato} pelo WhatsApp`}
                        >
                          <IconWhatsApp size={19} />
                          <span className="hidden text-sm font-semibold sm:inline">Pedir</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}

          <div data-reveal className="mt-12 border-t border-ink/15 pt-8">
            {menu.nota && <p className="text-muted">{menu.nota}</p>}
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <a
                href={whatsappUrl("Olá! Queria encomendar a ementa de hoje.")}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-ink"
              >
                <IconWhatsApp size={20} className="text-lime" /> Encomendar no WhatsApp
              </a>
              <a href={telUrl()} className="btn btn-ghost-light">
                <IconPhone size={20} /> Ligar {PRIMARY_PHONE.display}
              </a>
            </div>
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:col-span-5 lg:grid-cols-1 lg:content-start lg:pt-28">
          <figure data-reveal>
            <div className="photo aspect-[4/5] rounded-2xl sm:aspect-square lg:aspect-[4/5]">
              <Image
                src={bacalhauImg}
                alt="Tabuleiro de bacalhau gratinado com rosetas de puré duquesa douradas, azeitonas e salsa picada"
                fill
                placeholder="blur"
                sizes="(min-width: 1024px) 34vw, (min-width: 640px) 45vw, 100vw"
                className="object-cover"
              />
            </div>
            <figcaption className="mt-3 text-sm text-muted">Bacalhau gratinado com puré duquesa, saído do forno.</figcaption>
          </figure>
          <figure data-reveal>
            <div className="photo aspect-[4/3] rounded-2xl sm:aspect-square lg:aspect-[4/3]">
              <Image
                src={balcaoImg}
                alt="Balcão com os pratos do dia: carne com cogumelos, ovos estrelados sobre croquetes, peixe com cenoura ralada, feijão-verde, couve e brócolos"
                fill
                placeholder="blur"
                sizes="(min-width: 1024px) 34vw, (min-width: 640px) 45vw, 100vw"
                className="object-cover"
              />
            </div>
            <figcaption className="mt-3 text-sm text-muted">O balcão ao almoço: pratos do dia e legumes.</figcaption>
          </figure>
        </div>
      </div>
    </section>
  );
}
