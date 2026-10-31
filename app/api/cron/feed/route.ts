import { revalidateTag } from "next/cache";
import { runFeed } from "@/lib/feed";
import { runProducts } from "@/lib/products";

// The daily feed job. Vercel Cron calls this three times a day: morning, midday and evening
// (vercel.json); each run researches about a third of FEED_DAILY_TOPICS niches. The evening run first refreshes "what's working" products
// (or any run with ?products=1). Vercel sends "Authorization: Bearer $CRON_SECRET".
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

  if (params.get("slot") === "evening" || params.get("products") === "1") {
    try {
      const products = await runProducts();
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
      // Stop starting new niches after 4 minutes, so the run ends inside Vercel's 5-minute limit.
      const report = await runFeed({ max, deadline: started + 240_000 });
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

  if (changed) revalidateTag("feed", "max"); // show the new cards on the next visit
  return Response.json(result);
}
