"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useGuest, useUser } from "@/lib/auth";
import { authConfigured } from "@/lib/supabase/client";

// The Studio is for people who signed in or chose guest mode on /welcome. proxy.ts does the real
// check on the server (session or guest cookie), so the page renders straight away. This is only the
// fallback for when the cookie said yes but the browser disagrees (an expired session, say).
// Shared idea links stay open to everyone, so a link someone posts always works.
export default function AppGate({ children }: { children: ReactNode }) {
  const user = useUser();
  const guest = useGuest();
  const pathname = usePathname();
  const router = useRouter();
  const open = !authConfigured || pathname.startsWith("/app/idea/");
  const known = user !== undefined && guest !== undefined;
  const allowed = open || Boolean(user) || guest === true;

  useEffect(() => {
    if (known && !allowed) router.replace(`/welcome?next=${encodeURIComponent(pathname + window.location.search)}`);
  }, [known, allowed, pathname, router]);

  return children;
}
