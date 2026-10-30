import { z } from "zod/v4";
import { generateJson, LlmError, llmConfigured } from "@/lib/llm";
import { finishIdeas, IdeasSchema, ideasPrompt } from "@/lib/research/ideas";
import { REMIX_SYSTEM, VALIDATE_SYSTEM } from "@/lib/research/prompts";

// On-demand help for one idea card, AI only (no searches, so no search cost):
// - remix: new ideas for the same problem with a twist ("make it B2B", "cheaper", "AI-first", "more like this")
// - validate: landing page copy, interview questions and an outreach message, in the customers' own words
// The only evidence used is the verified quotes already on the card.

const Body = z.object({
  mode: z.enum(["remix", "validate"]),
  twist: z.string().max(80).default("more like this"),
  card: z.object({
    headline: z.string().max(200),
    summary: z.string().max(600),
    who: z.string().max(200),
    quotes: z.array(z.string().max(200)).min(1).max(12),
    today: z.string().max(400).optional(),
    workarounds: z.array(z.string().max(200)).max(5).default([]),
    verdict: z.enum(["strong", "maybe", "weak"]).optional(),
  }),
  idea: z.object({ title: z.string().max(120), pitch: z.string().max(300) }).optional(),
});

const ValidateSchema = z.object({
  headline: z.string(),
  subhead: z.string(),
  bullets: z.array(z.string()).max(3),
  cta: z.string(),
  questions: z.array(z.string()).max(5),
  outreach: z.string(),
});

// Light per-visitor limit; these calls are free-tier Gemini only.
const PER_HOUR = 30;
const hits = new Map<string, number[]>();

export async function POST(request: Request) {
  if (!llmConfigured()) return Response.json({ error: "The AI isn't set up yet." }, { status: 503 });
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Something about this idea is missing. Reload and try again." }, { status: 400 });

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 3600_000);
  if (recent.length >= PER_HOUR) return Response.json({ error: "That's a lot of ideas for one hour. Try again a bit later." }, { status: 429 });
  hits.set(ip, [...recent, now]);

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
