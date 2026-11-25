"use client";

import { useEffect, useState } from "react";
import { IconPhone, IconWhatsApp } from "./Icons";
import { telUrl, whatsappUrl } from "@/lib/site";

/** Barra fixa no telemóvel: WhatsApp (principal) + Ligar. Aparece depois do hero. */
export function MobileActionBar() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > window.innerHeight * 0.6);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-30 border-t border-cream/10 bg-ink/95 px-4 pt-3 backdrop-blur-md transition-transform duration-300 md:hidden ${
        visible ? "translate-y-0" : "pointer-events-none translate-y-full"
      }`}
      style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      aria-hidden={!visible}
      data-testid="mobile-bar"
    >
      <div className="flex gap-3">
        <a
          href={whatsappUrl("Olá! Queria encomendar a ementa de hoje.")}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-lime flex-1"
          tabIndex={visible ? 0 : -1}
        >
          <IconWhatsApp size={20} /> Encomendar no WhatsApp
        </a>
        <a href={telUrl()} className="btn btn-ghost-dark w-14 shrink-0 px-0" aria-label="Ligar para o restaurante" tabIndex={visible ? 0 : -1}>
          <IconPhone size={20} />
        </a>
      </div>
    </div>
  );
}
