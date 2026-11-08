import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { safeNext } from "@/lib/links";

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  // same-site paths only, no open redirect
  const next = safeNext(url.searchParams.get("next") ?? "/app", url.origin);

  if (code) {
    const store = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)!,
      {
        cookies: {
          getAll: () => store.getAll(),
          setAll: (list) => list.forEach(({ name, value, options }) => store.set(name, value, options)),
        },
      },
    );
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
    console.warn("[auth] sign-in failed:", error.message);
  }

  const back = new URL(next, url.origin);
  back.searchParams.set("signin", "failed");
  return NextResponse.redirect(back);
}
