import { z } from "zod/v4";
import { db, supabaseConfigured } from "@/lib/supabase/server";

// Anyone (guests too) can add a niche they watch to the daily feed research (feed_topics, origin
// "user"). Capped, so watching can't run up search costs: at most MAX_USER_TOPICS user niches.

const Body = z.object({ niche: z.string().trim().min(3).max(60) });
const MAX_USER_TOPICS = 60;

export async function POST(request: Request) {
  if (!supabaseConfigured()) return Response.json({ error: "Not available yet." }, { status: 503 });
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Describe the niche in a few words." }, { status: 400 });
  const niche = parsed.data.niche.toLowerCase().replace(/\s+/g, " ");

  const { count } = await db().from("feed_topics").select("topic", { count: "exact", head: true }).eq("origin", "user");
  if ((count ?? 0) >= MAX_USER_TOPICS) return Response.json({ queued: false, reason: "Unmet's research list is full for now." });

  const { error } = await db().from("feed_topics").upsert({ topic: niche, origin: "user" }, { onConflict: "topic", ignoreDuplicates: true });
  if (error) return Response.json({ error: "Couldn't save that. Try again." }, { status: 500 });
  return Response.json({ queued: true });
}
