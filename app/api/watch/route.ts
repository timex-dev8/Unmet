import { z } from "zod/v4";
import { db, requestUser, supabaseConfigured } from "@/lib/supabase/server";

// capped per user and overall so watching cant run up search costs
// without the owner column (supabase/schema.sql) only the overall cap applies

const Body = z.object({ niche: z.string().trim().min(3).max(60) });
const MAX_PER_USER = 10;
const MAX_USER_TOPICS = 60;

const nicheOf = (s: string) => s.toLowerCase().replace(/\s+/g, " ");
const missingColumn = (e: { code?: string; message?: string }) =>
  e.code === "PGRST204" || e.code === "42703" || /column .*owner/i.test(e.message ?? "");
const count = (q: PromiseLike<{ count: number | null; error: unknown }>) => Promise.resolve(q).then((r) => (r.error ? Infinity : (r.count ?? 0)));

async function guard(request: Request) {
  if (!supabaseConfigured()) return { error: Response.json({ error: "Not available yet." }, { status: 503 }) };
  const user = await requestUser(request);
  if (!user) return { error: Response.json({ error: "Sign in to have Unmet research the niches you watch." }, { status: 401 }) };
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return { error: Response.json({ error: "Describe the niche in a few words." }, { status: 400 }) };
  return { user, niche: nicheOf(parsed.data.niche) };
}

export async function POST(request: Request) {
  const g = await guard(request);
  if (g.error) return g.error;
  const { user, niche } = g;

  // insert then count so parallel requests cant slip under the cap
  const add = (row: Record<string, string>) => db().from("feed_topics").upsert(row, { onConflict: "topic", ignoreDuplicates: true }).select("topic");
  let owned = true;
  let { data, error } = await add({ topic: niche, origin: "user", owner: user.id });
  if (error && missingColumn(error)) {
    owned = false;
    ({ data, error } = await add({ topic: niche, origin: "user" }));
  }
  if (error) return Response.json({ error: "Couldn't save that. Try again." }, { status: 500 });
  if (!data?.length) return Response.json({ queued: true });

  const topics = () => db().from("feed_topics").select("topic", { count: "exact", head: true }).eq("origin", "user");
  const [mine, all] = await Promise.all([owned ? count(topics().eq("owner", user.id)) : 0, count(topics())]);
  const reason =
    mine > MAX_PER_USER
      ? `You're already watching ${MAX_PER_USER} niches. Stop watching one to add another.`
      : all > MAX_USER_TOPICS
        ? "Unmet's research list is full for now."
        : null;
  if (reason) {
    let undo = db().from("feed_topics").delete().eq("topic", niche).eq("origin", "user").is("last_run", null);
    if (owned) undo = undo.eq("owner", user.id);
    await undo;
    return Response.json({ queued: false, reason });
  }
  return Response.json({ queued: true });
}

export async function DELETE(request: Request) {
  const g = await guard(request);
  if (g.error) return g.error;
  const { error } = await db().from("feed_topics").delete().eq("topic", g.niche).eq("origin", "user").eq("owner", g.user.id);
  if (error && missingColumn(error)) return Response.json({ removed: false }); // owner unknown yet, leave it
  if (error) return Response.json({ error: "Couldn't remove that. Try again." }, { status: 500 });
  return Response.json({ removed: true });
}
