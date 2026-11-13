"use client";
import { useEffect, type ReactNode } from "react";
import Lenis from "lenis";
import { gsap, ScrollTrigger, prefersReducedMotion } from "@/lib/motion";

/**
 * Lenis smooth scroll for the whole app, synced with GSAP's ticker so ScrollTrigger
 * and Lenis share one frame loop. Native scrolling is kept on touch devices (smoothTouch is off by default in Lenis),
 * which is the right trade-off for mobile performance. Off when reduced motion is requested.
 */
export default function SmoothScroll({ children }: { children: ReactNode }) {
  useEffect(() => {
    if (prefersReducedMotion()) return;

    const lenis = new Lenis({ duration: 1.1, smoothWheel: true, touchMultiplier: 1 });
    lenis.on("scroll", () => ScrollTrigger.update());

    const tick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);

    return () => {
      gsap.ticker.remove(tick);
      lenis.destroy();
    };
  }, []);

  return <>{children}</>;
}
