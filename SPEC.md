# Unmet: SPEC

**Pitch:** Find what people complain about. Build the fix.
**Demo:** Thu Nov 5, 2026. Feature freeze: end of Sun Nov 1.
**Repo:** github.com/timex-dev8/Unmet · **Design:** Claude Design canvas "Idea Feed – Landing Page"

## Decisions
- Niche: **not chosen yet** (leaning app and dev-tool ideas, which fit Hacker News).
- Source: Hacker News via the Algolia API. No Reddit (roadmap only, licensed access).
- Stack: Next.js 16 (App Router) + React 19 + TypeScript, **plain CSS** (tokens in `app/globals.css`, CSS Modules per component), lucide-react icons. Motion for swipe (Saturday).
- Data: Supabase. Schema in `supabase/schema.sql`. AI: Gemini behind `lib/llm.ts` (provider and model from env).
- Style: Apple-like hybrid. White and `#f5f5f7`, system font (SF Pro on Apple, Inter fallback), pill buttons, blue gradient hero and closing block as the brand signature. Glass only on the nav.
- Saves in the browser (`localStorage`). No accounts, no payments in the demo. Premium button says "Waitlist opens soon".
- Evidence is always separate from AI suggestions. Quotes under 15 words, always linked.

## Built
- [x] Landing page (desktop + phone), logo and favicon
- [x] `/feed` placeholder page
- [x] Database schema file (not yet run in Supabase)

## Not built yet
- [ ] Supabase project + keys, Vercel deploy
- [ ] HN ingest → classify → cluster → write cards, `/review` page
- [ ] Swipe feed, `/idea/[slug]`, `/saved`, filters
- [ ] Keyword search, chat, Exa enrichment (if time)

## Run locally
```
npm install
npm run dev
```
