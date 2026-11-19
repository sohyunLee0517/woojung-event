"use client";

import { useEffect } from "react";

// 아이폰은 user-scalable=no 를 무시해서, 두 손가락 확대(제스처)를 직접 막는다.
export default function NoPinchZoom() {
  useEffect(() => {
    const stop = (e: Event) => e.preventDefault();
    const multiTouch = (e: TouchEvent) => {
      if (e.touches.length > 1) e.preventDefault();
    };
    document.addEventListener("gesturestart", stop, { passive: false });
    document.addEventListener("gesturechange", stop, { passive: false });
    document.addEventListener("touchmove", multiTouch, { passive: false });
    return () => {
      document.removeEventListener("gesturestart", stop);
      document.removeEventListener("gesturechange", stop);
      document.removeEventListener("touchmove", multiTouch);
    };
  }, []);
  return null;
}
