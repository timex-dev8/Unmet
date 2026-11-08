# Unmet

Find what people actually complain about, then build the fix.

**Live:** [unmet-ten.vercel.app](https://unmet-ten.vercel.app)

Most startup idea lists are made up. Unmet starts from real posts and reviews, groups the complaints into problems, and shows the quotes and links behind each one, so you can check the proof yourself.

## What it does

- **Feed:** swipe through problems and products that are working right now. Updates a few times a day.
- **Research:** ask about any market. It searches public sources, keeps first-hand complaints and checks every quote against the original page.
- **Ideas:** each problem gets product ideas with who pays, a price, a first version and the biggest risk.
- **Board:** save ideas and move them along as you test them.
- **Shape:** dump rough notes about your own idea and get a clear brief back.

If there isn't enough proof, it says so and labels its guesses as guesses.

## Built with

Next.js 16, TypeScript, CSS Modules, Motion, Supabase, Gemini, Exa, Vercel.

## Run it

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000. Without keys the feed shows sample cards. To use accounts and the live feed, add your keys to `.env.local` and run `supabase/schema.sql` in your Supabase project.

## How research works

1. Plan the searches from the question
2. Search forums, reviews and communities
3. Drop old, thin and vendor pages
4. Pull out first-hand complaints and verify each quote
5. Group them into problems and score the evidence
6. Generate ideas from those complaints only

Code for this is in `lib/research`.
