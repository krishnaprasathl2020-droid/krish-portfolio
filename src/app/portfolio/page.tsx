"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useSpring,
  useMotionTemplate,
  useReducedMotion,
} from "framer-motion";
import Link from "next/link";
import Image from "next/image";

/* ═══════════════════════════════════════════
   DATA
   ═══════════════════════════════════════════ */

interface VideoItem {
  src: string;
  poster: string;
}

interface ClientData {
  name: string;
  logo: string;
  link: string;
  videos: VideoItem[];
}

const CLIENTS: ClientData[] = [
  {
    name: "anandjewellerserode",
    logo: "/portfolio/logos/anand-logo.jpg",
    link: "https://www.instagram.com/anandjewellerserode/",
    videos: [
      { src: "/portfolio/anand/1.mp4", poster: "/portfolio/anand/1-poster.jpg" },
      { src: "/portfolio/anand/2.mp4", poster: "/portfolio/anand/2-poster.jpg" },
      { src: "/portfolio/anand/3.mp4", poster: "/portfolio/anand/3-poster.jpg" },
    ],
  },
  {
    name: "style_with_sugi",
    logo: "/portfolio/logos/sugii-dp.jpg",
    link: "https://www.instagram.com/style_with_sugi/",
    videos: [
      { src: "/portfolio/sugi/1.mp4", poster: "/portfolio/sugi/1-poster.jpg" },
      { src: "/portfolio/sugi/2.mp4", poster: "/portfolio/sugi/2-poster.jpg" },
      { src: "/portfolio/sugi/3.mp4", poster: "/portfolio/sugi/3-poster.jpg" },
    ],
  },
];

const WA_LINK =
  "https://wa.me/919344428306?text=Hi%20Krish,%20I%20saw%20your%20portfolio%20and%20I%20need%20a%20video%20edit";
const IG_LINK = "https://www.instagram.com/llkrishnaprasath/";

/* ═══════════════════════════════════════════
   VIDEO MODAL
   ═══════════════════════════════════════════ */

