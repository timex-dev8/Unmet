import { z } from "zod/v4";
import { getAllCards } from "@/lib/cards";
import { generateJson, LlmError, llmConfigured } from "@/lib/llm";
import type { MindConclusion } from "@/lib/mind-types";
import { MIND_SYSTEM } from "@/lib/research/prompts";

export const maxDuration = 60;

const Body = z.object({
  thoughts: z
    .array(z.object({ id: z.string().max(20), text: z.string().max(500) }))
    .min(2)
    .max(120),
  ideas: z
    .array(z.object({ slug: z.string().max(120), headline: z.string().max(200), summary: z.string().max(600) }))
    .max(40)
    .default([]),
});

const Answer = z.object({
  core: z.string().describe("One sentence: the thread these thoughts keep coming back to"),
  themes: z
    .array(z.object({ name: z.string().describe("2-3 word theme name"), thoughtIds: z.array(z.string()) }))
    .max(5),
  checks: z
    .array(
      z.object({
        claim: z.string().describe("A belief or assumption stated in the thoughts, rephrased as a short claim"),
        ideaSlug: z.string().describe("Slug of the evidence-backed idea that is clearly the same problem, or empty"),
      }),
    )
    .max(4),
  tension: z.string().describe("Where the thoughts contradict each other or pull in different directions; empty if none"),
  nextStep: z.string().describe("One concrete, small next step, under 25 words"),
});


// Simple per-visitor limit to protect the free AI tier.
const hits = new Map<string, number[]>();

export async function POST(request: Request) {
  if (!llmConfigured()) return Response.json({ error: "Mind isn't set up yet: the AI key is missing." }, { status: 503 });

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Add at least two thoughts first." }, { status: 400 });

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 3600_000);
  if (recent.length >= 10) return Response.json({ error: "That's 10 updates this hour. Try again a bit later." }, { status: 429 });
  hits.set(ip, [...recent, now]);

  const { thoughts } = parsed.data;
  // The person's own saved/researched ideas plus the feed's ideas: the only evidence a claim may link to.
  const feed = (await getAllCards()).map(({ slug, headline, summary }) => ({ slug, headline, summary }));
  const ideas = [...parsed.data.ideas, ...feed].filter((c, i, all) => all.findIndex((x) => x.slug === c.slug) === i);

  try {
    const out = await generateJson(Answer, {
      system: MIND_SYSTEM,
      timeoutMs: 30_000,
      prompt: `Thoughts:\n${thoughts.map((t) => `[${t.id}] ${t.text}`).join("\n")}\n\nEvidence-backed ideas:\n${ideas
        .map((c) => `${c.slug}: ${c.headline}. ${c.summary}`)
        .join("\n")}`,
    });

    // Keep only ids and slugs that really exist.
    const ids = new Set(thoughts.map((t) => t.id));
    const bySlug = new Map(ideas.map((c) => [c.slug, c]));
    const result: MindConclusion = {
      core: out.core,
      themes: out.themes
        .map((t) => ({ name: t.name, thoughtIds: t.thoughtIds.filter((id) => ids.has(id)) }))
        .filter((t) => t.thoughtIds.length),
      checks: out.checks.map((c) => {
        const idea = bySlug.get(c.ideaSlug);
        return { claim: c.claim, idea: idea ? { slug: idea.slug, headline: idea.headline } : null };
      }),
      tension: out.tension,
      nextStep: out.nextStep,
    };
    return Response.json(result);
  } catch (err) {
    console.error("[mind]", err);
    const message = err instanceof LlmError ? err.message : "Something went wrong. Please try again.";
    return Response.json({ error: message }, { status: 502 });
  }
}
