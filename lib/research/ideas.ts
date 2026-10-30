import "server-only";
import { z } from "zod/v4";
import { searchProducts } from "@/lib/exa";
import { generateJson } from "@/lib/llm";
import type { Card, Idea, IdeaLens } from "@/lib/types";
import type { Complaint } from "./extract";
import { IDEAS_SYSTEM } from "./prompts";
import { kindOf } from "./quality";

// The idea engine: turns a validated problem into product ideas through fixed lenses
// (automate the workaround, vertical version, unbundle, service as software, cheaper wedge,
// connector, picks and shovels). Every idea must cite verified complaints; then each is checked
// against existing products so copies drop and real gaps are labeled.

const LENSES = ["automate", "vertical", "unbundle", "service", "wedge", "connector", "shovels"] as const;

export const IdeaDraft = z.object({
  lens: z.enum(LENSES),
  title: z.string(),
  pitch: z.string(),
  whoPays: z.string(),
  price: z.string(),
  wedge: z.string(),
  mvp: z.string(),
  firstUsers: z.string(),
  risks: z.string(),
  complaintIds: z.array(z.string()),
  searchQuery: z.string(),
});
export const IdeasSchema = z.object({ ideas: z.array(IdeaDraft).max(4) });
type Draft = z.infer<typeof IdeaDraft>;

export function ideasPrompt(
  card: Pick<Card, "headline" | "summary" | "who" | "report">,
  complaints: { id: string; quote: string; pain: string; signal?: string }[],
) {
  return [
    `Problem: ${card.headline}`,
    card.summary,
    `Who: ${card.who}`,
    card.report?.today ? `What they use today: ${card.report.today}` : "",
    card.report?.workarounds.length ? `Workarounds people describe: ${card.report.workarounds.join("; ")}` : "",
    `\nVerified complaints:\n${complaints.map((c) => `${c.id} | ${c.signal ? `[${c.signal}] ` : ""}${c.pain} | “${c.quote}”`).join("\n")}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export type Drafted = { idea: Idea; query: string };

/** Turns drafts into ideas: keeps only those citing at least `minCited` real complaints, attaches their quotes, scores them. */
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

/** "Is it already built?": the closest existing product page for an idea, if any. Lowers the score a little. */
export async function checkBuilt({ idea, query }: Drafted) {
  const since = new Date(Date.now() - 3 * 365 * 86400_000).toISOString();
  const pages = await searchProducts(query || idea.pitch, since).catch(() => []);
  const hit = pages.find((p) => kindOf(p.site, p.url) === "blog" && isProductPage(p.url));
  if (!hit) return;
  idea.similar = { name: hit.title.split(/\s[|–—-]\s|:\s/)[0].slice(0, 40) || hit.site, url: hit.url, note: hit.text.slice(0, 120) || undefined };
  idea.score = Math.max(10, idea.score - 10);
}

/** Ideas for one card. `check` runs the existing-product search (one Exa search per idea). */
export async function generateIdeas(card: Card, complaints: Complaint[], check: boolean, product = ""): Promise<Idea[]> {
  // Gap mode: the complaints are about one product, so aim the ideas at winning its unhappy users.
  const focus = product
    ? `\n\nThese complaints are from users of ${product}. Prefer ideas that win them over: a wedge, an unbundled part done better, or a version made for a group ${product} serves badly. Name ${product} in the wedge.`
    : "";
  const out = await generateJson(IdeasSchema, { system: IDEAS_SYSTEM, timeoutMs: 40_000, prompt: ideasPrompt(card, complaints) + focus });
  const drafted = finishIdeas(out.ideas, complaints, card).slice(0, 3);
  if (check) await Promise.all(drafted.map(checkBuilt));
  return drafted.map((d) => d.idea).sort((a, b) => b.score - a.score);
}
