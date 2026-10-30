import "server-only";
import { z } from "zod/v4";
import { generateJson } from "@/lib/llm";
import type { ResearchSource } from "@/lib/research-types";
import type { Signal } from "@/lib/types";
import { EXTRACT_SYSTEM } from "./prompts";
import { quoteFound } from "./verify";

// Reads sources in parallel batches and keeps only first-hand, on-topic complaints whose
// quotes are really in the text.

const ExtractSchema = z.object({
  sources: z.array(
    z.object({
      id: z.number().int(),
      firstHand: z.boolean(),
      relevance: z.number().int().min(0).max(3),
      who: z.string(),
      complaints: z
        .array(
          z.object({
            quote: z.string(),
            pain: z.string(),
            signal: z.enum(["none", "pays", "switching", "price", "workaround"]),
          }),
        )
        .max(3),
      reject: z.string(),
    }),
  ),
});

export type Complaint = { id: string; sourceId: number; quote: string; pain: string; who: string; signal?: Signal };
export type ExtractReport = { complaints: Complaint[]; offTopic: number; secondHand: number; unverified: number };

/** Runs async jobs with at most `limit` in flight (keeps the free AI tier from rate-limiting us). */
async function pool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        try {
          results[i] = { status: "fulfilled", value: await fn(items[i]) };
        } catch (reason) {
          results[i] = { status: "rejected", reason };
        }
      }
    }),
  );
  return results;
}

export async function extractComplaints(
  sources: ResearchSource[],
  opts: { topic: string; audience: string; batchSize: number; onBatch?: (done: number, total: number) => void },
): Promise<ExtractReport> {
  const byId = new Map(sources.map((s) => [s.id, s]));
  const batches: ResearchSource[][] = [];
  for (let i = 0; i < sources.length; i += opts.batchSize) batches.push(sources.slice(i, i + opts.batchSize));

  let done = 0;
  const results = await pool(batches, 3, async (batch) => {
    const out = await generateJson(ExtractSchema, {
      system: EXTRACT_SYSTEM,
      timeoutMs: 40_000,
      prompt: `Topic: ${opts.topic}\nAudience: ${opts.audience}\n\nSources:\n${batch
        .map((s) => `[${s.id}] ${s.title} (${s.site}${s.postedAt ? `, ${s.postedAt.slice(0, 10)}` : ""})\n${s.text.slice(0, 1800)}`)
        .join("\n\n")}`,
    });
    opts.onBatch?.(++done, batches.length);
    return out.sources;
  });

  if (results.every((r) => r.status === "rejected")) {
    const first = results[0] as PromiseRejectedResult | undefined;
    throw first?.reason ?? new Error("Couldn't read the sources.");
  }

  const report: ExtractReport = { complaints: [], offTopic: 0, secondHand: 0, unverified: 0 };
  let n = 0;
  for (const r of results) {
    if (r.status !== "fulfilled") continue;
    for (const s of r.value) {
      const src = byId.get(s.id);
      if (!src) continue;
      if (s.relevance < 2) {
        report.offTopic++;
        continue;
      }
      if (!s.firstHand) {
        report.secondHand++;
        continue;
      }
      for (const c of s.complaints) {
        if (quoteFound(c.quote, src.text))
          report.complaints.push({
            id: `c${++n}`,
            sourceId: s.id,
            quote: c.quote.trim(),
            pain: c.pain,
            who: s.who,
            signal: c.signal === "none" ? undefined : c.signal,
          });
        else report.unverified++;
      }
    }
  }
  return report;
}
