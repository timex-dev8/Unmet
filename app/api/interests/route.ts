import { z } from "zod/v4";
import { generateJson, LlmError, llmConfigured } from "@/lib/llm";
import { takeHourlySlot } from "@/lib/rate-limit";
import { PROFILE_SYSTEM } from "@/lib/research/prompts";
import { CATEGORIES } from "@/lib/types";

// "I'm a nurse" → audiences, keywords and niches Unmet can research and rank by. AI only, no search.

const Body = z.object({ text: z.string().trim().min(2).max(300) });
const ProfileSchema = z.object({
  audiences: z.array(z.string()).max(4),
  keywords: z.array(z.string()).max(12),
  niches: z.array(z.string()).max(3),
  category: z.enum(CATEGORIES),
});

export async function POST(request: Request) {
  if (!llmConfigured()) return Response.json({ error: "The AI isn't set up yet." }, { status: 503 });
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Tell Unmet a little more, in a sentence or two." }, { status: 400 });

  // Per-visitor limit to protect the free AI tier (lib/rate-limit.ts).
  if (!(await takeHourlySlot(request, "interests", 20)))
    return Response.json({ error: "Too many changes this hour. Try again later." }, { status: 429 });

  try {
    const profile = await generateJson(ProfileSchema, {
      system: PROFILE_SYSTEM,
      timeoutMs: 20_000,
      prompt: `Categories: ${CATEGORIES.join(", ")}\n\nThey said: ${parsed.data.text}`,
    });
    return Response.json({ profile: { text: parsed.data.text, ...profile } });
  } catch (err) {
    return Response.json({ error: err instanceof LlmError ? err.message : "Couldn't read that right now. Try again." }, { status: 502 });
  }
}
