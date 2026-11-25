"use client";

import { useState } from "react";
import { MAPS } from "@/lib/site";
import { IconPin } from "./Icons";

/**
 * O mapa do Google só carrega após clique: evita cookies de terceiros sem consentimento (RGPD)
 * e ~1 MB de JavaScript no carregamento inicial.
 */
export function MapEmbed() {
  const [load, setLoad] = useState(false);
  return (
    <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-ink-2 sm:aspect-[16/9] lg:aspect-auto lg:h-full lg:min-h-[22rem]">
      {load ? (
        <iframe
          title="Mapa: Iguarias no Ponto, Rua Pedro Álvares Cabral, Coimbra"
          src={MAPS.embedUrl}
          className="absolute inset-0 size-full border-0"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          allowFullScreen
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center text-cream">
          <div aria-hidden="true" className="absolute inset-0 opacity-[0.08] [background-image:linear-gradient(var(--color-cream)_1px,transparent_1px),linear-gradient(90deg,var(--color-cream)_1px,transparent_1px)] [background-size:36px_36px]" />
          <span className="relative inline-flex size-14 items-center justify-center rounded-full bg-lime text-ink">
            <IconPin size={28} />
          </span>
          <p className="relative max-w-xs text-cream/85">Rua Pedro Álvares Cabral, Loja 94 e 96, Coimbra</p>
          <button type="button" onClick={() => setLoad(true)} className="btn btn-ghost-dark relative">
            Mostrar mapa
          </button>
          <p className="relative max-w-xs text-xs text-cream/60">Ao mostrar o mapa, carrega conteúdo do Google Maps.</p>
        </div>
      )}
    </div>
  );
}
