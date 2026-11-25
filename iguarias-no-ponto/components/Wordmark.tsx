/** Logótipo tipográfico inspirado no letreiro: "Iguarias" + "no ponto" em verde-lima. */
export function Wordmark({ tone = "light", className = "" }: { tone?: "light" | "dark"; className?: string }) {
  const main = tone === "light" ? "text-cream" : "text-ink";
  const accent = tone === "light" ? "text-lime" : "text-olive";
  return (
    <span className={`inline-flex items-baseline gap-1.5 font-serif leading-none ${className}`}>
      <span className={`text-[1.4em] font-medium tracking-tight ${main}`}>Iguarias</span>
      <span className={`text-[0.95em] italic ${accent}`}>no ponto</span>
    </span>
  );
}
