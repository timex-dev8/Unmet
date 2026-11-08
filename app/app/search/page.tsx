import type { Metadata } from "next";
import Link from "next/link";
import { Search, Sparkles } from "lucide-react";
import { CardTags } from "@/components/card/parts";
import { searchCards } from "@/lib/cards";
import { ideaHref, searchHref } from "@/lib/links";
import styles from "./search.module.css";

export const metadata: Metadata = { title: "Search" };

// must stay dynamic, reads the url
export const instant = false;

const suggestions = ["invoices", "tests", "receipts", "tabs", "meetings"];

export default async function SearchPage({ searchParams }: PageProps<"/app/search">) {
  const { q: queryParam } = await searchParams;
  const query = typeof queryParam === "string" ? queryParam.trim().slice(0, 120) : "";
  const results = query ? await searchCards(query) : [];

  return (
    <div className={styles.page}>
      <main className={styles.wrap}>
        <h1 className={styles.title}>Search</h1>

        <form action="/app/search" className={styles.form} role="search">
          <label htmlFor="q" className="sr-only">
            Describe a problem
          </label>
          <Search size={18} aria-hidden="true" className={styles.formIcon} />
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={query}
            placeholder="people who hate commuting"
            className={styles.input}
            autoComplete="off"
            enterKeyHint="search"
          />
          <button type="submit" className="pill pill-dark">
            Search
          </button>
        </form>

        {!query && (
          <div className={styles.suggest}>
            <p className={styles.label}>Try</p>
            <div className={styles.chips}>
              {suggestions.map((suggestion) => (
                <Link key={suggestion} href={searchHref(suggestion)} className={styles.chip}>
                  {suggestion}
                </Link>
              ))}
            </div>
          </div>
        )}

        {query && results.length > 0 && (
          <>
            <p className={styles.count} aria-live="polite">
              {results.length} {results.length === 1 ? "idea" : "ideas"} for “{query}”
            </p>
            <ul className={styles.results}>
              {results.map((card) => (
                <li key={card.slug}>
                  <Link href={ideaHref(card.slug)} className={styles.result}>
                    <CardTags card={card} />
                    <span className={styles.resultTitle}>{card.headline}</span>
                    <span className={styles.resultText}>{card.summary}</span>
                    <span className={styles.resultMeta}>
                      {card.evidence.posts} mentions on {card.evidence.site} · last {card.evidence.days} days
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}

        {query && results.length === 0 && (
          <div className={styles.empty} aria-live="polite">
            <p className={styles.emptyTitle}>Nothing on “{query}” yet.</p>
            <p className={styles.emptyText}>
              We only show problems backed by real posts. Pulling fresh posts for any topic arrives in the next update.
            </p>
            <button type="button" className="pill glossy" disabled aria-disabled="true">
              <Sparkles size={16} aria-hidden="true" />
              Pull fresh posts
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
