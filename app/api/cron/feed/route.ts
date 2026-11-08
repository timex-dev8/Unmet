import { revalidateTag } from "next/cache";
import { runFeed } from "@/lib/feed";
import { runProducts } from "@/lib/products";

// ~a third of FEED_DAILY_TOPICS per run, evening run refreshes products first (or ?products=1)
export const maxDuration = 300;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Not allowed" }, { status: 401 });
  }
  const params = new URL(request.url).searchParams;
  const started = Date.now();
  const result: Record<string, unknown> = {};
  let changed = false;
  // leaves time to save and answer before vercels limit
  const feedSignal = AbortSignal.timeout(270_000);

  try {
    if (params.get("slot") === "evening" || params.get("products") === "1") {
      try {
        // no new batch after 2 min so niches still get a turn
        const products = await runProducts({ deadline: started + 120_000, signal: AbortSignal.timeout(140_000) });
        result.products = products;
        changed ||= products.added + products.refreshed > 0;
        console.log(`[products] ${products.added} added, ${products.refreshed} refreshed`, products.counts);
      } catch (err) {
        console.error("[products]", err);
        result.products = { error: err instanceof Error ? err.message : "Product run failed" };
      }
    }

    const perDay = Math.max(0, Number(process.env.FEED_DAILY_TOPICS ?? 10));
    const max = Math.ceil(perDay / 3);
    if (max && params.get("products") !== "1") {
      try {
        // no new niche after 150s, medium can take minutes and must end inside the 5 min limit
        const report = await runFeed({ max, deadline: started + 150_000, signal: feedSignal });
        const added = report.reduce((n, r) => n + r.added, 0);
        changed ||= added > 0;
        result.added = added;
        result.report = report;
        console.log(`[feed] ${report.length} niches, ${added} cards added or merged in ${Math.round((Date.now() - started) / 1000)}s`);
      } catch (err) {
        console.error("[feed]", err);
        return Response.json({ ...result, error: err instanceof Error ? err.message : "Feed run failed" }, { status: 500 });
      }
    }
    return Response.json(result);
  } finally {
    if (changed) revalidateTag("feed", "max"); // new cards on next visit, even after a failure
  }
}
