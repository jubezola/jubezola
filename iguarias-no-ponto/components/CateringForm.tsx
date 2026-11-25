"use client";

import { useEffect, useId, useRef, useState } from "react";
import { buildOrderMessage, LIMITS, todayInLisbon, validateOrder, type OrderErrors, type OrderInput } from "@/lib/order";
import { PRIMARY_PHONE, telUrl, whatsappUrl } from "@/lib/site";
import { IconAlert, IconCheck, IconPhone, IconSpinner, IconWhatsApp } from "./Icons";

type Status = "idle" | "loading" | "success" | "error";
const EMPTY: OrderInput = { nome: "", telefone: "", data: "", pessoas: "", mensagem: "" };
const FIELD_ORDER: (keyof OrderInput)[] = ["nome", "telefone", "data", "pessoas", "mensagem"];

export function CateringForm() {
  const [values, setValues] = useState<OrderInput>(EMPTY);
  const [errors, setErrors] = useState<OrderErrors>({});
  const [touched, setTouched] = useState<Partial<Record<keyof OrderInput, boolean>>>({});
  const [status, setStatus] = useState<Status>("idle");
  const [waUrl, setWaUrl] = useState("");
  const [minDate, setMinDate] = useState<string>();
  const formRef = useRef<HTMLFormElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);
  const uid = useId();

  useEffect(() => setMinDate(todayInLisbon()), []);

  const set = (k: keyof OrderInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const next = { ...values, [k]: e.target.value };
    setValues(next);
    if (touched[k] || status === "error") setErrors(validateOrder(next));
  };
  const blur = (k: keyof OrderInput) => () => {
    setTouched((t) => ({ ...t, [k]: true }));
    setErrors(validateOrder(values));
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validateOrder(values);
    setErrors(errs);
    setTouched({ nome: true, telefone: true, data: true, pessoas: true, mensagem: true });
    if (Object.keys(errs).length) {
      setStatus("error");
      const first = FIELD_ORDER.find((k) => errs[k]);
      if (first) formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
      return;
    }
    setStatus("loading");
    const url = whatsappUrl(buildOrderMessage(values));
    setWaUrl(url);
    // Abrir já, dentro do gesto do utilizador, para não ser bloqueado como pop-up.
    const win = window.open(url, "_blank", "noopener,noreferrer");
    window.setTimeout(() => {
      setStatus("success");
      statusRef.current?.focus();
    }, win === null ? 0 : 400);
  };

  const reset = () => {
    setValues(EMPTY);
    setErrors({});
    setTouched({});
    setStatus("idle");
    setWaUrl("");
  };

  const err = (k: keyof OrderInput) => (touched[k] ? errors[k] : undefined);
  const errorCount = Object.keys(errors).length;

  if (status === "success") {
    return (
      <div ref={statusRef} tabIndex={-1} role="status" className="rounded-2xl bg-paper p-7 ring-1 ring-ink/10 sm:p-9" data-testid="form-success">
        <span className="inline-flex size-12 items-center justify-center rounded-full bg-lime text-ink">
          <IconCheck size={26} />
        </span>
        <h3 className="mt-5 text-3xl">Pedido pronto a enviar</h3>
        <p className="mt-3 text-muted">
          Abrimos o WhatsApp com a sua mensagem já escrita. Só precisa de carregar em <strong className="text-ink">Enviar</strong>.
          Se o WhatsApp não abriu, use o botão abaixo ou ligue-nos.
        </p>
        <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <a href={waUrl} target="_blank" rel="noopener noreferrer" className="btn btn-ink" data-testid="wa-link">
            <IconWhatsApp size={20} className="text-lime" /> Abrir WhatsApp
          </a>
          <a href={telUrl()} className="btn btn-ghost-light">
            <IconPhone size={20} /> Ligar {PRIMARY_PHONE.display}
          </a>
        </div>
        <button type="button" onClick={reset} className="mt-6 min-h-11 text-sm font-semibold text-olive underline underline-offset-4 hover:text-ink">
          Fazer outro pedido
        </button>
      </div>
    );
  }

  const labelCls = "mb-2 block text-[0.95rem] font-semibold";
  const errCls = "mt-2 flex items-center gap-1.5 text-sm font-medium text-danger";
  const describedBy = (k: keyof OrderInput, extra?: string) =>
    [err(k) ? `${uid}-${k}-err` : null, extra].filter(Boolean).join(" ") || undefined;

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate className="rounded-2xl bg-paper p-6 ring-1 ring-ink/10 sm:p-9" aria-describedby={`${uid}-hint`}>
      <p id={`${uid}-hint`} className="text-sm text-muted">
        Todos os campos são obrigatórios, exceto a mensagem. Ao enviar, abrimos o WhatsApp com o pedido escrito.
      </p>

      {status === "error" && errorCount > 0 && (
        <div role="alert" className="mt-5 flex gap-3 rounded-lg bg-danger/8 p-4 text-sm text-danger ring-1 ring-danger/25" data-testid="form-error">
          <IconAlert size={20} className="mt-0.5 shrink-0" />
          <p>
            {errorCount === 1 ? "Há 1 campo a corrigir." : `Há ${errorCount} campos a corrigir.`} Veja as indicações em baixo.
          </p>
        </div>
      )}

      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor={`${uid}-nome`} className={labelCls}>Nome</label>
          <input id={`${uid}-nome`} name="nome" autoComplete="name" className="field" value={values.nome} onChange={set("nome")} onBlur={blur("nome")}
            maxLength={LIMITS.nomeMax + 20} aria-invalid={!!err("nome")} aria-describedby={describedBy("nome")} required />
          {err("nome") && <p id={`${uid}-nome-err`} className={errCls}><IconAlert size={16} />{err("nome")}</p>}
        </div>
        <div className="sm:col-span-2">
          <label htmlFor={`${uid}-telefone`} className={labelCls}>Telefone</label>
          <input id={`${uid}-telefone`} name="telefone" type="tel" inputMode="tel" autoComplete="tel" placeholder="912 345 678" className="field"
            value={values.telefone} onChange={set("telefone")} onBlur={blur("telefone")} aria-invalid={!!err("telefone")} aria-describedby={describedBy("telefone")} required />
          {err("telefone") && <p id={`${uid}-telefone-err`} className={errCls}><IconAlert size={16} />{err("telefone")}</p>}
        </div>
        <div>
          <label htmlFor={`${uid}-data`} className={labelCls}>Data</label>
          <input id={`${uid}-data`} name="data" type="date" min={minDate} className="field" value={values.data} onChange={set("data")} onBlur={blur("data")}
            aria-invalid={!!err("data")} aria-describedby={describedBy("data")} required />
          {err("data") && <p id={`${uid}-data-err`} className={errCls}><IconAlert size={16} />{err("data")}</p>}
        </div>
        <div>
          <label htmlFor={`${uid}-pessoas`} className={labelCls}>N.º de pessoas</label>
          <input id={`${uid}-pessoas`} name="pessoas" type="number" inputMode="numeric" min={1} max={LIMITS.pessoasMax} step={1} className="field"
            value={values.pessoas} onChange={set("pessoas")} onBlur={blur("pessoas")} aria-invalid={!!err("pessoas")} aria-describedby={describedBy("pessoas")} required />
          {err("pessoas") && <p id={`${uid}-pessoas-err`} className={errCls}><IconAlert size={16} />{err("pessoas")}</p>}
        </div>
        <div className="sm:col-span-2">
          <label htmlFor={`${uid}-mensagem`} className={labelCls}>
            Mensagem <span className="font-normal text-muted">(opcional)</span>
          </label>
          <textarea id={`${uid}-mensagem`} name="mensagem" rows={4} className="field resize-y" placeholder="Tipo de evento, pratos que gostava, restrições alimentares, entrega ou levantamento…"
            value={values.mensagem} onChange={set("mensagem")} onBlur={blur("mensagem")} aria-invalid={!!err("mensagem")} aria-describedby={describedBy("mensagem", `${uid}-mensagem-count`)} />
          <div className="mt-1.5 flex justify-between gap-4">
            {err("mensagem") ? <p id={`${uid}-mensagem-err`} className={errCls}><IconAlert size={16} />{err("mensagem")}</p> : <span />}
            <p id={`${uid}-mensagem-count`} className={`text-xs tabular-nums ${values.mensagem.length > LIMITS.mensagemMax ? "text-danger" : "text-muted"}`}>
              {values.mensagem.length}/{LIMITS.mensagemMax}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-7 flex flex-col gap-4 sm:flex-row sm:items-center">
        <button type="submit" className="btn btn-ink sm:px-7" disabled={status === "loading"} aria-busy={status === "loading"}>
          {status === "loading" ? (
            <><IconSpinner size={20} /> A preparar mensagem…</>
          ) : (
            <><IconWhatsApp size={20} className="text-lime" /> Enviar pedido no WhatsApp</>
          )}
        </button>
        <a href={telUrl()} className="inline-flex min-h-11 items-center gap-2 text-[0.95rem] text-muted hover:text-ink">
          <IconPhone size={18} /> ou ligue <span className="font-semibold text-ink tabular-nums">{PRIMARY_PHONE.display}</span>
        </a>
      </div>
    </form>
  );
}
