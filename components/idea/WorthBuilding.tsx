import { Check, Minus } from "lucide-react";
import type { Report, Signal } from "@/lib/types";
import { VERDICT } from "@/lib/verdict";
import styles from "./report.module.css";

const SIGNALS: [Signal, string][] = [
  ["pays", "pay or would pay"],
  ["switching", "switched products"],
  ["price", "complain about price"],
  ["workaround", "built a workaround"],
];

export default function WorthBuilding({ report }: { report: Report }) {
  const verdict = VERDICT[report.verdict];
  return (
    <section className={styles.section} aria-labelledby="worth">
      <h2 id="worth" className={styles.h2}>
        Worth building?
      </h2>
      <div className={`${styles.verdict} ${styles[report.verdict]}`}>
        <span className={styles.verdictLabel}>{verdict.label}</span>
        <span className={styles.verdictNote}>{verdict.note}</span>
      </div>

      <ul className={styles.reasons}>
        {report.reasons.map((reason) => {
          const negative = /^(only|no one)/i.test(reason);
          return (
            <li key={reason}>
              {negative ? <Minus size={16} aria-hidden="true" /> : <Check size={16} aria-hidden="true" />}
              {reason}
            </li>
          );
        })}
      </ul>

      <div className={styles.signals}>
        {SIGNALS.map(([key, label]) => (
          <div key={key} className={`${styles.signal} ${report.signals[key] ? styles.signalOn : ""}`}>
            <span className={styles.signalNum}>{report.signals[key]}</span>
            <span className={styles.signalLabel}>{label}</span>
          </div>
        ))}
      </div>

      {(report.today || report.workarounds.length > 0) && (
        <div className={styles.today}>
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
      <p className={styles.fine}>
        Counted from the verified complaints below. Signals are found by AI reading each post; the verdict itself is computed.
      </p>
    </section>
  );
}
