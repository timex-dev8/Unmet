import Link from "next/link";
import { ideaHref } from "@/lib/links";
import type { Card } from "@/lib/types";
import { VERDICT } from "@/lib/verdict";
import { Quote } from "@/components/card/parts";
import s from "./landing.module.css";

// The sky hero: serif headline, two buttons, and a real answer from the live feed floating below.
export default function Hero({ example, fallbackSlug }: { example: Card | null; fallbackSlug: string }) {
  return (
    <header className={s.hero}>
      <div className={s.clouds} aria-hidden="true" />

      <div className={s.heroInner}>
        <p className={s.kicker}>Code doesn’t make you money. The right idea does.</p>
        <h1 className={s.h1}>Build what people are already asking for</h1>
        <p className={s.lede}>
          Unmet finds what people already complain about and tells you if it’s worth building. Every quote is checked against its source.
        </p>
        <div className={s.ctas}>
          <Link href="/welcome" className={`glossy ${s.btn}`}>
            Find your first idea
          </Link>
          <Link href={ideaHref(example?.slug ?? fallbackSlug)} className={s.ghost}>
            See an example
          </Link>
        </div>
      </div>

      <Preview example={example} />
    </header>
  );
}

// The card's quote is already under 15 words; clip anyway so it never grows past that.
function clipQuote(text: string) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  return words.length < 15 ? words.join(" ") : `${words.slice(0, 13).join(" ")}…`;
}

function Preview({ example }: { example: Card | null }) {
  const ideas = (example?.ideas ?? []).slice(0, 2);
  const quote = example?.quote ? clipQuote(example.quote) : "";
  const sites = example ? new Set(example.sources.map((x) => x.site)).size || 1 : 0;
  const verdict = example?.report ? VERDICT[example.report.verdict].label : VERDICT.strong.label;
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
            {example && quote && (
              <div className={s.previewQuote}>
                <Quote text={quote} highlight={example.highlight} className={s.previewQuoteText} />
                <Link href={`${ideaHref(example.slug)}#sources`} className={s.previewQuoteLink}>
                  Read the sources
                </Link>
              </div>
            )}
            {example && (
              <p className={s.previewMeta}>
                {example.evidence.threads} {example.evidence.threads === 1 ? "source" : "sources"} on {sites} {sites === 1 ? "site" : "sites"} ·
                every quote checked
              </p>
            )}
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
            <Link href={example ? ideaHref(example.slug) : "/welcome"} className={`glossy ${s.btn} ${s.sideBtn}`}>
              See the full report
            </Link>
          </aside>
        </div>
      </figure>
    </div>
  );
}
