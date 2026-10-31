import type { Metadata } from "next";
import Link from "next/link";
import { Search, Sparkles } from "lucide-react";
import { CardTags } from "@/components/card/parts";
import { searchCards } from "@/lib/cards";
import s from "./search.module.css";

export const metadata: Metadata = { title: "Search" };

// The query comes from the URL; render the whole page on the server before sending it.
export const instant = false;

const suggestions = ["invoices", "tests", "receipts", "tabs", "meetings"];

export default async function SearchPage({ searchParams }: PageProps<"/app/search">) {
  const { q } = await searchParams;
  const query = typeof q === "string" ? q.trim().slice(0, 120) : "";
  const results = query ? await searchCards(query) : [];

  return (
    <div className={s.page}>
      <main className={s.wrap}>
        <h1 className={s.title}>Search</h1>

        <form action="/app/search" className={s.form} role="search">
          <label htmlFor="q" className="sr-only">
            Describe a problem
          </label>
          <Search size={18} aria-hidden="true" className={s.formIcon} />
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={query}
            placeholder="people who hate commuting"
            className={s.input}
            autoComplete="off"
            enterKeyHint="search"
          />
          <button type="submit" className="pill pill-dark">
            Search
          </button>
        </form>

        {!query && (
          <div className={s.suggest}>
            <p className={s.label}>Try</p>
            <div className={s.chips}>
              {suggestions.map((t) => (
                <Link key={t} href={`/app/search?q=${encodeURIComponent(t)}`} className={s.chip}>
                  {t}
                </Link>
              ))}
            </div>
          </div>
        )}

        {query && results.length > 0 && (
          <>
            <p className={s.count} aria-live="polite">
              {results.length} {results.length === 1 ? "idea" : "ideas"} for “{query}”
            </p>
            <ul className={s.results}>
              {results.map((card) => (
                <li key={card.slug}>
                  <Link href={`/app/idea/${card.slug}`} className={s.result}>
                    <CardTags card={card} />
                    <span className={s.resultTitle}>{card.headline}</span>
                    <span className={s.resultText}>{card.summary}</span>
                    <span className={s.resultMeta}>
                      {card.evidence.posts} mentions on {card.evidence.site} · last {card.evidence.days} days
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}

        {query && results.length === 0 && (
          <div className={s.empty} aria-live="polite">
            <p className={s.emptyTitle}>Nothing on “{query}” yet.</p>
            <p className={s.emptyText}>We only show problems backed by real posts. Pulling fresh posts for any topic arrives in the next update.</p>
            {/* Stage 2: searches Hacker News + the web and builds cards on demand. */}
            <button type="button" className="pill pill-blue" disabled aria-disabled="true">
              <Sparkles size={16} aria-hidden="true" />
              Pull fresh posts
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
