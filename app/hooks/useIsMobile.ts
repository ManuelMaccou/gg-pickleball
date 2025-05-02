'use client'

import { useEffect, useState } from 'react';

export function useIsMobile(breakpoint = 767) {
  const [isMobile, setIsMobile] = useState<null | boolean>(null);

  useEffect(() => {
    const isMobileNow = window.innerWidth <= breakpoint;
    setIsMobile(isMobileNow);
  }, [breakpoint]);

  return isMobile;
}