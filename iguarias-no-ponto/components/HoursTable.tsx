"use client";

import { useEffect, useState } from "react";
import { DAY_NAMES, WEEK_SCHEDULE, formatIntervals, lisbonClock } from "@/lib/hours";

const ORDER = [1, 2, 3, 4, 5, 6, 0]; // Segunda primeiro

export function HoursTable() {
  const [today, setToday] = useState<number | null>(null);
  useEffect(() => {
    const update = () => setToday(lisbonClock(new Date()).day);
    update();
    const id = window.setInterval(update, 60_000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <table className="w-full text-left" data-testid="hours-table">
      <caption className="sr-only">Horário semanal (hora de Lisboa)</caption>
      <tbody>
        {ORDER.map((d) => {
          const isToday = d === today;
          const closed = WEEK_SCHEDULE[d].length === 0;
          return (
            <tr
              key={d}
              className={`border-b border-ink/10 ${isToday ? "bg-lime/35" : ""}`}
              aria-current={isToday ? "date" : undefined}
            >
              <th scope="row" className={`py-3 pl-3 pr-4 font-normal ${isToday ? "font-semibold" : ""}`}>
                {DAY_NAMES[d]}
                {isToday && <span className="ml-2 rounded-full bg-ink px-2 py-0.5 text-xs font-semibold text-lime">Hoje</span>}
              </th>
              <td className={`py-3 pr-3 text-right tabular-nums ${closed ? "text-muted" : ""} ${isToday ? "font-semibold" : ""}`}>
                {closed ? (
                  formatIntervals(WEEK_SCHEDULE[d])
                ) : (
                  <span className="inline-flex flex-wrap justify-end gap-x-3">
                    {WEEK_SCHEDULE[d].map((it) => (
                      <span key={it.open} className="whitespace-nowrap">{it.open}–{it.close}</span>
                    ))}
                  </span>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
