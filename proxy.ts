import { NextResponse, type NextRequest } from "next/server";

// The Studio (/app) is for people who signed in or chose guest mode on /welcome. Checking that here,
// before anything renders, lets /app pages render on the server instead of waiting for the browser.
// This only looks for the cookies; it doesn't validate them (the API routes check tokens). A stale
// cookie gets the page, and components/shell/AppGate.tsx sends that browser to /welcome.

const authConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
);

// @supabase/ssr stores the session as `sb-<project>-auth-token`, split into `.0`, `.1`… when large.
// The `-code-verifier` cookie only means a sign-in was started.
const isSession = (name: string) => name.startsWith("sb-") && name.includes("-auth-token") && !name.endsWith("-code-verifier");

export function proxy(request: NextRequest) {
  if (!authConfigured) return NextResponse.next();
  const { cookies, nextUrl } = request;
  if (cookies.get("unmet_guest")?.value === "1" || cookies.getAll().some((c) => isSession(c.name) && c.value)) return NextResponse.next();
  const to = new URL("/welcome", request.url);
  const query = new URLSearchParams(nextUrl.search);
  query.delete("_rsc"); // client navigations add it; it isn't part of the page's address
  to.searchParams.set("next", nextUrl.pathname + (query.size ? `?${query}` : ""));
  return NextResponse.redirect(to);
}

export const config = {
  // Every /app page except shared idea links, which stay open to everyone.
  matcher: ["/app", "/app/((?!idea(?:/|$)).*)"],
};
