import { SectionHeading } from "../SectionHeading";
import { IconArrowRight, IconArrowUpRight, IconBag, IconCloche, IconPhone, IconScooter, IconTable, IconWhatsApp } from "../Icons";
import { SITE, telUrl, whatsappUrl } from "@/lib/site";

type Action = { label: string; href: string; kind: "whatsapp" | "phone" | "anchor" };

const SERVICES: { title: string; text: string; Icon: typeof IconBag; actions: Action[] }[] = [
  {
    title: "Take-away",
    text: "Escolha da ementa do dia, encomende por WhatsApp ou telefone e levante na loja, pronto a levar.",
    Icon: IconBag,
    actions: [
      { label: "Encomendar para levantar", href: whatsappUrl("Olá! Queria encomendar para levantar na loja: "), kind: "whatsapp" },
      { label: "Ligar", href: telUrl(), kind: "phone" },
    ],
  },
  {
    title: "Entregas em Coimbra",
    text: "Levamos a refeição a casa ou ao trabalho, em Coimbra. Diga-nos a morada e combinamos a entrega.",
    Icon: IconScooter,
    actions: [
      { label: "Pedir entrega", href: whatsappUrl("Olá! Queria uma encomenda com entrega. Morada: "), kind: "whatsapp" },
      { label: "Ligar", href: telUrl(), kind: "phone" },
    ],
  },
  {
    title: "Refeições no local",
    text: "Sala climatizada, adequada a famílias, crianças e grupos. Aceitamos reservas.",
    Icon: IconTable,
    actions: [
      { label: "Reservar mesa", href: whatsappUrl("Olá! Queria reservar mesa para ___ pessoas, no dia ___ às ___."), kind: "whatsapp" },
      { label: "Reservar por telefone", href: telUrl(), kind: "phone" },
    ],
  },
  {
    title: "Catering e encomendas",
    text: "Refeições por encomenda para almoços de empresa, festas de família e outros eventos.",
    Icon: IconCloche,
    actions: [{ label: "Pedir orçamento", href: "#catering", kind: "anchor" }],
  },
];

function ActionLink({ a, primary }: { a: Action; primary: boolean }) {
  const external = a.kind === "whatsapp";
  const Icon = a.kind === "whatsapp" ? IconWhatsApp : a.kind === "phone" ? IconPhone : IconArrowRight;
  return (
    <a
      href={a.href}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className={`btn min-h-11 py-2 text-[0.95rem] ${primary ? "btn-lime" : "btn-ghost-dark"}`}
    >
      <Icon size={19} /> {a.label}
    </a>
  );
}

export function Services() {
  return (
    <section id="servicos" aria-labelledby="servicos-title" className="bg-ink py-20 text-cream md:py-28">
      <div className="container-x">
        <div className="grid gap-8 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-8">
            <SectionHeading
              id="servicos-title"
              index="03"
              kicker="Serviços"
              tone="dark"
              title={<>À mesa, para levar <span className="italic text-lime">ou em casa</span></>}
            />
          </div>
          <p data-reveal className="text-muted-dark lg:col-span-4">
            Prefere encomendar online?{" "}
            <a href={SITE.eatbuUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1 font-semibold text-cream">
              <span className="link-underline">Encomendar online</span> <IconArrowUpRight size={18} className="text-lime" />
            </a>
          </p>
        </div>

        <ol className="mt-14 border-t border-cream/15">
          {SERVICES.map((s, i) => (
            <li key={s.title} data-reveal className="grid gap-5 border-b border-cream/15 py-9 md:grid-cols-12 md:items-center md:gap-8">
              <div className="flex items-center gap-5 md:col-span-12 lg:col-span-4">
                <span className="font-sans text-sm tabular-nums text-lime">{String(i + 1).padStart(2, "0")}</span>
                <s.Icon size={30} className="shrink-0 text-cream/70" />
                <h3 className="text-[1.9rem] sm:text-4xl">{s.title}</h3>
              </div>
              <p className="text-muted-dark md:col-span-7 lg:col-span-4">{s.text}</p>
              <div className="flex flex-wrap gap-3 md:col-span-5 md:flex-col md:items-end lg:col-span-4">
                {s.actions.map((a, j) => (
                  <ActionLink key={a.label} a={a} primary={j === 0} />
                ))}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
