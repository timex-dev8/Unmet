import "server-only";
import { z } from "zod/v4";
import { searchProducts } from "@/lib/exa";
import { generateJson } from "@/lib/llm";
import type { Card, Idea, IdeaLens } from "@/lib/types";
import type { Complaint } from "./extract";
import { fence } from "./extract";
import { IDEAS_BATCH_SYSTEM, IDEAS_SYSTEM } from "./prompts";
import { productName } from "./competitors";
import { kindOf } from "./quality";

// fixed lenses, each idea cites verified complaints, then gets checked against existing products so copies drop

const LENSES = ["automate", "vertical", "unbundle", "service", "wedge", "connector", "shovels"] as const;

const IdeaDraft = z.object({
  // reasoning first so the model gets past the obvious fix
  norm: z.string().describe("One sentence: what most products here do.").default(""),
  flaw: z.string().describe("One sentence: why that fails these people, tied to the complaints.").default(""),
  obvious: z.string().describe("The first fix anyone would suggest. The idea must go beyond it.").default(""),
  shift: z.string().describe("2-3 sentences: the different system and the field it borrows from.").default(""),
  lens: z.enum(LENSES),
  form: z.enum(["product", "feature"]).describe("feature if it only belongs inside an existing product").catch("product"),
  title: z.string().describe('"Name: what it is", under 8 words, e.g. "NoShow Shield: deposits for barbers".'),
  pitch: z.string().describe("One sentence a customer gets, showing what works differently."),
  twists: z
    .array(
      z.object({
        name: z.string().describe("2-4 memorable words"),
        how: z.string().describe('"When X happens, Y happens": a moment no ordinary product has'),
      }),
    )
    .max(4)
    .describe("3 or 4 mechanics, not settings, not the shift restated")
    .default([]),
  whyLove: z.string().describe("2 sentences: the moment they feel the difference, why they switch.").default(""),
  competitorCheck: z
    .string()
    .describe('From the Existing products list only: who does part of this, what is left. Else "Not checked yet".')
    .default(""),
  unproven: z.string().describe("One sentence: the assumption the complaints do not prove.").default(""),
  whoPays: z.string().describe("The specific buyer."),
  price: z.string().describe('Rough monthly price with a reason, e.g. "$15-30/mo, like booking add-ons".'),
  wedge: z.string().describe("One sentence: the first group or moment that makes someone switch."),
  mvp: z.string().describe("Smallest version one developer ships in 1-2 weeks."),
  firstUsers: z.string().describe("Where to find the first 10 users, concretely."),
  risks: z.string().describe("One sentence: the biggest reason it fails."),
  complaintIds: z.array(z.string()).describe("Ids of complaints this answers, at least 2 (1 for a niche signal)"),
  searchQuery: z.string().describe("4-8 words to search for an existing product doing this."),
});
export const IdeasSchema = z.object({
  thoughts: z
    .string()
    .describe(
      '4-6 sentences of founder notes to the reader: what is really going on, what the category missed, what you would try first. Say "I suspect" for guesses.',
    )
    .default(""),
  ideas: z.array(IdeaDraft).max(4),
});
type Draft = z.infer<typeof IdeaDraft>;

export function ideasPrompt(
  card: Pick<Card, "headline" | "summary" | "who" | "report" | "competitors">,
  complaints: { id: string; quote: string; pain: string; signal?: string }[],
) {
  return [
    `Problem: ${card.headline}`,
    card.summary,
    `Who: ${card.who}`,
    card.report?.today ? `What they use today: ${card.report.today}` : "",
    card.report?.workarounds.length ? `Workarounds people describe: ${card.report.workarounds.join("; ")}` : "",
    card.competitors?.length
      ? `Existing products:\n${card.competitors.map((c) => `<competitor>${fence(`${c.name}${c.note ? `: ${c.note}` : ""}`)}</competitor>`).join("\n")}`
      : "",
    `\nVerified complaints:\n${complaints
      .slice(0, 12)
      .map((c) => `<complaint id="${c.id}"${c.signal ? ` signal="${c.signal}"` : ""}>${fence(c.pain)} | ${fence(c.quote.slice(0, 220))}</complaint>`)
      .join("\n")}`,
  ]
    .filter(Boolean)
    .join("\n");
}

type Drafted = { idea: Idea; query: string };

