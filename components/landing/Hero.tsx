import Link from "next/link";
import type { Card } from "@/lib/types";
import s from "./landing.module.css";

const VERDICT = { strong: "Strong opportunity", maybe: "Worth a closer look", weak: "Weak signal so far" } as const;

// The sky hero: serif headline, two buttons, and a real answer from the live feed floating below.
export default function Hero({ example, fallbackSlug }: { example: Card | null; fallbackSlug: string }) {
  return (
    <header className={s.hero}>
      <div className={s.clouds} aria-hidden="true" />

      <div className={s.heroInner}>
        <h1 className={s.h1}>Build what people are already asking for</h1>
        <p className={s.lede}>Unmet reads real complaints across the web and tells you which ones are worth building, with the proof.</p>
        <div className={s.ctas}>
          <Link href="/welcome" className={`glossy ${s.btn}`}>
            Find your first idea
          </Link>
          <Link href={`/app/idea/${example?.slug ?? fallbackSlug}`} className={s.ghost}>
            See an example
          </Link>
        </div>
      </div>

      <Preview example={example} />
    </header>
  );
}

function Preview({ example }: { example: Card | null }) {
  const ideas = (example?.ideas ?? []).slice(0, 2);
  const verdict = example?.report ? VERDICT[example.report.verdict] : "Strong opportunity";
  return (
    <div className={s.previewWrap}>
      <figure className={s.previewGlass} aria-label="An example answer from Unmet">
        <div className={s.preview}>
          <div className={s.previewMain}>
            <p className={s.bubble}>{example?.query ? example.query : "What do people hate about Calendly?"}</p>
            <div>
              <p className={s.verdict}>{verdict}</p>
              <p className={s.previewTitle}>{example?.headline ?? "Teams pay per seat for basics they barely use"}</p>
              <p className={s.previewNote}>
                {example?.report?.reasons[0] ?? "Repeated complaints on several sites, and people say they’d pay to fix it."}
              </p>
            </div>
            {example && <p className={s.previewMeta}>{example.evidence.threads} sources · every quote checked against its page</p>}
          </div>
          <aside className={s.previewSide}>
            <p className={s.sideLabel}>Ideas you could build</p>
            {ideas.length > 0 ? (
              ideas.map((idea, i) => (
                <div key={idea.title}>
                  {i > 0 && <div className={s.sideRule} />}
                  <p className={s.ideaName}>{idea.title}</p>
                  <p className={s.ideaPitch}>{idea.pitch}</p>
                </div>
              ))
            ) : (
              <>
                <div>
                  <p className={s.ideaName}>A flat-price scheduler</p>
                  <p className={s.ideaPitch}>The basics for one small price, not per seat.</p>
                </div>
                <div className={s.sideRule} />
                <div>
                  <p className={s.ideaName}>Sync that never drops</p>
                  <p className={s.ideaPitch}>Calendar sync people can trust.</p>
                </div>
              </>
            )}
            <Link href={example ? `/app/idea/${example.slug}` : "/welcome"} className={`glossy ${s.btn} ${s.sideBtn}`}>
              Validate in a day
            </Link>
          </aside>
        </div>
      </figure>
    </div>
  );
}
