"use client";

import { useEffect } from "react";
import { useUser } from "@/lib/auth";
import { endSync, startSync } from "@/lib/sync";

// Mounted once in the Studio layout: starts syncing when someone signs in, stops (and clears
// this browser's copy) when they sign out. Renders nothing.
export default function AccountSync() {
  const user = useUser();
  useEffect(() => {
    if (user) void startSync(user.id);
    else if (user === null) endSync();
  }, [user]);
  return null;
}
