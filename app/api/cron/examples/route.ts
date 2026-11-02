import { runResearch } from "@/lib/research";
import { EXAMPLE_SEARCHES } from "@/lib/research-types";

// Runs the example searches once a day (vercel.json), one at a time, so a first-time visitor's tap opens instantly.
// Vercel sends "Authorization: Bearer $CRON_SECRET".
export const maxDuration = 300;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Not allowed" }, { status: 401 });
  }
  const result: Record<string, number | string> = {};
  for (const message of EXAMPLE_SEARCHES) {
    try {
      await runResearch(
        { message, history: [], cards: [], depth: "low" },
        (e) => {
          if (e.type === "result") result[message] = e.cards.length;
          if (e.type === "error") result[message] = e.message;
        },
        undefined,
        true,
      );
    } catch (err) {
      result[message] = err instanceof Error ? err.message : "Failed";
      console.error("[examples]", message, err);
    }
  }
  return Response.json(result);
}
