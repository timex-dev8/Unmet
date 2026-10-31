import { z } from "zod/v4";
import { getAllCards } from "@/lib/cards";
import { generateJson, LlmError, llmConfigured } from "@/lib/llm";
import { takeHourlySlot } from "@/lib/rate-limit";
import type { MindBrief } from "@/lib/mind-types";
import { MIND_SYSTEM } from "@/lib/research/prompts";

export const maxDuration = 60;

// Ideas come from earlier AI answers: cut to size rather than refused. The notes are the person's own.
const cut = (n: number) => z.string().transform((s) => s.slice(0, n));

const Body = z.object({
  thoughts: z
    .array(z.object({ id: z.string().max(20), text: z.string().max(2000) }))
    .min(1)
    .max(120),
  ideas: z
    .array(z.object({ slug: cut(120), headline: cut(200), summary: cut(600) }))
    .max(40)
    .default([]),
});

const Answer = z.object({
  idea: z.string().describe("The idea in one sentence: what it is and for whom"),
  forWho: z.string().describe("Who it's for, from the notes; empty if never said"),
  problem: z.string().describe("The problem it solves, as the notes describe or clearly imply it; empty if unclear"),
  buildFirst: z.array(z.string()).max(5).describe("3-5 must-haves for a first version, only features named in the notes"),
  later: z.array(z.string()).max(6).describe("Named features that can wait; empty if none"),
  questions: z.array(z.string()).max(4).describe("2-4 gaps, doubts or contradictions, each as a short question"),
  nextStep: z.string().describe("One concrete step this week to learn whether people want it, under 25 words"),
  matchSlug: z.string().describe("Slug of an idea from the list that is clearly the same problem for the same people, or empty"),
});

export async function POST(request: Request) {
  if (!llmConfigured()) return Response.json({ error: "Shape isn't set up yet: the AI key is missing." }, { status: 503 });

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Write a note about your idea first." }, { status: 400 });

  // Per-visitor limit to protect the free AI tier (lib/rate-limit.ts).
  if (!(await takeHourlySlot(request, "mind", 10)))
    return Response.json({ error: "That's 10 updates this hour. Try again a bit later." }, { status: 429 });

  const { thoughts } = parsed.data;
  // The person's own saved/researched ideas plus the feed's ideas: the only problems the brief may link to.
  const feed = (await getAllCards()).map(({ slug, headline, summary }) => ({ slug, headline, summary }));
  const ideas = [...parsed.data.ideas, ...feed].filter((c, i, all) => all.findIndex((x) => x.slug === c.slug) === i);

  try {
    const out = await generateJson(Answer, {
      system: MIND_SYSTEM,
      timeoutMs: 30_000,
      prompt: `Notes, in the order written:\n${thoughts.map((t) => `- ${t.text}`).join("\n")}\n\nSaved and researched ideas (slug: headline. summary):\n${ideas
        .map((c) => `${c.slug}: ${c.headline}. ${c.summary}`)
        .join("\n")}`,
    });

    // Keep only a slug that really exists.
    const match = ideas.find((c) => c.slug === out.matchSlug);
    const clean = (list: string[]) => list.map((x) => x.trim()).filter(Boolean);
    const result: MindBrief = {
      idea: out.idea,
      forWho: out.forWho,
      problem: out.problem,
      buildFirst: clean(out.buildFirst),
      later: clean(out.later),
      questions: clean(out.questions),
      nextStep: out.nextStep,
      matchSlug: match?.slug ?? "",
      matchHeadline: match?.headline ?? "",
    };
    return Response.json(result);
  } catch (err) {
    console.error("[mind]", err);
    const message = err instanceof LlmError ? err.message : "Something went wrong. Please try again.";
    return Response.json({ error: message }, { status: 502 });
  }
}
