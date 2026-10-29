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

## Not built yet
- [ ] Stage 2: Supabase project + keys, HN + Exa ingest → Gemini classify/group/write, `/review`, on-demand pull, waitlist
- [ ] Stage 3: Vercel deploy, daily GitHub Action, real cards on landing, share images, motion polish, `demo-v1` tag
- [ ] Chat (only if time)

## Run locally
```
npm install
npm run dev
```
