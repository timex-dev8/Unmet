# Unmet: SPEC

**Pitch:** Find what people complain about. Build the fix.
**Demo:** Thu Nov 5, 2026. Feature freeze: end of Sun Nov 1.
**Repo:** github.com/timex-dev8/Unmet · **Design:** Claude Design canvas "Idea Feed – Landing Page"

## Decisions
- Niche: **none**. The feed covers everything, with category chips (Dev tools, Productivity, Money, Work, Health, Home) + Trending. Searching for something new will pull fresh posts on demand (Stage 2).
- Build plan: Stage 1 screens with sample data → Stage 2 real data + on-demand pulls (Gemini, Exa, Supabase) → Stage 3 deploy + polish.
- Next 16 has Cache Components on: `/feed`, `/search`, `/idea/[slug]` use `export const instant = false` (render fully on the server).
- Source: Hacker News via the Algolia API. No Reddit (roadmap only, licensed access).
- Stack: Next.js 16 (App Router) + React 19 + TypeScript, **plain CSS** (tokens in `app/globals.css`, CSS Modules per component), lucide-react icons. Motion for swipe (Saturday).
- Data: Supabase. Schema in `supabase/schema.sql`. AI: Gemini behind `lib/llm.ts` (provider and model from env).
- Style: Apple-like hybrid. White and `#f5f5f7`, system font (SF Pro on Apple, Inter fallback), pill buttons, blue gradient hero and closing block as the brand signature. Glass only on the nav.
- Saves in the browser (`localStorage`). No accounts, no payments in the demo. Premium button says "Waitlist opens soon".
- Evidence is always separate from AI suggestions. Quotes under 15 words, always linked.

## Built
- [x] Landing page (desktop + phone), logo and favicon
- [x] Database schema file (not yet run in Supabase)
- [x] Stage 1 (sample data in `data/sample-cards.json`, each tagged "Sample"):
  - `/feed` swipe feed (Motion): swipe up = next, down = back, right = save; keys ↓/↑/S; filter chips; Sources sheet; share; end state
  - `/idea/[slug]` idea page: evidence, sources, "Why these scores" (Data vs AI estimate), AI ideas, Save/Share bar
  - `/saved` saved list in localStorage (`lib/saved.ts`), with remove + empty state; "Saved n" counter in the app bar
  - `/search` keyword search; "Pull fresh posts" shown but disabled until Stage 2
  - Data access only through `lib/cards.ts`, so Stage 2 swaps the source without touching screens

- [x] AI research chat `/research` (needs keys in `.env.local` / Vercel env):
  - `app/api/research/route.ts` streams steps + result (NDJSON), 5 runs/hour per visitor, `RESEARCH_DAILY_CAP` per day, 6h in-memory cache
  - `lib/research.ts`: Gemini plans ≤3 searches → Exa `/search` (highlights, objective, last 12 months, reddit.com excluded unless "Include Reddit") + Hacker News → Gemini groups complaints into cards
  - Server checks every quote word-for-word against the fetched text and computes all counts; problems with <2 verified sources are dropped
  - `lib/llm.ts` (Gemini, model from `LLM_MODEL`, zod-checked JSON), `lib/exa.ts`, `lib/hn.ts`
  - Chat kept in the browser (`lib/research-store.ts`); research ideas open at `/idea/[slug]` from the browser (`components/idea/LocalIdea.tsx`)
- [x] Feed evidence refreshed from the last 60 days of Hacker News: `npm run refresh-evidence`

- [x] Unmet Studio, step 1: one app shell under `/app` (desktop sidebar + top bar with ⌘K → search; phone top bar + bottom tabs Home · Feed · Research · Board). Old URLs redirect (`next.config.ts`).
  - Home `/app`: research composer, interest picker (`lib/interests.ts`), "For you" + "Rising" ranking (`lib/rank.ts`), saved preview, continue research
  - Feed records skipped cards for ranking; Board lists saved ideas (stages next)
  - Design mockups: canvas "Unmet Studio" row (Home, Research, Board, Mind; desktop + phone)

- [x] Research engine v2 (`lib/research/`): Low / Medium / High modes; plan → gather (Exa web + forums/review sites + Reddit, Hacker News, Stack Exchange, App Store reviews, GitHub issues, TrustMRR) → quality filter (no vendor pages/listicles, nothing older than 12 months) → extract first-hand complaints (tolerant quote check) → group (≥3 sources from ≥2 sites in Medium/High) → scores from real signals → High: competitor check + strict review. Reddit is searched through Exa on every level (1 / 2 / 3 queries), never scraped directly. Prompts in `lib/research/prompts.ts`.
- [x] Home: "Startups growing now" from TrustMRR (needs `TRUSTMRR_API_KEY`, hidden without it)

## Not built yet
- [ ] Studio step 2: research threads, desktop side panel, follow-up chips, "Dig deeper" with card context, "Add all to board"
- [ ] Studio step 2b: Mind (thought capture + AI "what it adds up to" with evidence check)
- [ ] Studio step 3: Board stages + notes, ⌘K palette
- [ ] Stage 2: Supabase (save research runs + shareable idea links, cache, feed from research), `/review`, waitlist
- [ ] Stage 3: Vercel deploy, daily GitHub Action, real cards on landing, share images, motion polish, `demo-v1` tag
- [ ] Chat (only if time)

## Run locally
```
npm install
npm run dev
```
