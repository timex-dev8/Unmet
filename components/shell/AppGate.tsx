"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useGuest, useUser } from "@/lib/auth";
import { authConfigured } from "@/lib/supabase/client";

// The Studio is for people who signed in or chose guest mode on /welcome. Shared idea links stay
// open to everyone, so a link someone posts always works.
export default function AppGate({ children }: { children: ReactNode }) {
  const user = useUser();
  const guest = useGuest();
  const pathname = usePathname();
  const router = useRouter();
  const open = !authConfigured || pathname.startsWith("/app/idea/");
  const known = user !== undefined && guest !== undefined;
  const allowed = open || Boolean(user) || guest === true;

  useEffect(() => {
    if (known && !allowed) router.replace(`/welcome?next=${encodeURIComponent(pathname)}`);
  }, [known, allowed, pathname, router]);

  return allowed ? children : null;
}
