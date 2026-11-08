import "server-only";
import { z } from "zod/v4";
import { generateJson } from "@/lib/llm";
import type { ResearchSource } from "@/lib/research-types";
import { CATEGORIES } from "@/lib/types";
import type { Complaint } from "./extract";
import { fence } from "./extract";
import { CRITIQUE_SYSTEM, GROUP_SYSTEM } from "./prompts";

const GroupSchema = z.object({
  answer: z.string(),
  whyTop: z.string(),
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
        today: z.string(),
        isTop: z.boolean(),
      }),
    )
    .max(8),
});

export type DraftProblem = z.infer<typeof GroupSchema>["problems"][number];

export async function groupComplaints(
  complaints: Complaint[],
  sources: ResearchSource[],
  context: { topic: string; request: string; segment: string; light?: boolean; signal?: AbortSignal },
) {
  const byId = new Map(sources.map((source) => [source.id, source]));
  return generateJson(GroupSchema, {
    system: GROUP_SYSTEM,
    timeoutMs: 45_000,
    light: context.light,
    signal: context.signal,
    prompt: `Topic: ${context.topic}\nThe person asked: ${context.request}\nSegment: ${context.segment}\nCategories: ${CATEGORIES.join(", ")}\n\nVerified complaints:\n${complaints
      .map((complaint) => {
        const source = byId.get(complaint.sourceId)!;
        return `<complaint id="${complaint.id}" source="${complaint.sourceId}" site="${source.site}">${fence(complaint.who)} | pain: ${fence(complaint.pain)} | ${fence(complaint.quote)}</complaint>`;
      })
      .join("\n")}`,
  });
}

const CritiqueSchema = z.object({
  problems: z.array(
    z.object({
      index: z.number().int().min(0).max(99),
      keep: z.boolean(),
      mergeInto: z.number().int().min(-1).max(99),
      headline: z.string(),
      reason: z.string(),
    }),
  ),
});

export async function critique(
  problems: DraftProblem[],
  complaints: Complaint[],
  context: { light?: boolean; signal?: AbortSignal } = {},
): Promise<DraftProblem[]> {
  if (problems.length < 2) return problems;
  const quotes = new Map(complaints.map((complaint) => [complaint.id, complaint.quote]));
  const review = await generateJson(CritiqueSchema, {
    system: CRITIQUE_SYSTEM,
    timeoutMs: 30_000,
    light: context.light,
    signal: context.signal,
    prompt: problems
      .map(
        (problem, i) =>
          `#${i} ${problem.headline}\n${problem.summary}\nQuotes: ${problem.complaintIds
            .slice(0, 5)
            .map((id) => `<quote>${fence(quotes.get(id) ?? "")}</quote>`)
            .join(" ")}`,
      )
      .join("\n\n"),
  });

  const copies = problems.map((problem) => ({ ...problem, complaintIds: [...problem.complaintIds] }));
  const dropped = new Set<number>();
  for (const verdict of review.problems) {
    const problem = copies[verdict.index];
    if (!problem) continue;
    if (verdict.headline.trim()) problem.headline = verdict.headline.trim();
    const target = copies[verdict.mergeInto];
    if (verdict.mergeInto !== verdict.index && target && !dropped.has(verdict.mergeInto)) {
      target.complaintIds.push(...problem.complaintIds);
      dropped.add(verdict.index);
    } else if (!verdict.keep) dropped.add(verdict.index);
  }
  return copies.filter((_, i) => !dropped.has(i));
}
