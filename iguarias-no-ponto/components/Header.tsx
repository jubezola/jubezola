"use client";

import { useEffect, useRef, useState } from "react";
import { Wordmark } from "./Wordmark";
import { IconClose, IconMenu, IconWhatsApp, IconPhone } from "./Icons";
import { PRIMARY_PHONE, telUrl, whatsappUrl } from "@/lib/site";
import { NAV } from "@/lib/nav";

export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.querySelector<HTMLElement>("a")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        toggleRef.current?.focus();
      }
      if (e.key === "Tab" && panelRef.current) {
        const items = panelRef.current.querySelectorAll<HTMLElement>("a, button");
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const close = () => mq.matches && setOpen(false);
    mq.addEventListener("change", close);
    return () => mq.removeEventListener("change", close);
  }, []);

  // Fecha o menu e só depois navega: com o body bloqueado (overflow hidden) o scroll da âncora não acontece.
  const navigate = (e: React.MouseEvent<HTMLAnchorElement>) => {
    const href = e.currentTarget.getAttribute("href");
    setOpen(false);
    if (!href?.startsWith("#")) return;
    e.preventDefault();
    document.body.style.overflow = "";
    const target = document.getElementById(href.slice(1));
    if (!target) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    target.scrollIntoView({ behavior: reduce ? "auto" : "smooth" });
    history.pushState(null, "", href);
    target.setAttribute("tabindex", "-1");
    target.focus({ preventScroll: true });
  };

  return (
    <header
      className={`fixed inset-x-0 top-0 z-40 transition-[background-color,box-shadow] duration-300 ${
        scrolled || open ? "bg-ink/95 shadow-[0_1px_0_rgb(246_239_227/0.08)] backdrop-blur-md" : "bg-transparent"
      }`}
    >
      <div className="container-x flex h-16 items-center justify-between gap-4 md:h-[4.5rem]">
        <a href="#inicio" className="-ml-1 rounded px-1 py-2 text-lg" aria-label="Iguarias no ponto, início">
          <Wordmark />
        </a>

        <nav aria-label="Principal" className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {NAV.map((n) => (
              <li key={n.href}>
                <a
                  href={n.href}
                  className="rounded-full px-3 py-2 text-[0.95rem] text-cream/80 transition-colors hover:text-cream"
                >
                  {n.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-2">
          <a
            href={whatsappUrl("Olá! Queria fazer uma encomenda.")}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-lime hidden min-h-11 px-4 py-2 text-[0.95rem] sm:inline-flex"
          >
            <IconWhatsApp size={20} />
            Encomendar
          </a>
          <button
            ref={toggleRef}
            type="button"
            className="inline-flex size-11 items-center justify-center rounded-full text-cream ring-1 ring-cream/20 lg:hidden"
            aria-expanded={open}
            aria-controls="menu-mobile"
            aria-label={open ? "Fechar menu" : "Abrir menu"}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <IconClose /> : <IconMenu />}
          </button>
        </div>
      </div>

      <div
        id="menu-mobile"
        ref={panelRef}
        hidden={!open}
        className="h-[calc(100dvh-4rem)] overflow-y-auto bg-ink lg:hidden"
      >
        <nav aria-label="Menu" className="container-x flex flex-col pb-10 pt-4">
          <ul>
            {NAV.map((n, i) => (
              <li key={n.href} className="border-b border-cream/10">
                <a
                  href={n.href}
                  onClick={navigate}
                  className="flex items-baseline gap-4 py-4 font-serif text-3xl text-cream"
                >
                  <span className="w-6 font-sans text-xs tabular-nums text-lime">{String(i + 1).padStart(2, "0")}</span>
                  {n.label}
                </a>
              </li>
            ))}
          </ul>
          <div className="mt-8 grid gap-3">
            <a
              href={whatsappUrl("Olá! Queria fazer uma encomenda.")}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-lime w-full"
              onClick={() => setOpen(false)}
            >
              <IconWhatsApp size={20} /> Encomendar no WhatsApp
            </a>
            <a href={telUrl()} className="btn btn-ghost-dark w-full" onClick={() => setOpen(false)}>
              <IconPhone size={20} /> Ligar {PRIMARY_PHONE.display}
            </a>
          </div>
        </nav>
      </div>
    </header>
  );
}
