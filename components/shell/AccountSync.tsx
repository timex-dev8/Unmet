"use client";

import { useEffect } from "react";
import { useUser } from "@/lib/auth";
import { endSync, startSync } from "@/lib/sync";

export default function AccountSync() {
  const user = useUser();
  useEffect(() => {
    if (user) void startSync(user.id);
    else if (user === null) void endSync();
  }, [user]);
  return null;
}
