import { runResearch } from "@/lib/research";
import { EXAMPLE_SEARCHES } from "@/lib/research-types";

// UTC only: midnight, 6am, noon, 6pm Toronto in standard time, an hour later in dst
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
        (event) => {
          if (event.type === "result") result[message] = event.cards.length;
          if (event.type === "error") result[message] = event.message;
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
