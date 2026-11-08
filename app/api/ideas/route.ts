import { z } from "zod/v4";
import { generateJson, LlmError, llmConfigured } from "@/lib/llm";
import { takeDailyPool, takeHourlySlot } from "@/lib/rate-limit";
import { finishIdeas, IdeasSchema, ideasPrompt } from "@/lib/research/ideas";
import { REMIX_SYSTEM, VALIDATE_SYSTEM } from "@/lib/research/prompts";

// remix and validate for one card, ai only. evidence is just the cards verified quotes

// ai written text is cut, not refused
const cut = (maxLength: number) => z.string().transform((text) => text.slice(0, maxLength));

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
      .transform((quotes) => quotes.slice(0, 12)),
    today: cut(400).optional(),
    workarounds: z
      .array(cut(200))
      .default([])
      .transform((workarounds) => workarounds.slice(0, 5)),
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

const PER_HOUR = 30;
const DAILY_POOL = Number(process.env.IDEAS_DAILY_CAP ?? 300);

export async function POST(request: Request) {
  if (!llmConfigured()) return Response.json({ error: "The AI isn't set up yet." }, { status: 503 });
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Something about this idea is missing. Reload and try again." }, { status: 400 });

  if (!(await takeHourlySlot(request, "ideas", PER_HOUR)))
    return Response.json({ error: "That's a lot of ideas for one hour. Try again a bit later." }, { status: 429 });
  if (!(await takeDailyPool("ideas", DAILY_POOL)))
    return Response.json({ error: "Idea help is very busy today. Please try again tomorrow." }, { status: 429 });

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
      const validation = await generateJson(ValidateSchema, {
        system: VALIDATE_SYSTEM,
        timeoutMs: 30_000,
        prompt: `${base}\n\nThe idea to test: ${idea ? `${idea.title}. ${idea.pitch}` : "the most promising product for this problem"}`,
      });
      return Response.json({ validate: validation });
    }
    const remixed = await generateJson(IdeasSchema, {
      system: REMIX_SYSTEM,
      timeoutMs: 60_000,
      temperature: 0.8,
      prompt: `${base}\n\nTwist the founder asked for: ${twist}${idea ? `\nStarting from this idea: ${idea.title}. ${idea.pitch}` : ""}`,
    });
    // remixes need only one cited quote
    const ideas = finishIdeas(remixed.ideas, complaints, { report }, 1).map((draft) => draft.idea);
    return Response.json({ ideas });
  } catch (err) {
    const message = err instanceof LlmError ? err.message : "Couldn't generate that right now. Try again.";
    return Response.json({ error: message }, { status: 502 });
  }
}
