import "server-only";
import { z } from "zod/v4";
import { generateJson } from "@/lib/llm";
import type { ResearchSource } from "@/lib/research-types";
import type { Signal } from "@/lib/types";
import { EXTRACT_SYSTEM } from "./prompts";
import { findQuote } from "./verify";

const ExtractSchema = z.object({
  sources: z.array(
    z.object({
      id: z.number().int().min(0).max(9999),
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
type ExtractReport = { complaints: Complaint[]; offTopic: number; secondHand: number; unverified: number; failedBatches: number };

async function pool<T, R>(items: T[], limit: number, work: (item: T) => Promise<R>): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        try {
          results[i] = { status: "fulfilled", value: await work(items[i]) };
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
  options: { topic: string; audience: string; batchSize: number; onBatch?: (done: number, total: number) => void; signal?: AbortSignal },
): Promise<ExtractReport> {
  const byId = new Map(sources.map((source) => [source.id, source]));
  const batches: ResearchSource[][] = [];
  for (let i = 0; i < sources.length; i += options.batchSize) batches.push(sources.slice(i, i + options.batchSize));

  let done = 0;
  const results = await pool(batches, 3, async (batch) => {
    options.signal?.throwIfAborted(); // visitor left, don't start more batches
    const response = await generateJson(ExtractSchema, {
      system: EXTRACT_SYSTEM,
      light: true,
      timeoutMs: 40_000,
      signal: options.signal,
      prompt: `Topic: ${options.topic}\nAudience: ${options.audience}\n\nSources:\n${batch
        .map(
          (source) =>
            `<source id="${source.id}" site="${source.site}"${source.postedAt ? ` date="${source.postedAt.slice(0, 10)}"` : ""}>\n${fence(source.title)}\n${fence(source.text.slice(0, 1800))}\n</source>`,
        )
        .join("\n\n")}`,
    });
    options.onBatch?.(++done, batches.length);
    return response.sources;
  });

  options.signal?.throwIfAborted();
  if (results.every((result) => result.status === "rejected")) {
    const first = results[0] as PromiseRejectedResult | undefined;
    throw first?.reason ?? new Error("Couldn't read the sources.");
  }

  const report: ExtractReport = { complaints: [], offTopic: 0, secondHand: 0, unverified: 0, failedBatches: 0 };
  let complaintCount = 0;
  for (const result of results) {
    if (result.status !== "fulfilled") {
      report.failedBatches++;
      continue;
    }
    for (const extractedSource of result.value) {
      const source = byId.get(extractedSource.id);
      if (!source) continue;
      if (extractedSource.relevance < 2) {
        report.offTopic++;
        continue;
      }
      if (!extractedSource.firstHand) {
        report.secondHand++;
        continue;
      }
      for (const complaint of extractedSource.complaints) {
        const quote = findQuote(complaint.quote, source.text);
        if (quote)
          report.complaints.push({
            id: `c${++complaintCount}`,
            sourceId: extractedSource.id,
            quote,
            pain: complaint.pain,
            who: extractedSource.who,
            signal: complaint.signal === "none" ? undefined : complaint.signal,
          });
        else report.unverified++;
      }
    }
  }
  return report;
}

export const fence = (text: string) => text.replace(/<\/?\s*(source|complaint|quote|product|competitor|card|message)\b/gi, "‹");
