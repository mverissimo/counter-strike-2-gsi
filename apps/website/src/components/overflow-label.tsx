import { useEffect, useRef, useState } from "react";

export function OverflowLabel({ text, muted = false }: { text: string; muted?: boolean }) {
  const viewportRef = useRef<HTMLSpanElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [overflowing, setOverflowing] = useState(false);

  useEffect(() => {
    const viewport = viewportRef.current;
    const label = textRef.current;
    if (!viewport || !label) return;
    const measure = () => setOverflowing(label.scrollWidth > viewport.clientWidth);
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    observer.observe(label);
    measure();
    return () => observer.disconnect();
  }, [text]);

  return (
    <span
      ref={viewportRef}
      data-slot="overflow-label"
      data-overflowing={overflowing || undefined}
      className={`@container block min-w-0 flex-1 overflow-hidden data-overflowing:mask-[linear-gradient(to_right,#000_calc(100%-1.5rem),transparent)] motion-safe:group-hover/row:data-overflowing:[mask-image:linear-gradient(to_right,transparent,#000_1.5rem,#000_calc(100%-1.5rem),transparent)] motion-safe:group-focus-within/row:data-overflowing:[mask-image:linear-gradient(to_right,transparent,#000_1.5rem,#000_calc(100%-1.5rem),transparent)] ${muted ? "text-muted-foreground" : ""}`}
    >
      <span
        ref={textRef}
        data-slot="overflow-label-text"
        className="inline-block max-w-none whitespace-nowrap transition-transform duration-150 ease-linear motion-safe:group-hover/row:[transform:translateX(min(0px,calc(100cqw_-_100%)))] motion-safe:group-focus-within/row:[transform:translateX(min(0px,calc(100cqw_-_100%)))] group-hover/row:duration-[2500ms] group-focus-within/row:duration-[2500ms] motion-reduce:transition-none"
      >
        {text}
      </span>
    </span>
  );
}
