import { z } from "zod/v4";
import { generateJson, LlmError, llmConfigured } from "@/lib/llm";
import { takeHourlySlot } from "@/lib/rate-limit";
import { finishIdeas, IdeasSchema, ideasPrompt } from "@/lib/research/ideas";
import { REMIX_SYSTEM, VALIDATE_SYSTEM } from "@/lib/research/prompts";

// On-demand help for one idea card, AI only (no searches, so no search cost):
// - remix: new ideas for the same problem with a twist ("make it B2B", "cheaper", "AI-first", "more like this")
// - validate: landing page copy, interview questions and an outreach message, in the customers' own words
// The only evidence used is the verified quotes already on the card.

// The card is AI-written: long text is cut to size rather than refused.
const cut = (n: number) => z.string().transform((s) => s.slice(0, n));

const Body = z.object({
  mode: z.enum(["remix", "validate"]),
  twist: z.string().max(80).default("more like this"),
  card: z.object({
    headline: cut(200),
    summary: cut(600),
    who: cut(200),
    quotes: z
      .array(cut(200))
      .min(1)
      .transform((q) => q.slice(0, 12)),
    today: cut(400).optional(),
    workarounds: z
      .array(cut(200))
      .default([])
      .transform((w) => w.slice(0, 5)),
    verdict: z.enum(["strong", "maybe", "weak"]).optional(),
  }),
  idea: z.object({ title: cut(120), pitch: cut(300) }).optional(),
});

const ValidateSchema = z.object({
  headline: z.string(),
  subhead: z.string(),
  bullets: z.array(z.string()).max(3),
  cta: z.string(),
  questions: z.array(z.string()).max(5),
  outreach: z.string(),
});

// Light per-visitor limit; these calls are free-tier Gemini only (lib/rate-limit.ts).
const PER_HOUR = 30;

export async function POST(request: Request) {
  if (!llmConfigured()) return Response.json({ error: "The AI isn't set up yet." }, { status: 503 });
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Something about this idea is missing. Reload and try again." }, { status: 400 });

  if (!(await takeHourlySlot(request, "ideas", PER_HOUR)))
    return Response.json({ error: "That's a lot of ideas for one hour. Try again a bit later." }, { status: 429 });

  const { mode, twist, card, idea } = parsed.data;
  const complaints = [...new Set(card.quotes)].map((quote, i) => ({ id: `q${i + 1}`, quote, pain: quote }));
  const report = card.verdict
    ? {
        verdict: card.verdict,
        reasons: [],
        signals: { pays: 0, switching: 0, price: 0, workaround: 0 },
        today: card.today,
        workarounds: card.workarounds,
      }
    : undefined;
  const base = ideasPrompt({ headline: card.headline, summary: card.summary, who: card.who, report }, complaints);

  try {
    if (mode === "validate") {
      const out = await generateJson(ValidateSchema, {
        system: VALIDATE_SYSTEM,
        timeoutMs: 30_000,
        prompt: `${base}\n\nThe idea to test: ${idea ? `${idea.title}. ${idea.pitch}` : "the most promising product for this problem"}`,
      });
      return Response.json({ validate: out });
    }
    const out = await generateJson(IdeasSchema, {
      system: REMIX_SYSTEM,
      timeoutMs: 30_000,
      prompt: `${base}\n\nTwist the founder asked for: ${twist}${idea ? `\nStarting from this idea: ${idea.title}. ${idea.pitch}` : ""}`,
    });
    // Remixed ideas need only one cited quote: the card carries a few quotes, not every complaint.
    const ideas = finishIdeas(out.ideas, complaints, { report }, 1).map((d) => d.idea);
    return Response.json({ ideas });
  } catch (err) {
    const message = err instanceof LlmError ? err.message : "Couldn't generate that right now. Try again.";
    return Response.json({ error: message }, { status: 502 });
  }
}
