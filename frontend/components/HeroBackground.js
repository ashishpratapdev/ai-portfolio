"use client";
import { useEffect, useState } from "react";

/** Full-bleed hero background. Plays /hero.mp4 (muted, looping, no controls). If the file is missing, fails to load, or the
 *  visitor prefers reduced motion, the CSS "aurora" underneath stays visible, so the hero never looks broken.
 *  Replace frontend/public/hero.mp4 with your own video (H.264, ~1280x720, no audio, under ~8 MB). */
export default function HeroBackground() {
  const [videoOk, setVideoOk] = useState(true);
  const [reduced, setReduced] = useState(false);
  useEffect(() => setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches), []);
  return (
    <div aria-hidden="true" className="absolute inset-0 -z-10 overflow-hidden">
      <div className="aurora absolute inset-0" />
      {videoOk && !reduced && (
        <video className="absolute inset-0 h-full w-full object-cover" autoPlay muted loop playsInline preload="metadata" disablePictureInPicture tabIndex={-1}>
          <source src="/hero.mp4" type="video/mp4" onError={() => setVideoOk(false)} />
        </video>
      )}
      {/* readability scrims: dark on the text side, fading into the page at the bottom */}
      <div className="absolute inset-0 bg-gradient-to-r from-paper via-paper/75 to-paper/20" />
      <div className="absolute inset-0 bg-paper/25" />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-paper to-transparent" />
    </div>
  );
}
