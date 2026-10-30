import Link from "next/link";
import s from "./landing.module.css";

// Sample content for the preview window. Swapped for real cards once the pipeline runs.
const problems = [
  { title: "Pet medication prices", trend: "Rising", active: true },
  { title: "Renters can’t dispute deposit fees", trend: "Rising" },
  { title: "Quotes that don’t match the work", trend: "Steady" },
];

const scores = [
  { label: "Demand", value: 80, word: "High" },
  { label: "Competition", value: 55, word: "Medium" },
  { label: "Difficulty", value: 30, word: "Low" },
];

export default function Hero() {
  return (
    <header className={s.hero}>
      <div className={s.clouds} aria-hidden="true" />
      <div className={s.heroInner}>
        <h1 className={s.h1}>Find what people complain about. Build the fix.</h1>
        <p className={s.sub}>Swipe through real problems, saved with their sources.</p>
        <div className={s.ctaRow}>
          <Link href="/app" className="pill pill-white">
            Open Unmet
          </Link>
          <a href="#how" className="pill pill-glass">
            See how it works
          </a>
        </div>
      </div>

      <div className={s.window} aria-label="Preview of the Unmet app" role="img">
        <div className={s.windowBar} aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div className={s.windowBody}>
          <div className={s.problemList}>
            <div className={s.eyebrow}>Today’s problems</div>
            {problems.map((p) => (
              <div key={p.title} className={`${s.problem} ${p.active ? s.problemActive : ""}`}>
                <div className={s.problemTitle}>{p.title}</div>
                <div className={s.problemTrend}>{p.trend}</div>
              </div>
            ))}
          </div>
          <div className={s.idea}>
            <div className={s.eyebrow} style={{ margin: "0 0 10px", color: "var(--link)" }}>
              The idea
            </div>
            <div className={s.ideaTitle}>Pet medication price tracker</div>
            <p className={s.ideaLine}>Compare pharmacy prices. Get refill reminders.</p>
            <p className={s.quote}>
              “I <span className="hl">still can’t tell which pharmacy is cheapest.</span>”
            </p>
            <div className={s.scores}>
              {scores.map((sc) => (
                <div key={sc.label} style={{ display: "contents" }}>
                  <span>{sc.label}</span>
                  <div className={s.bar}>
                    <i style={{ width: `${sc.value}%` }} />
                  </div>
                  <strong>{sc.word}</strong>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