export function finishIdeas(
  drafts: Draft[],
  complaints: { id: string; quote: string; signal?: string }[],
  card: Pick<Card, "report">,
  minCited = 2,
): Drafted[] {
  const byId = new Map(complaints.map((c) => [c.id, c]));
  const verdictBonus = card.report?.verdict === "strong" ? 20 : card.report?.verdict === "maybe" ? 10 : 0;
  const out: Drafted[] = [];
  for (const d of drafts) {
    const cited = [...new Set(d.complaintIds)].map((id) => byId.get(id)).filter((c): c is NonNullable<typeof c> => Boolean(c));
    if (cited.length < minCited) continue;
    const money = cited.filter((c) => c.signal === "pays" || c.signal === "switching" || c.signal === "price").length;
    out.push({
      idea: {
        lens: d.lens as IdeaLens,
        title: d.title,
        pitch: d.pitch,
        form: d.form,
        norm: d.norm,
        flaw: d.flaw,
        shift: d.shift,
        twists: d.twists,
        whyLove: d.whyLove,
        competitorCheck: d.competitorCheck,
        unproven: d.unproven,
        whoPays: d.whoPays,
        price: d.price,
        wedge: d.wedge,
        mvp: d.mvp,
        firstUsers: d.firstUsers,
        risks: d.risks,
        evidence: cited.slice(0, 3).map((c) => c.quote),
        score: Math.min(95, 30 + verdictBonus + cited.length * 6 + money * 8),
      },
      query: d.searchQuery,
    });
  }
  return out.sort((a, b) => b.idea.score - a.idea.score);
}

const isProductPage = (url: string) => {
  try {
    return new URL(url).pathname.split("/").filter(Boolean).length <= 1;
  } catch {
    return false;
  }
};

// closest existing product page for an idea, lowers the score a little
async function checkBuilt({ idea, query }: Drafted, signal?: AbortSignal) {
  const since = new Date(Date.now() - 3 * 365 * 86400_000).toISOString();
  const pages = await searchProducts(query || idea.pitch, since, signal).catch(() => []);
  const hit = pages.find((p) => kindOf(p.site, p.url) === "blog" && isProductPage(p.url));
  if (!hit) return;
  idea.similar = { name: productName(hit.title, hit.site), url: hit.url, note: hit.text.slice(0, 120) || undefined };
  idea.score = Math.max(10, idea.score - 10);
}

export async function generateIdeas(
  card: Card,
  complaints: Complaint[],
  check: boolean,
  product = "",
  best = false,
  signal?: AbortSignal,
): Promise<Idea[]> {
  // gap mode: aim ideas at winning the product's unhappy users
  const focus = product
    ? `\n\nThese complaints are from users of ${product}. Prefer ideas that win them over: a wedge, an unbundled part done better, or a version made for a group ${product} serves badly. Name ${product} in the wedge.`
    : "";
  const out = await generateJson(IdeasSchema, {
    system: IDEAS_SYSTEM,
    light: !best, // better model is worth it for creative work but its quota is small
    signal,
    timeoutMs: 60_000,
    temperature: 0.8,
    prompt: ideasPrompt(card, complaints) + focus,
  });
  if (out.thoughts) card.thoughts = out.thoughts;
  // prefer two-complaint ideas, a thin card still gets its best single one
  const backed = finishIdeas(out.ideas, complaints, card);
  const drafted = (backed.length ? backed : finishIdeas(out.ideas, complaints, card, 1)).slice(0, 3);
  if (check) await Promise.all(drafted.map((d) => checkBuilt(d, signal)));
  return drafted.map((d) => d.idea).sort((a, b) => b.score - a.score);
}

const BatchSchema = z.object({ ideas: z.array(IdeaDraft.extend({ problem: z.string() })) });

// one ai call for the remaining cards so a search doesn't burn the free rate limit
export async function generateOneIdeaEach(cards: Card[], complaintsOf: (card: Card) => Complaint[], signal?: AbortSignal) {
  if (!cards.length) return;
  const out = await generateJson(BatchSchema, {
    schemaNotes: false,
    system: IDEAS_BATCH_SYSTEM,
    light: true,
    signal,
    timeoutMs: 60_000,
    temperature: 0.8,
    prompt: cards.map((card, i) => `## Problem P${i + 1}\n${ideasPrompt(card, complaintsOf(card))}`).join("\n\n"),
  });
  cards.forEach((card, i) => {
    // checked against this card's own complaints so an idea can't land on the wrong problem
    const drafts = out.ideas.filter((d) => d.problem === `P${i + 1}`);
    const best = finishIdeas(drafts, complaintsOf(card), card, 1)[0];
    if (best) card.ideas = [best.idea];
  });
}
