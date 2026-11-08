"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, ClipboardCheck, Copy, LoaderCircle, Sparkles } from "lucide-react";
import { LENS_LABEL } from "@/lib/lenses";
import type { Card, Idea } from "@/lib/types";
import styles from "./report.module.css";

const TWISTS = ["More like this", "Make it B2B", "Make it cheaper", "Make it AI-first", "Make it for consumers"];

type Validation = { headline: string; subhead: string; bullets: string[]; cta: string; questions: string[]; outreach: string };

function payload(card: Card) {
  const quotes = [card.quote, ...(card.ideas ?? []).flatMap((i) => i.evidence)].filter(Boolean);
  return {
    headline: card.headline,
    summary: card.summary,
    who: card.who,
    quotes: [...new Set(quotes)].slice(0, 12),
    today: card.report?.today,
    workarounds: card.report?.workarounds ?? [],
    verdict: card.report?.verdict,
  };
}

async function ask(body: object) {
  const response = await fetch("/api/ideas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error ?? "Couldn't do that right now. Try again.");
  return data;
}

export default function IdeasSection({ card }: { card: Card }) {
  const [ideas, setIdeas] = useState<Idea[]>(card.ideas ?? []);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const canAsk = Boolean(card.quote || card.ideas?.length);

  async function remix(twist: string) {
    setError("");
    setBusy(twist);
    try {
      const data = await ask({ mode: "remix", twist, card: payload(card) });
      setIdeas((currentIdeas) => [...currentIdeas, ...(data.ideas as Idea[])]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy("");
    }
  }

  return (
    <section className={styles.section} aria-labelledby="ideas">
      <h2 id="ideas" className={styles.h2}>
        Ideas you could build
      </h2>
      <p className={styles.lede}>Each idea answers real complaints from this problem. Anything still unproven is labelled.</p>

      {card.thoughts && <p className={styles.pitch}>{card.thoughts}</p>}

      <div className={styles.ideas}>
        {ideas.map((idea, i) => (
          <IdeaView key={`${idea.title}-${i}`} idea={idea} card={card} />
        ))}
      </div>

      {canAsk && (
        <div className={styles.remix}>
          <span className={styles.remixLabel}>
            <Sparkles size={15} aria-hidden="true" />
            {ideas.length ? "Get more ideas" : "Generate ideas"}
          </span>
          <div className={styles.chips}>
            {(ideas.length ? TWISTS : ["More like this"]).map((twist) => (
              <button key={twist} type="button" className={styles.chip} disabled={!!busy} onClick={() => remix(twist)}>
                {busy === twist && <LoaderCircle size={14} className="spin" aria-hidden="true" />}
                {ideas.length || twist !== "More like this" ? twist : "Generate ideas"}
              </button>
            ))}
          </div>
        </div>
      )}
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </section>
  );
}

function IdeaView({ idea, card }: { idea: Idea; card: Card }) {
  const [plan, setPlan] = useState<Validation | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function validate() {
    setError("");
    setBusy(true);
    try {
      const data = await ask({ mode: "validate", card: payload(card), idea: { title: idea.title, pitch: idea.pitch } });
      setPlan(data.validate as Validation);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  const rows: [string, string][] = [
    ["Who pays", `${idea.whoPays} · ${idea.price}`],
    ["Why they'd switch", idea.wedge],
    ["First version", idea.mvp],
    ["First 10 users", idea.firstUsers],
    ["Biggest risk", idea.risks],
  ];

  return (
    <article className={`${styles.idea} rise`}>
      <div className={styles.ideaTop}>
        <span className={styles.badges}>
          <span className={styles.lens}>{LENS_LABEL[idea.lens]}</span>
          {idea.form === "feature" && <span className={styles.lens}>Feature, not a startup</span>}
        </span>
        <span className={styles.score} title="From the evidence it answers, money signals and existing products">
          {idea.score}
        </span>
      </div>
      <h3 className={styles.ideaTitle}>{idea.title}</h3>
      <p className={styles.pitch}>{idea.pitch}</p>

      {(idea.norm || idea.flaw || idea.shift) && (
        <div className={styles.take}>
          {idea.norm && (
            <p>
              <span className={styles.answersLabel}>What most apps do</span>
              {idea.norm}
            </p>
          )}
          {idea.flaw && (
            <p>
              <span className={styles.answersLabel}>What&apos;s wrong with that</span>
              {idea.flaw}
            </p>
          )}
          {idea.shift && (
            <p className={styles.shift}>
              <span className={styles.answersLabel}>A different approach</span>
              {idea.shift}
            </p>
          )}
        </div>
      )}

      {idea.twists && idea.twists.length > 0 && (
        <div className={styles.block}>
          <span className={styles.answersLabel}>Interesting twists</span>
          <ul className={styles.twists}>
            {idea.twists.map((twist) => (
              <li key={twist.name}>
                <strong>{twist.name}</strong> {twist.how}
              </li>
            ))}
          </ul>
        </div>
      )}

      {idea.whyLove && (
        <div className={styles.block}>
          <span className={styles.answersLabel}>Why people might love it</span>
          <p>{idea.whyLove}</p>
        </div>
      )}

      <dl className={styles.facts}>
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>

      {idea.evidence.length > 0 && (
        <div className={styles.answers}>
          <span className={styles.answersLabel}>Answers these complaints</span>
          {idea.evidence.map((quote) => (
            <q key={quote}>{quote}</q>
          ))}
        </div>
      )}

      {idea.similar && (
        <a href={idea.similar.url} target="_blank" rel="noopener noreferrer" className={styles.similar}>
          <span>
            <strong>Closest existing product:</strong> {idea.similar.name}
          </span>
          <ArrowUpRight size={16} aria-hidden="true" />
        </a>
      )}

      {idea.competitorCheck && (
        <div className={styles.block}>
          <span className={styles.answersLabel}>Competitive reality</span>
          <p>{idea.competitorCheck}</p>
        </div>
      )}

      {idea.unproven && (
        <div className={styles.block}>
          <span className={styles.answersLabel}>Still unproven</span>
          <p>{idea.unproven}</p>
        </div>
      )}

      {plan ? (
        <ValidationPlan plan={plan} />
      ) : (
        <button type="button" className={`glossy ${styles.validate}`} onClick={validate} disabled={busy}>
          {busy ? <LoaderCircle size={16} className="spin" aria-hidden="true" /> : <ClipboardCheck size={16} aria-hidden="true" />}
          Validate in a day
        </button>
      )}
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </article>
  );
}

function ValidationPlan({ plan }: { plan: Validation }) {
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(copyTimer.current), []);
  return (
    <div className={`${styles.plan} rise`}>
      <p className={styles.planLabel}>1 · Landing page (in their words)</p>
      <div className={styles.landing}>
        <strong>{plan.headline}</strong>
        <span>{plan.subhead}</span>
        <ul>
          {plan.bullets.map((bullet) => (
            <li key={bullet}>{bullet}</li>
          ))}
        </ul>
        <span className={`glossy ${styles.fakeBtn}`}>{plan.cta}</span>
      </div>

      <p className={styles.planLabel}>2 · Ask 5 people these questions</p>
      <ol className={styles.questions}>
        {plan.questions.map((question) => (
          <li key={question}>{question}</li>
        ))}
      </ol>

      <p className={styles.planLabel}>3 · Message someone who complained</p>
      <div className={styles.outreach}>
        <p>{plan.outreach}</p>
        <button
          type="button"
          className={styles.copy}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(plan.outreach);
            } catch {
              return; // no clipboard access, dont claim it copied
            }
            setCopied(true);
            clearTimeout(copyTimer.current);
            copyTimer.current = setTimeout(() => setCopied(false), 1500);
          }}
        >
          <Copy size={14} aria-hidden="true" />
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <p className={styles.fine}>Find them through the source links above. If 3 of 5 describe the problem without prompting, keep going.</p>
    </div>
  );
}
