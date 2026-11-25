export function SectionHeading({
  index,
  kicker,
  title,
  intro,
  tone = "light",
  id,
}: {
  index: string;
  kicker: string;
  title: React.ReactNode;
  intro?: React.ReactNode;
  tone?: "light" | "dark";
  id?: string;
}) {
  const k = tone === "light" ? "text-olive" : "text-lime";
  const t = tone === "light" ? "text-ink" : "text-cream";
  const i = tone === "light" ? "text-muted" : "text-muted-dark";
  return (
    <div data-reveal>
      <p className={`kicker flex items-center gap-3 ${k}`}>
        <span className="tabular-nums">{index}</span>
        <span aria-hidden="true" className="h-px w-8 bg-current opacity-50" />
        <span>{kicker}</span>
      </p>
      <h2 id={id} className={`mt-4 text-[2.5rem] sm:text-5xl lg:text-6xl ${t}`}>
        {title}
      </h2>
      {intro && <p className={`mt-5 max-w-xl text-lg ${i}`}>{intro}</p>}
    </div>
  );
}
