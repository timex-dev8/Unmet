"use client";

import { useEffect, useState } from "react";

// Re-mounts on every Studio navigation: the page content fades in while the shell stays still.
// Not on the very first load: the page is already there, so fading it in only delays what you see.
let afterFirstLoad = false;

export default function StudioTemplate({ children }: { children: React.ReactNode }) {
  const [fade] = useState(afterFirstLoad); // fixed per mount; false on the server and while hydrating
  useEffect(() => {
    afterFirstLoad = true;
  }, []);
  return <div className={fade ? "fade-in" : undefined}>{children}</div>;
}
