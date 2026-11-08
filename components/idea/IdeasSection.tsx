"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, ClipboardCheck, Copy, LoaderCircle, Sparkles } from "lucide-react";
import { LENS_LABEL } from "@/lib/lenses";
import type { Card, Idea } from "@/lib/types";
import s from "./report.module.css";

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
  const res = await fetch("/api/ideas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Couldn't do that right now. Try again.");
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
      setIdeas((cur) => [...cur, ...(data.ideas as Idea[])]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy("");
    }
  }

  return (
    <section className={s.section} aria-labelledby="ideas">
      <h2 id="ideas" className={s.h2}>
        Ideas you could build
      </h2>
      <p className={s.lede}>Each idea answers real complaints from this problem. Anything still unproven is labelled.</p>

      {card.thoughts && <p className={s.pitch}>{card.thoughts}</p>}

      <div className={s.ideas}>
        {ideas.map((idea, i) => (
          <IdeaView key={`${idea.title}-${i}`} idea={idea} card={card} />
        ))}
      </div>

      {canAsk && (
        <div className={s.remix}>
          <span className={s.remixLabel}>
            <Sparkles size={15} aria-hidden="true" />
            {ideas.length ? "Get more ideas" : "Generate ideas"}
          </span>
          <div className={s.chips}>
            {(ideas.length ? TWISTS : ["More like this"]).map((t) => (
              <button key={t} type="button" className={s.chip} disabled={!!busy} onClick={() => remix(t)}>
                {busy === t && <LoaderCircle size={14} className="spin" aria-hidden="true" />}
                {ideas.length || t !== "More like this" ? t : "Generate ideas"}
              </button>
            ))}
          </div>
        </div>
      )}
      {error && (
        <p className={s.error} role="alert">
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
    <article className={`${s.idea} rise`}>
      <div className={s.ideaTop}>
        <span className={s.badges}>
          <span className={s.lens}>{LENS_LABEL[idea.lens]}</span>
          {idea.form === "feature" && <span className={s.lens}>Feature, not a startup</span>}
        </span>
        <span className={s.score} title="From the evidence it answers, money signals and existing products">
          {idea.score}
        </span>
      </div>
      <h3 className={s.ideaTitle}>{idea.title}</h3>
      <p className={s.pitch}>{idea.pitch}</p>

      {(idea.norm || idea.flaw || idea.shift) && (
        <div className={s.take}>
          {idea.norm && (
            <p>
              <span className={s.answersLabel}>What most apps do</span>
              {idea.norm}
            </p>
          )}
          {idea.flaw && (
            <p>
              <span className={s.answersLabel}>What&apos;s wrong with that</span>
              {idea.flaw}
            </p>
          )}
          {idea.shift && (
            <p className={s.shift}>
              <span className={s.answersLabel}>A different approach</span>
              {idea.shift}
            </p>
          )}
        </div>
      )}

      {idea.twists && idea.twists.length > 0 && (
        <div className={s.block}>
          <span className={s.answersLabel}>Interesting twists</span>
          <ul className={s.twists}>
            {idea.twists.map((t) => (
              <li key={t.name}>
                <strong>{t.name}</strong> {t.how}
              </li>
            ))}
          </ul>
        </div>
      )}

      {idea.whyLove && (
        <div className={s.block}>
          <span className={s.answersLabel}>Why people might love it</span>
          <p>{idea.whyLove}</p>
        </div>
      )}

      <dl className={s.facts}>
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>

      {idea.evidence.length > 0 && (
        <div className={s.answers}>
          <span className={s.answersLabel}>Answers these complaints</span>
          {idea.evidence.map((q) => (
            <q key={q}>{q}</q>
          ))}
        </div>
      )}

      {idea.similar && (
        <a href={idea.similar.url} target="_blank" rel="noopener noreferrer" className={s.similar}>
          <span>
            <strong>Closest existing product:</strong> {idea.similar.name}
          </span>
          <ArrowUpRight size={16} aria-hidden="true" />
        </a>
      )}

      {idea.competitorCheck && (
        <div className={s.block}>
          <span className={s.answersLabel}>Competitive reality</span>
          <p>{idea.competitorCheck}</p>
        </div>
      )}

      {idea.unproven && (
        <div className={s.block}>
          <span className={s.answersLabel}>Still unproven</span>
          <p>{idea.unproven}</p>
        </div>
      )}

      {plan ? (
        <ValidationPlan plan={plan} />
      ) : (
        <button type="button" className={`glossy ${s.validate}`} onClick={validate} disabled={busy}>
          {busy ? <LoaderCircle size={16} className="spin" aria-hidden="true" /> : <ClipboardCheck size={16} aria-hidden="true" />}
          Validate in a day
        </button>
      )}
      {error && (
        <p className={s.error} role="alert">
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
    <div className={`${s.plan} rise`}>
      <p className={s.planLabel}>1 · Landing page (in their words)</p>
      <div className={s.landing}>
        <strong>{plan.headline}</strong>
        <span>{plan.subhead}</span>
        <ul>
          {plan.bullets.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
        <span className={`glossy ${s.fakeBtn}`}>{plan.cta}</span>
      </div>

      <p className={s.planLabel}>2 · Ask 5 people these questions</p>
      <ol className={s.questions}>
        {plan.questions.map((q) => (
          <li key={q}>{q}</li>
        ))}
      </ol>

      <p className={s.planLabel}>3 · Message someone who complained</p>
      <div className={s.outreach}>
        <p>{plan.outreach}</p>
        <button
          type="button"
          className={s.copy}
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
      <p className={s.fine}>Find them through the source links above. If 3 of 5 describe the problem without prompting, keep going.</p>
    </div>
  );
}
