import "server-only";
import { z } from "zod/v4";
import { generateJson } from "@/lib/llm";
import type { ResearchSource } from "@/lib/research-types";
import { CATEGORIES } from "@/lib/types";
import type { Complaint } from "./extract";
import { CRITIQUE_SYSTEM, GROUP_SYSTEM } from "./prompts";

const GroupSchema = z.object({
  answer: z.string(),
  notFound: z.string(),
  problems: z
    .array(
      z.object({
        headline: z.string(),
        summary: z.string(),
        who: z.string(),
        category: z.enum(CATEGORIES),
        complaintIds: z.array(z.string()),
        quoteId: z.string().describe("The complaint id whose quote shows this problem most clearly"),
        competition: z.object({ value: z.number().min(0).max(100), reason: z.string() }),
        difficulty: z.object({ value: z.number().min(0).max(100), reason: z.string() }),
        ideas: z.array(z.object({ title: z.string(), text: z.string() })).max(3),
      }),
    )
    .max(6),
});

export type DraftProblem = z.infer<typeof GroupSchema>["problems"][number];
export type Grouped = z.infer<typeof GroupSchema>;

export async function groupComplaints(complaints: Complaint[], sources: ResearchSource[], ctx: { topic: string; request: string }) {
  const byId = new Map(sources.map((s) => [s.id, s]));
  return generateJson(GroupSchema, {
    system: GROUP_SYSTEM,
    timeoutMs: 45_000,
    prompt: `Topic: ${ctx.topic}\nThe person asked: ${ctx.request}\nCategories: ${CATEGORIES.join(", ")}\n\nVerified complaints:\n${complaints
      .map((c) => {
        const s = byId.get(c.sourceId)!;
        return `${c.id} | source ${c.sourceId} (${s.site}) | ${c.who} | pain: ${c.pain} | “${c.quote}”`;
      })
      .join("\n")}`,
  });
}

const CritiqueSchema = z.object({
  problems: z.array(
    z.object({ index: z.number().int(), keep: z.boolean(), mergeInto: z.number().int(), headline: z.string(), reason: z.string() }),
  ),
});

/** High mode: a second, strict pass that drops generic problems, merges duplicates and sharpens headlines. */
export async function critique(problems: DraftProblem[], complaints: Complaint[]): Promise<DraftProblem[]> {
  if (problems.length < 2) return problems;
  const quotes = new Map(complaints.map((c) => [c.id, c.quote]));
  const review = await generateJson(CritiqueSchema, {
    system: CRITIQUE_SYSTEM,
    timeoutMs: 30_000,
    prompt: problems
      .map((p, i) => `#${i} ${p.headline}\n${p.summary}\nQuotes: ${p.complaintIds.slice(0, 5).map((id) => `“${quotes.get(id) ?? ""}”`).join(" ")}`)
      .join("\n\n"),
  });

  const out = problems.map((p) => ({ ...p, complaintIds: [...p.complaintIds] }));
  const dropped = new Set<number>();
  for (const r of review.problems) {
    const p = out[r.index];
    if (!p) continue;
    if (r.headline.trim()) p.headline = r.headline.trim();
    const target = out[r.mergeInto];
    if (r.mergeInto !== r.index && target && !dropped.has(r.mergeInto)) {
      target.complaintIds.push(...p.complaintIds);
      dropped.add(r.index);
    } else if (!r.keep) dropped.add(r.index);
  }
  return out.filter((_, i) => !dropped.has(i));
}
