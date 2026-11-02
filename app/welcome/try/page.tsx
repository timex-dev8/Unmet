"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { continueAsGuest, useGuest, useUser } from "@/lib/auth";

// The fast way in from the landing page: no sign-in screen. Signed-in people go straight to research;
// everyone else becomes a guest first (this sets the cookie proxy.ts checks, synchronously) and then goes.
export default function Try() {
  const router = useRouter();
  const user = useUser();
  const guest = useGuest();

  useEffect(() => {
    if (user === undefined || guest === undefined) return;
    if (!user && !guest) continueAsGuest();
    router.replace("/app/research");
  }, [user, guest, router]);

  return <p className="sr-only">Opening Unmet…</p>;
}
