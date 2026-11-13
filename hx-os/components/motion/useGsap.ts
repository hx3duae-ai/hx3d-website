"use client";
import { type RefObject } from "react";
import { gsap, prefersReducedMotion } from "@/lib/motion";
import { useIsoLayoutEffect } from "./useIsoLayoutEffect";

/**
 * Runs GSAP setup inside a gsap.context scoped to ref.current and reverts it on cleanup
 * (kills tweens + ScrollTriggers, restores inline styles). Skipped entirely when the user
 * prefers reduced motion, so content stays visible and static.
 */
export function useGsap(
  ref: RefObject<HTMLElement | null>,
  setup: (scope: HTMLElement) => void,
  deps: unknown[] = [],
) {
  useIsoLayoutEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;
    const ctx = gsap.context(() => setup(el), el);
    return () => ctx.revert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
