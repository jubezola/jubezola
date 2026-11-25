import Image from "next/image";
import buffetImg from "@/public/images/IMG_2660.jpeg";
import { SectionHeading } from "../SectionHeading";
import { CateringForm } from "../CateringForm";

export function Catering() {
  return (
    <section id="catering" aria-labelledby="catering-title" className="on-light bg-cream py-20 md:py-28">
      <div className="container-x grid gap-12 lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-5">
          <SectionHeading
            id="catering-title"
            index="04"
            kicker="Catering e encomendas"
            title={<>Para a festa, <span className="italic">a reunião</span> ou o almoço de família</>}
            intro="Preparamos refeições por encomenda à medida do seu evento. Diga-nos a data e quantas pessoas são, e respondemos pelo WhatsApp."
          />
          <figure data-reveal className="mt-10 hidden lg:block">
            <div className="photo aspect-[4/5] rounded-2xl">
              <Image
                src={buffetImg}
                alt="Buffet com travessa de sushi variado decorada com pepino esculpido, peixe com cenoura e salada de fruta com uvas e ananás"
                fill
                placeholder="blur"
                sizes="(min-width: 1024px) 34vw, 100vw"
                className="object-cover"
              />
            </div>
            <figcaption className="mt-3 text-sm text-muted">Variedade para eventos: de pratos portugueses a sushi e saladas.</figcaption>
          </figure>
        </div>
        <div data-reveal className="lg:col-span-7 lg:pt-4">
          <figure className="mb-8 lg:hidden">
            <div className="photo aspect-[16/10] rounded-2xl">
              <Image
                src={buffetImg}
                alt="Buffet com travessa de sushi variado decorada com pepino esculpido, peixe com cenoura e salada de fruta com uvas e ananás"
                fill
                placeholder="blur"
                sizes="100vw"
                className="object-cover"
              />
            </div>
          </figure>
          <CateringForm />
        </div>
      </div>
    </section>
  );
}
