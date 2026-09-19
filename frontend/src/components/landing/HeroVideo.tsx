"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./landing.module.css";

export default function HeroVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const video = videoRef.current!;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      if (reduced.matches) {
        video.pause();
        video.removeAttribute("src");
        video.load();
      } else {
        video.src = window.matchMedia("(max-width: 700px)").matches
          ? "/landing/harmonic-hero-mobile.mp4"
          : "/landing/harmonic-hero.mp4";
        void video.play().catch(() => {
          /* Poster remains when autoplay is unavailable. */
        });
      }
    };
    update();
    reduced.addEventListener("change", update);
    return () => {
      reduced.removeEventListener("change", update);
      video.pause();
    };
  }, []);

  function toggle() {
    const video = videoRef.current!;
    if (playing) video.pause();
    else {
      // An explicit play action is allowed even when reduced motion is preferred.
      if (!video.getAttribute("src"))
        video.src = window.matchMedia("(max-width: 700px)").matches
          ? "/landing/harmonic-hero-mobile.mp4"
          : "/landing/harmonic-hero.mp4";
      void video.play().catch(() => {
        /* Keep the static fallback. */
      });
    }
  }

  return (
    <>
      <video
        ref={videoRef}
        className={styles.video}
        autoPlay
        muted
        loop
        playsInline
        preload="none"
        poster="/landing/harmonic-poster.webp"
        width="1600"
        height="900"
        aria-hidden="true"
        onPlaying={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onError={() => setPlaying(false)}
      />
      <button
        className={styles.videoControl}
        onClick={toggle}
        aria-label={
          playing ? "Pause background video" : "Play background video"
        }
      >
        <span aria-hidden="true">{playing ? "Ⅱ" : "▷"}</span>{" "}
        {playing ? "Pause motion" : "Play motion"}
      </button>
    </>
  );
}
