"use client";
import { Fragment, useRef } from "react";
import { gsap } from "@/lib/motion";
import { useGsap } from "./useGsap";

type Props = {
  text: string;
  as?: "h1" | "h2" | "p" | "span";
  className?: string;
  delay?: number;
  stagger?: number;
};

/**
 * Word-by-word reveal in the spirit of React Bits' SplitText, built on GSAP (no extra dependency).
 * It splits on WORDS, not letters: Arabic letters join to their neighbours, so per-letter spans would break the script.
 * Renders the full text on the server, so content is never hidden without JavaScript.
 */
export default function SplitText({ text, as: Tag = "span", className, delay = 0, stagger = 0.07 }: Props) {
  const ref = useRef<HTMLElement>(null);
  const words = text.split(" ");

  useGsap(
    ref,
    (el) => {
      gsap.from(el.querySelectorAll(".split-word"), {
        opacity: 0,
        y: "0.5em",
        duration: 0.8,
        ease: "power3.out",
        stagger,
        delay,
      });
    },
    [text],
  );

  return (
    <Tag ref={ref as never} className={className} aria-label={text}>
      {words.map((w, i) => (
        <Fragment key={`${i}-${w}`}>
          <span className="split-word" aria-hidden="true">
            {w}
          </span>
          {i < words.length - 1 ? " " : null}
        </Fragment>
      ))}
    </Tag>
  );
}
