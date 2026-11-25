/**
 * Horário e estado "Aberto/Fechado" calculado no fuso Europe/Lisbon.
 * Funções puras: recebem a data como argumento para poderem ser testadas.
 */

export type Interval = { open: string; close: string };

/** Índice 0 = domingo … 6 = sábado (igual a Date#getDay). */
export const WEEK_SCHEDULE: Interval[][] = [
  [],
  [{ open: "12:00", close: "14:30" }, { open: "19:00", close: "21:00" }],
  [{ open: "12:00", close: "14:30" }, { open: "19:00", close: "21:00" }],
  [{ open: "12:00", close: "14:30" }, { open: "19:00", close: "21:00" }],
  [{ open: "12:00", close: "14:30" }, { open: "19:00", close: "21:00" }],
  [{ open: "12:00", close: "14:30" }, { open: "19:00", close: "21:00" }],
  [{ open: "12:00", close: "14:30" }],
];

export const DAY_NAMES = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"] as const;
const DAY_NAMES_LOWER = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"] as const;

export const TIME_ZONE = "Europe/Lisbon";

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

const WEEKDAY_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/** Dia da semana e minutos desde a meia-noite em Lisboa (trata hora de verão automaticamente). */
export function lisbonClock(date: Date): { day: number; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return { day: WEEKDAY_INDEX[get("weekday")], minutes: Number(get("hour")) * 60 + Number(get("minute")) };
}

export type OpenStatus = {
  isOpen: boolean;
  /** Texto curto do badge, ex.: "Aberto agora", "Fechado", "Encerrado hoje". */
  label: string;
  /** Complemento, ex.: "Fecha às 14:30", "Abre às 19:00", "Abre amanhã às 12:00". */
  detail: string;
  today: number;
};

function nextOpening(day: number, minutes: number): { dayOffset: number; time: string } | null {
  for (let offset = 0; offset < 8; offset++) {
    const d = (day + offset) % 7;
    for (const it of WEEK_SCHEDULE[d]) {
      if (offset > 0 || toMinutes(it.open) > minutes) return { dayOffset: offset, time: it.open };
    }
  }
  return null;
}

export function getOpenStatus(date: Date = new Date()): OpenStatus {
  const { day, minutes } = lisbonClock(date);
  const today = WEEK_SCHEDULE[day];

  const current = today.find((it) => minutes >= toMinutes(it.open) && minutes < toMinutes(it.close));
  if (current) return { isOpen: true, label: "Aberto agora", detail: `Fecha às ${current.close}`, today: day };

  const next = nextOpening(day, minutes);
  const closedAllDay = today.length === 0;
  const label = closedAllDay ? "Encerrado hoje" : "Fechado";
  if (!next) return { isOpen: false, label, detail: "", today: day };

  let when: string;
  if (next.dayOffset === 0) when = `Abre às ${next.time}`;
  else if (next.dayOffset === 1) when = `Abre amanhã às ${next.time}`;
  else when = `Abre ${DAY_NAMES_LOWER[(day + next.dayOffset) % 7]} às ${next.time}`;

  return { isOpen: false, label, detail: when, today: day };
}

/** Linhas agrupadas para a tabela de horário. */
export function formatIntervals(intervals: Interval[]): string {
  if (intervals.length === 0) return "Encerrado";
  return intervals.map((i) => `${i.open}–${i.close}`).join(" · ");
}

/** Para schema.org openingHoursSpecification. */
export const SCHEMA_DAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
