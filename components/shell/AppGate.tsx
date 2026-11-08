"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useGuest, useUser } from "@/lib/auth";
import { authConfigured } from "@/lib/supabase/client";

// proxy.ts does the real check on the server, this is only for when the cookie says yes but the browser disagrees
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
