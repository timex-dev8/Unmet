import { NextResponse, type NextRequest } from "next/server";

// /app is for signed-in or guest visitors. checked here so pages render on the server
// only looks for cookies, no validation (api routes check tokens), AppGate.tsx sends stale ones to /welcome

const authConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
);

// session is sb-<project>-auth-token, split into .0, .1 when large. -code-verifier only means a sign-in started
const isSession = (name: string) => name.startsWith("sb-") && name.includes("-auth-token") && !name.endsWith("-code-verifier");

export function proxy(request: NextRequest) {
  if (!authConfigured) return NextResponse.next();
  const { cookies, nextUrl } = request;
  if (cookies.get("unmet_guest")?.value === "1" || cookies.getAll().some((c) => isSession(c.name) && c.value)) return NextResponse.next();
  const to = new URL("/welcome", request.url);
  const query = new URLSearchParams(nextUrl.search);
  query.delete("_rsc"); // client navigations add it
  to.searchParams.set("next", nextUrl.pathname + (query.size ? `?${query}` : ""));
  return NextResponse.redirect(to);
}

export const config = {
  matcher: ["/app", "/app/((?!idea(?:/|$)).*)"],
};
