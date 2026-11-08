"use client";

import { useEffect, useState } from "react";

// remounts on every navigation so content fades in, but not on first load
let afterFirstLoad = false;

export default function StudioTemplate({ children }: { children: React.ReactNode }) {
  const [fade] = useState(afterFirstLoad); // false on the server and while hydrating
  useEffect(() => {
    afterFirstLoad = true;
  }, []);
  return <div className={fade ? "fade-in" : undefined}>{children}</div>;
}
