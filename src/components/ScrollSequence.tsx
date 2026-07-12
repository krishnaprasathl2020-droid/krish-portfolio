"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { useScroll, useMotionValueEvent } from "framer-motion";
import HUDOverlay from "./HUDOverlay";
import LoadingScreen from "./LoadingScreen";
import MobileScrollIndicator from "./MobileScrollIndicator";
import NavBar from "./NavBar";

/* ─── Constants ─── */
const TOTAL_FRAMES = 310;
const STARTUP_FRAME_COUNT = 64;
const BACKGROUND_LOAD_CONCURRENCY = 8;

type MobileCameraFocus = "characterRight" | "characterLeft" | "center";
type MobileCameraFocusY = "upperCenter";

interface MobileCameraScene {
  progress: number;
  zoom: number;
  focus: MobileCameraFocus;
  focusY: MobileCameraFocusY;
}

const MOBILE_CAMERA_SCENES: MobileCameraScene[] = [
  { progress: 0, zoom: 1.22, focus: "characterRight", focusY: "upperCenter" },
  { progress: 0.32, zoom: 1.08, focus: "characterLeft", focusY: "upperCenter" },
  { progress: 0.56, zoom: 1.08, focus: "characterLeft", focusY: "upperCenter" },
  { progress: 0.64, zoom: 1.18, focus: "center", focusY: "upperCenter" },
  { progress: 1, zoom: 1.18, focus: "center", focusY: "upperCenter" },
];

const MOBILE_CAMERA_FOCUS_X: Record<MobileCameraFocus, number> = {
  characterRight: 0.08,
  characterLeft: 0.5,
  center: 0,
};

const MOBILE_CAMERA_FOCUS_Y: Record<MobileCameraFocusY, number> = {
  upperCenter: 0.13,
};

const lerp = (start: number, end: number, amount: number) => (
  start + (end - start) * amount
);

const smoothstep = (value: number) => (
  value * value * (3 - 2 * value)
);

const getMobileCamera = (progress: number) => {
  const clampedProgress = Math.min(1, Math.max(0, progress));
  const nextIndex = MOBILE_CAMERA_SCENES.findIndex((scene) => (
    clampedProgress <= scene.progress
  ));
  const sceneIndex = nextIndex === -1 ? MOBILE_CAMERA_SCENES.length - 1 : nextIndex;
  const currentScene = MOBILE_CAMERA_SCENES[Math.max(0, sceneIndex - 1)];
  const nextScene = MOBILE_CAMERA_SCENES[sceneIndex];
  const range = nextScene.progress - currentScene.progress;
  const rawAmount = range === 0 ? 1 : (clampedProgress - currentScene.progress) / range;
  const amount = smoothstep(Math.min(1, Math.max(0, rawAmount)));

  return {
    zoom: lerp(currentScene.zoom, nextScene.zoom, amount),
    focusX: lerp(
      MOBILE_CAMERA_FOCUS_X[currentScene.focus],
      MOBILE_CAMERA_FOCUS_X[nextScene.focus],
      amount
    ),
    focusY: lerp(
      MOBILE_CAMERA_FOCUS_Y[currentScene.focusY],
      MOBILE_CAMERA_FOCUS_Y[nextScene.focusY],
      amount
    ),
  };
};

/** frame_000000.webp → frame_000309.webp */
function getFramePath(index: number): string {
  return `/frames/frame_${String(index).padStart(6, "0")}.webp`;
}

