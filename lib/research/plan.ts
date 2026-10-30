import "server-only";
import { z } from "zod/v4";
import { generateJson } from "@/lib/llm";
import type { ResearchRequest } from "@/lib/research-types";
import { PLAN_SYSTEM } from "./prompts";
import { STACK_SITES, TRUSTMRR_CATEGORIES } from "./sources/sites";

const PlanSchema = z.object({
  mode: z.enum(["search", "gap", "answer"]),
  product: z.string().describe("Only for mode 'gap': the product or product category named; otherwise empty"),
  answer: z.string().describe("Only for mode 'answer'; otherwise empty"),
  topic: z.string(),
  audience: z.string(),
  segment: z.enum(["consumer", "business", "developer"]),
  angles: z
    .array(
      z.object({
        type: z.enum(["pain", "workaround", "wish", "switching", "review"]),
        query: z.string(),
        objective: z.string(),
      }),
    )
    .max(8),
  communityQuery: z.string(),
  hnQuery: z.string(),
  stackQuery: z.string(),
  stackSites: z.array(z.string()).max(3),
  appTerms: z.array(z.string()).max(2),
  githubPhrase: z.string(),
  trustmrrCategory: z.string(),
});

export type Plan = z.infer<typeof PlanSchema>;

// Search operators don't help Exa's plain-language search; strip any the model adds.
const plain = (q: string) =>
  q.replace(/\bsite:\S+/gi, "").replace(/\b(OR|AND)\b/g, " ").replace(/["()]/g, "").replace(/\s+/g, " ").trim();

export async function makePlan(req: ResearchRequest): Promise<Plan> {
  const prompt = [
    req.history.length ? `Conversation so far:\n${req.history.map((t) => `${t.role}: ${t.text}`).join("\n")}` : "",
    req.cards.length ? `Ideas already found:\n${req.cards.map((c, i) => `#${i + 1} ${c.headline}: ${c.summary}`).join("\n")}` : "",
    `Allowed Stack Exchange sites: ${STACK_SITES.join(", ")}`,
    `Allowed TrustMRR categories: ${TRUSTMRR_CATEGORIES.join(", ")}`,
    `New message: ${req.message}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const plan = await generateJson(PlanSchema, { system: PLAN_SYSTEM, prompt, timeoutMs: 20_000 });

  // Keep only allowed values and clean every query.
  return {
    ...plan,
    angles: plan.angles.map((a) => ({ ...a, query: plain(a.query) })).filter((a) => a.query.length > 3),
    communityQuery: plain(plan.communityQuery) || plain(plan.topic),
    hnQuery: plain(plan.hnQuery) || plain(plan.topic),
    stackQuery: plain(plan.stackQuery),
    stackSites: plan.stackSites.filter((s) => (STACK_SITES as readonly string[]).includes(s)),
    appTerms: plan.appTerms.map(plain).filter(Boolean),
    githubPhrase: plain(plan.githubPhrase),
    product: plan.mode === "gap" ? plan.product.trim() : "",
    trustmrrCategory: (TRUSTMRR_CATEGORIES as readonly string[]).includes(plan.trustmrrCategory) ? plan.trustmrrCategory : "",
  };
}
