"use client";

import { useEffect, useState } from "react";

export function useIsNarrowScreen(breakpoint = 768): boolean {
  const [narrow, setNarrow] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const sync = () => setNarrow(mq.matches);
    queueMicrotask(sync);
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, [breakpoint]);

  return narrow;
}