export default function ScrollSequence() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imagesRef = useRef<HTMLImageElement[]>([]);
  const loadedFrameIndexesRef = useRef<Set<number>>(new Set());
  const currentFrameRef = useRef(0);
  const scrollProgressRef = useRef(0);
  const rafRef = useRef<number>(0);
  const sizeRef = useRef({ w: 0, h: 0, dpr: 1 });
  const lastDrawnFrameRef = useRef(-1);

  const [isLoaded, setIsLoaded] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  /* ─── Detect mobile (< 768px) for object-position logic ─── */
  const isMobileRef = useRef(false);
  useEffect(() => {
    const check = () => { isMobileRef.current = window.innerWidth < 768; };
    check();
    window.addEventListener("resize", check, { passive: true });
    return () => window.removeEventListener("resize", check);
  }, []);

  const getNearestLoadedFrameIndex = useCallback((targetFrameIndex: number) => {
    const loadedFrameIndexes = loadedFrameIndexesRef.current;
    if (loadedFrameIndexes.has(targetFrameIndex)) return targetFrameIndex;

    for (let offset = 1; offset < TOTAL_FRAMES; offset++) {
      const previousFrameIndex = targetFrameIndex - offset;
      if (previousFrameIndex >= 0 && loadedFrameIndexes.has(previousFrameIndex)) {
        return previousFrameIndex;
      }

      const nextFrameIndex = targetFrameIndex + offset;
      if (nextFrameIndex < TOTAL_FRAMES && loadedFrameIndexes.has(nextFrameIndex)) {
        return nextFrameIndex;
      }
    }

    return null;
  }, []);

  /* ─── Canvas Draw: transparent frame assets over CSS background ─── */
  const drawFrame = useCallback((frameIndex: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const resolvedFrameIndex = getNearestLoadedFrameIndex(frameIndex);
    if (resolvedFrameIndex === null) return;

    const img = imagesRef.current[resolvedFrameIndex];
    if (!img || !img.complete || img.naturalWidth === 0) return;

    const dpr = window.devicePixelRatio || 1;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Resize canvas buffer only when viewport changes
    if (sizeRef.current.w !== vw || sizeRef.current.h !== vh || sizeRef.current.dpr !== dpr) {
      canvas.width = Math.round(vw * dpr);
      canvas.height = Math.round(vh * dpr);
      canvas.style.width = `${vw}px`;
      canvas.style.height = `${vh}px`;
      sizeRef.current = { w: vw, h: vh, dpr };
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Use "copy" composite to atomically replace canvas content in a single drawImage.
    // This eliminates the blank frame that clearRect + source-over produces when the
    // mobile compositor samples the canvas between the two operations.
    ctx.globalCompositeOperation = "copy";

    if (isMobileRef.current) {
      // True 'Contain' Scaling Math (Works universally on all devices)
      const scale = Math.min(vw / img.naturalWidth, vh / img.naturalHeight);
      const camera = getMobileCamera(scrollProgressRef.current);
      const drawWidth = img.naturalWidth * scale * camera.zoom;
      const drawHeight = img.naturalHeight * scale * camera.zoom;

      // Virtual mobile camera: pan/zoom the whole rendered sequence via drawImage destination rect.
      const centeredX = (vw - drawWidth) / 2;
      const overflowX = Math.max(0, drawWidth - vw);
      const drawX = centeredX + overflowX * camera.focusX;
      const centeredY = (vh - drawHeight) / 2;
      const safeLift = Math.min(vh * camera.focusY, Math.max(0, centeredY));
      const drawY = Math.max(0, centeredY - safeLift);

      // Draw the frame
      ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
    } else {
      // Desktop: standard cover fit
      const imgRatio = img.naturalWidth / img.naturalHeight;
      const canvasRatio = vw / vh;
      let drawW: number, drawH: number, drawX: number, drawY: number;

      if (canvasRatio > imgRatio) {
        drawW = vw;
        drawH = vw / imgRatio;
        drawX = 0;
        drawY = (vh - drawH) / 2;
      } else {
        drawH = vh;
        drawW = vh * imgRatio;
        drawX = (vw - drawW) / 2;
        drawY = 0;
      }

      ctx.drawImage(img, drawX, drawY, drawW, drawH);
    }

    ctx.globalCompositeOperation = "source-over";
    lastDrawnFrameRef.current = resolvedFrameIndex;
  }, [getNearestLoadedFrameIndex]);

  /* ─── Progressive Frame Loading ─── */
  useEffect(() => {
    let isCancelled = false;
    const images: HTMLImageElement[] = new Array(TOTAL_FRAMES);
    let startupLoadedCount = 0;

    imagesRef.current = images;
    loadedFrameIndexesRef.current = new Set();

    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none";

    const scheduleCurrentFrameDraw = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => drawFrame(currentFrameRef.current));
    };

    const loadFrame = (index: number, isStartupFrame = false) =>
      new Promise<boolean>((resolve) => {
        const img = new Image();
        img.setAttribute("fetchpriority", isStartupFrame ? "high" : "low");
        img.src = getFramePath(index);

        img.decode().then(() => {
          if (isCancelled) { resolve(false); return; }

          images[index] = img;
          loadedFrameIndexesRef.current.add(index);

          if (isStartupFrame) {
            startupLoadedCount++;
            setLoadProgress(Math.round((startupLoadedCount / STARTUP_FRAME_COUNT) * 100));
          } else {
            scheduleCurrentFrameDraw();
          }

          resolve(true);
        }).catch(() => {
          if (!isCancelled && isStartupFrame) {
            startupLoadedCount++;
            setLoadProgress(Math.round((startupLoadedCount / STARTUP_FRAME_COUNT) * 100));
          }
          resolve(false);
        });
      });

    const loadRemainingFrames = async () => {
      // Prioritize transition boundary frames so fast mobile scrolling
      // cannot outrun the background loader at phase transition points.
      // Phase 1→2 at progress ~0.32 (frame ~99), Phase 2→3 at ~0.64 (frame ~198).
      const transitionFrames = [
        ...Array.from({ length: 16 }, (_, i) => 90 + i),   // 90–105
        ...Array.from({ length: 21 }, (_, i) => 190 + i),  // 190–210
      ].filter((i) => !loadedFrameIndexesRef.current.has(i));

      await Promise.all(transitionFrames.map((i) => loadFrame(i)));

      // Then fill in all remaining frames sequentially, skipping already-loaded ones
      let nextFrameIndex = STARTUP_FRAME_COUNT;

      const worker = async () => {
        while (!isCancelled && nextFrameIndex < TOTAL_FRAMES) {
          const frameIndex = nextFrameIndex;
          nextFrameIndex++;
          if (loadedFrameIndexesRef.current.has(frameIndex)) continue;
          await loadFrame(frameIndex);
        }
      };

      await Promise.all(
        Array.from({ length: BACKGROUND_LOAD_CONCURRENCY }, () => worker())
      );
    };

    const loadStartupFrames = async () => {
      const startupFrameIndexes = Array.from(
        { length: STARTUP_FRAME_COUNT },
        (_, index) => index
      );

      await Promise.all(
        startupFrameIndexes.map((frameIndex) => loadFrame(frameIndex, true))
      );

      if (!isCancelled && getNearestLoadedFrameIndex(0) !== null) {
        setLoadProgress(100);
        setIsLoaded(true);
        requestAnimationFrame(() => {
          document.body.style.overflow = "";
          document.body.style.touchAction = "";
          drawFrame(0);
        });

        void loadRemainingFrames();
      }
    };

    void loadStartupFrames();

    return () => {
      isCancelled = true;
      document.body.style.overflow = "";
      document.body.style.touchAction = "";
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [drawFrame, getNearestLoadedFrameIndex]);

  /* ─── Scroll → Frame ─── */
  useMotionValueEvent(scrollYProgress, "change", (latest) => {
    if (!isLoaded) return;
    scrollProgressRef.current = latest;
    const frameIndex = Math.min(
      TOTAL_FRAMES - 1,
      Math.max(0, Math.floor(latest * (TOTAL_FRAMES - 1)))
    );
    currentFrameRef.current = frameIndex;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => drawFrame(frameIndex));
  });

  /* ─── Resize ─── */
  useEffect(() => {
    if (!isLoaded) return;
    let resizeRaf: number;
    const handleResize = () => {
      cancelAnimationFrame(resizeRaf);
      resizeRaf = requestAnimationFrame(() => drawFrame(currentFrameRef.current));
    };
    window.addEventListener("resize", handleResize, { passive: true });
    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(resizeRaf);
    };
  }, [isLoaded, drawFrame]);

  return (
    <>
      <LoadingScreen progress={loadProgress} isLoaded={isLoaded} />
      {isLoaded && <NavBar />}

      <div ref={containerRef} className="relative" style={{ height: "600vh" }}>
        <div className="scroll-sequence-sticky">
          {/* Static cinematic vignette behind the transparent frame sequence */}
          <div
            className="absolute inset-0 z-[15] pointer-events-none"
            style={{
              background:
                "radial-gradient(circle at 50% 44%, rgba(255,255,255,0.018) 0%, rgba(255,255,255,0.01) 34%, rgba(0,0,0,0.035) 72%, rgba(0,0,0,0.08) 100%)",
            }}
          />

          {/* Canvas — transparent, sits on top of the static background vignette */}
          <canvas
            ref={canvasRef}
            aria-hidden="true"
            className="absolute inset-0 w-full h-full z-20 pointer-events-none"
          />

        </div>
      </div>

      {/* HUD overlay - viewport-level layer, isolated from the sticky canvas scene */}
      {isLoaded && <HUDOverlay scrollYProgress={scrollYProgress} />}
      {isLoaded && <MobileScrollIndicator scrollYProgress={scrollYProgress} />}
    </>
  );
}
