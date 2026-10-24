"use client";
import { useState } from "react";
import { initials } from "@/lib/format";

/** The owner's photo. Falls back to initials if the image is missing, so nothing ever looks broken.
 *  `fluid` makes it fill its container as a square (use for the big hero/about portraits). */
export default function Avatar({ src, name, size = 40, fluid = false, className = "", rounded = "rounded-full", priority = false }) {
  const [failed, setFailed] = useState(false);
  const style = fluid ? undefined : { width: size, height: size };
  const shape = fluid ? "aspect-square w-full" : "";
  if (failed || !src) {
    return (
      <span style={style} role="img" aria-label={name} className={`inline-flex shrink-0 items-center justify-center bg-teal font-display font-bold text-onaccent ${shape} ${rounded} ${className}`}>
        <span style={fluid ? { fontSize: "clamp(3rem, 12vw, 6rem)" } : { fontSize: size * 0.38 }}>{initials(name)}</span>
      </span>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={name} width={size} height={size} style={style} onError={() => setFailed(true)} fetchPriority={priority ? "high" : undefined} className={`shrink-0 object-cover ${shape} ${rounded} ${className}`} />;
}