function VideoModal({
  src,
  onClose,
}: {
  src: string;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<Element | null>(null);

  // Capture previously focused element and auto-play
  useEffect(() => {
    previouslyFocusedRef.current = document.activeElement;
    videoRef.current?.play().catch(() => {});
  }, []);

  // Focus trap + Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }

      if (e.key === "Tab") {
        const dialog = dialogRef.current;
        if (!dialog) return;

        const focusable = dialog.querySelectorAll<HTMLElement>(
          'button, [href], video, [tabindex]:not([tabindex="-1"]), input, select, textarea'
        );
        if (focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // Restore focus on unmount
  useEffect(() => {
    return () => {
      if (previouslyFocusedRef.current instanceof HTMLElement) {
        previouslyFocusedRef.current.focus();
      }
    };
  }, []);

  return (
    <motion.div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="Portfolio video player"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-xl"
      onClick={onClose}
    >
      {/* Close Button */}
      <button
        autoFocus
        onClick={onClose}
        className="absolute top-4 right-4 z-10 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
        aria-label="Close video"
      >
        <svg
          aria-hidden="true"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-5 h-5 text-white"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>

      {/* Video */}
      <video
        ref={videoRef}
        src={src}
        aria-label="Portfolio video"
        controls
        autoPlay
        playsInline
        className="max-h-[80vh] w-auto rounded-xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />
    </motion.div>
  );
}

/* ═══════════════════════════════════════════
   3D TILT VIDEO CARD
   ═══════════════════════════════════════════ */

const TILT_RANGE = 15; // degrees

function TiltVideoCard({
  video,
  ariaLabel,
  isInteractive = true,
  onClick,
}: {
  video: VideoItem;
  ariaLabel: string;
  isInteractive?: boolean;
  onClick: () => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();

  const rotateX = useSpring(useMotionValue(0), { stiffness: 200, damping: 20 });
  const rotateY = useSpring(useMotionValue(0), { stiffness: 200, damping: 20 });

  const transform = useMotionTemplate`perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;

  // Desktop-only: compute tilt from mouse position
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!isInteractive || prefersReducedMotion) return;
      // Skip on touch devices
      if (window.matchMedia("(pointer: coarse)").matches) return;

      const rect = cardRef.current?.getBoundingClientRect();
      if (!rect) return;

      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;

      rotateX.set((y - 0.5) * -TILT_RANGE);
      rotateY.set((x - 0.5) * TILT_RANGE);
    },
    [isInteractive, prefersReducedMotion, rotateX, rotateY]
  );

  const handleMouseLeave = useCallback(() => {
    rotateX.set(0);
    rotateY.set(0);
  }, [rotateX, rotateY]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onClick();
      }
    },
    [onClick]
  );

  return (
    <motion.div
      ref={cardRef}
      role="button"
      tabIndex={isInteractive ? 0 : -1}
      aria-label={ariaLabel}
      aria-hidden={!isInteractive}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={isInteractive ? onClick : undefined}
      onKeyDown={handleKeyDown}
      style={{ transform: prefersReducedMotion ? undefined : transform, transformStyle: "preserve-3d" }}
      className="
        relative flex-shrink-0 cursor-pointer
        w-[75vw] h-[50vh] md:w-[320px] md:h-[450px]
        snap-center rounded-2xl overflow-hidden
        bg-[#0a0a0a] border border-white/10
        hover:border-[#008CFF]/50
        hover:shadow-[0_0_30px_rgba(0,140,255,0.3)]
        transition-colors duration-300
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#008CFF]/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]
        motion-reduce:transition-colors
        group
      "
    >
      {/* Base Layer — Poster Image */}
      <Image
        src={video.poster}
        alt="Video thumbnail"
        fill
        sizes="(max-width: 768px) 75vw, 320px"
        className="object-cover transition-transform duration-500 motion-safe:group-hover:scale-105 motion-reduce:transition-none"
      />

      {/* Hover overlay */}
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300" />

      {/* 3D Floating Layer — Play Icon (translateZ 50px) */}
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{ transform: "translateZ(50px)" }}
      >
        <div
          className="
            w-14 h-14 md:w-16 md:h-16 rounded-full
            bg-[#008CFF]/80 backdrop-blur-sm
            flex items-center justify-center
            shadow-[0_0_30px_rgba(0,140,255,0.35)]
            group-hover:shadow-[0_0_40px_rgba(0,140,255,0.5)]
            motion-safe:group-hover:scale-110
            transition-all duration-300
            motion-reduce:transition-none
          "
        >
          <svg
            aria-hidden="true"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="white"
            className="w-6 h-6 md:w-7 md:h-7 ml-1"
          >
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
      </div>

      {/* 3D Floating Text — Bottom Tag (translateZ 30px) */}
      <div
        className="absolute bottom-0 left-0 right-0 p-4"
        style={{ transform: "translateZ(30px)" }}
      >
        <p className="font-sans text-[10px] tracking-[0.2em] uppercase text-white/50">
          Rynex Edit
        </p>
      </div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════
   CLIENT SECTION
   ═══════════════════════════════════════════ */

function ClientSection({
  client,
  onPlay,
}: {
  client: ClientData;
  onPlay: (src: string) => void;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="mb-12 md:mb-16"
    >
      {/* Client Header */}
      <a
        href={client.link}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-3 sm:gap-4 mb-5 md:mb-6 px-1 rounded-xl group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#008CFF]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]"
      >
        <div className="relative w-20 h-20 md:w-24 md:h-24 rounded-full overflow-hidden border-2 border-white/10 group-hover:border-[#008CFF] transition-colors duration-300 flex-shrink-0">
          <Image
            src={client.logo}
            alt={client.name}
            fill
            sizes="96px"
            className="object-cover"
          />
        </div>
        <div>
          <h2 className="font-heading text-lg md:text-xl font-semibold tracking-[-0.03em] text-white group-hover:text-[#008CFF] transition-colors duration-300">
            {client.name}
          </h2>
          <p className="text-[10px] md:text-xs text-white/30 tracking-wide mt-0.5">
            View on Instagram ↗
          </p>
        </div>
      </a>

      {/* Horizontal Scroll — Conveyor Belt (Marquee) */}
      <div className="overflow-hidden w-full -mx-4 px-4 md:-mx-6 md:px-6 pb-4 group/marquee">
        <div className="flex gap-4 w-max animate-marquee hover:[animation-play-state:paused] active:[animation-play-state:paused]">
          {[...client.videos, ...client.videos].map((video, i) => {
            const isDuplicate = i >= client.videos.length;
            return (
            <TiltVideoCard
              key={`${video.src}-${i}`}
              video={video}
              ariaLabel={`Play ${client.name} portfolio video ${(i % client.videos.length) + 1}`}
              isInteractive={!isDuplicate}
              onClick={() => onPlay(video.src)}
            />
            );
          })}
        </div>
      </div>
    </motion.section>
  );
}

/* ═══════════════════════════════════════════
   PORTFOLIO PAGE
   ═══════════════════════════════════════════ */

export default function PortfolioPage() {
  const [activeVideo, setActiveVideo] = useState<string | null>(null);

  const handlePlay = useCallback((src: string) => {
    setActiveVideo(src);
    // Lock scroll when modal is open
    document.body.style.overflow = "hidden";
  }, []);

  const handleClose = useCallback(() => {
    setActiveVideo(null);
    document.body.style.overflow = "";
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* ── Nav ── */}
      <nav className="sticky top-0 z-40 px-4 md:px-6 pt-4 pb-3 bg-[#0a0a0a]/80 backdrop-blur-lg border-b border-white/[0.04]">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link
            href="/"
            className="font-heading text-xs md:text-sm font-medium text-white/50 hover:text-white transition-colors duration-300 tracking-[-0.02em]"
          >
            ← Back
          </Link>
          <span className="font-heading text-xs md:text-sm font-medium text-white/40 tracking-[-0.02em]">
            Portfolio
          </span>
        </div>
      </nav>

      {/* ── Client Sections ── */}
      <main className="px-4 md:px-6 pt-10 md:pt-16 max-w-5xl mx-auto pb-32 md:pb-20">
        {CLIENTS.map((client) => (
          <ClientSection
            key={client.name}
            client={client}
            onPlay={handlePlay}
          />
        ))}

        {/* ── Footer CTA Section ── */}
        <motion.section
          viewport={{ once: true }}
          className="mt-28 md:mt-36 pt-10 md:pt-14 border-t border-white/[0.06] text-center"
        >
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.45, ease: "easeOut" }}
            className="text-xs md:text-sm tracking-[0.25em] uppercase text-[#008CFF] mb-4 font-medium"
          >
            YOUR TURN
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.55, ease: "easeOut", delay: 0.08 }}
            className="font-heading text-[30px] md:text-[44px] font-bold tracking-[-0.05em] leading-[0.98] mb-5"
          >
            Let&apos;s create something
            <br />
            people <span className="font-semibold">don&apos;t scroll past.</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, ease: "easeOut", delay: 0.18 }}
            className="font-sans text-base md:text-lg text-white/45 mb-10 max-w-[460px] mx-auto font-light leading-relaxed"
          >
            <span className="font-medium text-white/60">One message</span> is all it takes to get started.
          </motion.p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
            {/* Primary — WhatsApp */}
            <motion.a
              href={WA_LINK}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Chat with Krish on WhatsApp"
              initial={{ opacity: 0, scale: 0.96 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.42, ease: "easeOut", delay: 0.3 }}
              className="
                inline-flex items-center gap-2.5
                px-7 py-3.5 rounded-full
                bg-[#008CFF] text-white
                font-sans text-sm font-medium tracking-[-0.01em]
                motion-safe:hover:-translate-y-0.5 motion-safe:active:scale-[0.98]
                transition-[transform,box-shadow,opacity] duration-[220ms] ease-out motion-reduce:transition-opacity
                shadow-[0_4px_25px_rgba(0,140,255,0.3)]
                hover:shadow-[0_6px_30px_rgba(0,140,255,0.36)]
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#008CFF] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]
              "
            >
              <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
              Chat on WhatsApp
            </motion.a>

            {/* Secondary — Instagram */}
            <motion.a
              href={IG_LINK}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="DM Krish on Instagram"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.42, ease: "easeOut", delay: 0.4 }}
              className="
                inline-flex items-center gap-2.5
                px-7 py-3.5 rounded-full
                bg-transparent text-white/70
                border border-white/[0.12]
                font-sans text-sm font-medium tracking-[-0.01em]
                hover:border-white/25 hover:bg-white/[0.03] hover:text-white motion-safe:active:scale-[0.98]
                transition-[border-color,background-color,color,opacity,transform] duration-[220ms] ease-out motion-reduce:transition-opacity
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/35 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]
              "
            >
              <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
              </svg>
              DM on Instagram
            </motion.a>
          </div>
        </motion.section>
      </main>

      {/* ── Sticky Mobile CTA ── */}
      {!activeVideo && (
        <div className="fixed bottom-0 left-0 right-0 z-40 md:hidden p-3 pb-[calc(12px+env(safe-area-inset-bottom))]">
          <div className="bg-white/[0.06] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-3">
            <a
              href={WA_LINK}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Chat with Krish on WhatsApp"
              className="
                flex items-center justify-center gap-2 w-full
                py-3 rounded-xl
                bg-[#008CFF] text-white
                font-sans text-sm font-semibold tracking-[-0.01em]
                motion-safe:active:scale-[0.98]
                transition-transform duration-200 motion-reduce:transition-none
                shadow-[0_2px_20px_rgba(0,140,255,0.3)]
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#008CFF]/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]
              "
            >
              <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
              Hire Me
            </a>
          </div>
        </div>
      )}

      {/* ── Video Modal ── */}
      <AnimatePresence>
        {activeVideo && (
          <VideoModal src={activeVideo} onClose={handleClose} />
        )}
      </AnimatePresence>
    </div>
  );
}
