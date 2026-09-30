import { useEffect, useRef, useState } from "react";

/** Reveals a prompt once it enters view; assistive technology gets the complete text. */
export function TypedQuestion({ text }: { text: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [visibleCount, setVisibleCount] = useState(0);
  const characters = Array.from(text);
  const characterCount = characters.length;

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reducedMotion.matches || !window.IntersectionObserver) {
      setVisibleCount(characterCount);
      return;
    }

    let frame = 0;
    let started = false;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting || started) return;
        started = true;
        observer.disconnect();
        const start = performance.now();
        const duration = Math.min(560, Math.max(220, characterCount * 18));
        const tick = (now: number) => {
          setVisibleCount(
            Math.min(characterCount, Math.ceil(((now - start) / duration) * characterCount)),
          );
          if (now - start < duration) frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
      },
      { threshold: 0.2 },
    );
    observer.observe(element);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [text, characterCount]);

  return (
    <span ref={ref} className="nook-typed-question">
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">{characters.slice(0, visibleCount).join("")}</span>
      {visibleCount < characters.length && (
        <span className="nook-typing-caret" aria-hidden="true" />
      )}
    </span>
  );
}
