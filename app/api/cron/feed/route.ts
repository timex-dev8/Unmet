import { revalidateTag } from "next/cache";
import { runFeed } from "@/lib/feed";

// The daily feed job. Vercel Cron calls this twice a day (vercel.json); each run researches about
// half of FEED_DAILY_TOPICS niches. Vercel sends "Authorization: Bearer $CRON_SECRET".
export const maxDuration = 300;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Not allowed" }, { status: 401 });
  }
  const perDay = Math.max(0, Number(process.env.FEED_DAILY_TOPICS ?? 10));
  const max = Math.ceil(perDay / 2);
  if (!max) return Response.json({ skipped: "FEED_DAILY_TOPICS is 0" });

  const started = Date.now();
  try {
    // Stop starting new niches after 4 minutes, so the run ends inside Vercel's 5-minute limit.
    const report = await runFeed({ max, deadline: started + 240_000 });
    const added = report.reduce((n, r) => n + r.added, 0);
    if (added) revalidateTag("feed", "max"); // show the new cards on the next visit
    console.log(`[feed] ${report.length} niches, ${added} cards added or merged in ${Math.round((Date.now() - started) / 1000)}s`);
    return Response.json({ added, report });
  } catch (err) {
    console.error("[feed]", err);
    return Response.json({ error: err instanceof Error ? err.message : "Feed run failed" }, { status: 500 });
  }
}
