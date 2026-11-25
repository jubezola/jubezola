"use client";

import { useEffect, useState } from "react";
import { getOpenStatus, type OpenStatus } from "@/lib/hours";

/** Estado em tempo real (Europe/Lisbon). Renderizado só no cliente para evitar desfasamento com o HTML estático. */
export function OpenBadge({ tone = "dark" }: { tone?: "dark" | "light" }) {
  const [status, setStatus] = useState<OpenStatus | null>(null);

  useEffect(() => {
    const update = () => setStatus(getOpenStatus(new Date()));
    update();
    const id = window.setInterval(update, 30_000);
    const onVisible = () => document.visibilityState === "visible" && update();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const base =
    tone === "dark"
      ? "bg-ink/70 text-cream ring-1 ring-cream/15 backdrop-blur-md"
      : "bg-paper text-ink ring-1 ring-ink/10";

  return (
    <p
      className={`inline-flex min-h-9 items-center gap-2.5 rounded-full px-3.5 py-1.5 text-sm ${base}`}
      aria-live="polite"
      data-testid="open-badge"
    >
      {status ? (
        <>
          <span
            className={`size-2.5 shrink-0 rounded-full ${status.isOpen ? "pulse-dot bg-lime" : "bg-[#d4806f]"}`}
            aria-hidden="true"
          />
          <span className="font-semibold">{status.label}</span>
          {status.detail && (
            <>
              <span aria-hidden="true" className="opacity-50">·</span>
              <span>{status.detail}</span>
            </>
          )}
        </>
      ) : (
        <span className="opacity-70">A verificar horário…</span>
      )}
    </p>
  );
}
