import { Check, Minus } from "lucide-react";
import type { Report, Signal } from "@/lib/types";
import { VERDICT } from "@/lib/verdict";
import s from "./report.module.css";

const SIGNALS: [Signal, string][] = [
  ["pays", "pay or would pay"],
  ["switching", "switched products"],
  ["price", "complain about price"],
  ["workaround", "built a workaround"],
];

export default function WorthBuilding({ report }: { report: Report }) {
  const v = VERDICT[report.verdict];
  return (
    <section className={s.section} aria-labelledby="worth">
      <h2 id="worth" className={s.h2}>
        Worth building?
      </h2>
      <div className={`${s.verdict} ${s[report.verdict]}`}>
        <span className={s.verdictLabel}>{v.label}</span>
        <span className={s.verdictNote}>{v.note}</span>
      </div>

      <ul className={s.reasons}>
        {report.reasons.map((r) => {
          const negative = /^(only|no one)/i.test(r);
          return (
            <li key={r}>
              {negative ? <Minus size={16} aria-hidden="true" /> : <Check size={16} aria-hidden="true" />}
              {r}
            </li>
          );
        })}
      </ul>

      <div className={s.signals}>
        {SIGNALS.map(([key, label]) => (
          <div key={key} className={`${s.signal} ${report.signals[key] ? s.signalOn : ""}`}>
            <span className={s.signalNum}>{report.signals[key]}</span>
            <span className={s.signalLabel}>{label}</span>
          </div>
        ))}
      </div>

      {(report.today || report.workarounds.length > 0) && (
        <div className={s.today}>
          {report.today && (
            <p>
              <strong>What they use today:</strong> {report.today}
            </p>
          )}
          {report.workarounds.length > 0 && (
            <p>
              <strong>Workarounds people built:</strong> {report.workarounds.join("; ")}.
            </p>
          )}
        </div>
      )}
      <p className={s.fine}>Counted from the verified complaints below. Signals are found by AI reading each post; the verdict itself is computed.</p>
    </section>
  );
}
