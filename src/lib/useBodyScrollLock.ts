'use client';

import { useEffect } from 'react';

/** Prevent body scroll (and the page scrollbar) while `active` is true. */
export function useBodyScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const prevOverflow = document.body.style.overflow;
    const prevPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth =
      window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) {
      // Compensate so the layout doesn't shift when the scrollbar disappears.
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }
    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.paddingRight = prevPaddingRight;
    };
  }, [active]);
}
