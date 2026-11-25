import { Header } from "@/components/Header";
import { MobileActionBar } from "@/components/MobileActionBar";
import { RevealObserver } from "@/components/Reveal";
import { Hero } from "@/components/sections/Hero";
import { DailyMenu } from "@/components/sections/DailyMenu";
import { Dishes } from "@/components/sections/Dishes";
import { Services } from "@/components/sections/Services";
import { Catering } from "@/components/sections/Catering";
import { PracticalInfo } from "@/components/sections/PracticalInfo";
import { Location } from "@/components/sections/Location";
import { Footer } from "@/components/sections/Footer";
import { restaurantJsonLd } from "@/lib/schema";

export default function Home() {
  const jsonLd = JSON.stringify(restaurantJsonLd()).replace(/</g, "\\u003c");
  return (
    <>
      <a href="#ementa" className="sr-only z-50 rounded-full bg-lime px-4 py-3 font-semibold text-ink focus:not-sr-only focus:fixed focus:left-4 focus:top-4">
        Saltar para a ementa do dia
      </a>
      <Header />
      <main>
        <Hero />
        <DailyMenu />
        <Dishes />
        <Services />
        <Catering />
        <PracticalInfo />
        <Location />
      </main>
      <Footer />
      <MobileActionBar />
      <RevealObserver />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
    </>
  );
}
