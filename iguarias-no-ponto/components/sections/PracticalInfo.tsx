import { SectionHeading } from "../SectionHeading";
import { HoursTable } from "../HoursTable";
import {
  IconCard, IconCash, IconContactless, IconDog, IconFamily, IconGroup, IconMobilePay, IconParking, IconSnow, IconWheelchair, IconWifi,
} from "../Icons";

const PAYMENTS = [
  { label: "Dinheiro", Icon: IconCash },
  { label: "Cartão de débito", Icon: IconCard },
  { label: "MB Way", Icon: IconMobilePay },
  { label: "NFC (sem contacto)", Icon: IconContactless },
];

const AMENITIES = [
  { label: "Acesso a cadeira de rodas", Icon: IconWheelchair },
  { label: "Estacionamento gratuito na rua", Icon: IconParking },
  { label: "Wi-Fi grátis", Icon: IconWifi },
  { label: "Espaço climatizado", Icon: IconSnow },
  { label: "Adequado a crianças", Icon: IconFamily },
  { label: "Ideal para grupos", Icon: IconGroup },
  { label: "Cães são bem-vindos", Icon: IconDog },
];

export function PracticalInfo() {
  return (
    <section id="horario" aria-labelledby="horario-title" className="on-light bg-cream-2 py-20 md:py-28">
      <div className="container-x">
        <SectionHeading id="horario-title" index="05" kicker="Informação prática" title={<>Horário, pagamentos <span className="italic">e comodidades</span></>} />

        <div className="mt-14 grid gap-14 lg:grid-cols-12 lg:gap-0">
          <div data-reveal className="lg:col-span-5 lg:pr-12">
            <h3 className="text-2xl">Horário</h3>
            <div className="mt-5 border-t border-ink/10">
              <HoursTable />
            </div>
            <p className="mt-4 text-sm text-muted">Almoço e jantar de segunda a sexta. Sábado só almoço. Feriados: confirme por telefone.</p>
          </div>

          <div data-reveal className="lg:col-span-3 lg:border-l lg:border-ink/15 lg:px-12">
            <h3 className="text-2xl">Pagamentos</h3>
            <ul className="mt-5 space-y-4">
              {PAYMENTS.map(({ label, Icon }) => (
                <li key={label} className="flex items-center gap-3.5">
                  <Icon className="shrink-0 text-olive" />
                  {label}
                </li>
              ))}
            </ul>
          </div>

          <div data-reveal className="lg:col-span-4 lg:border-l lg:border-ink/15 lg:pl-12">
            <h3 className="text-2xl">Comodidades</h3>
            <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
              {AMENITIES.map(({ label, Icon }) => (
                <li key={label} className="flex items-center gap-3.5">
                  <Icon className="shrink-0 text-olive" />
                  {label}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
