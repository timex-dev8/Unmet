"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { continueAsGuest, useGuest, useUser } from "@/lib/auth";

// sets the guest cookie proxy.ts checks, synchronously
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
