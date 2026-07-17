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

/* ─── Mobile Performance Constants ─── */
const MOBILE_MAX_DPR = 1.5;           // Cap canvas resolution (iPhone 3x → 1.5x = 4x fewer pixels)
const MOBILE_LOAD_CONCURRENCY = 4;    // Reduced background concurrency on mobile

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

/* Pre-allocated camera result object — avoids creating a new object on every
   scroll frame, eliminating a major source of GC pressure during scrolling. */
const _cameraResult = { zoom: 1, focusX: 0, focusY: 0 };

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

  _cameraResult.zoom = lerp(currentScene.zoom, nextScene.zoom, amount);
  _cameraResult.focusX = lerp(
    MOBILE_CAMERA_FOCUS_X[currentScene.focus],
    MOBILE_CAMERA_FOCUS_X[nextScene.focus],
    amount
  );
  _cameraResult.focusY = lerp(
    MOBILE_CAMERA_FOCUS_Y[currentScene.focusY],
    MOBILE_CAMERA_FOCUS_Y[nextScene.focusY],
    amount
  );
  return _cameraResult;
};



/** frame_000000.webp → frame_000309.webp */
function getFramePath(index: number): string {
  return `/frames/frame_${String(index).padStart(6, "0")}.webp`;
}

export default function ScrollSequence() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imagesRef = useRef<(HTMLImageElement | null)[]>([]);
  const loadedFrameIndexesRef = useRef<Set<number>>(new Set());
  const currentFrameRef = useRef(0);
  const scrollProgressRef = useRef(0);
  const rafRef = useRef<number>(0);
  const sizeRef = useRef({ w: 0, h: 0, dpr: 1 });
  const lastDrawnFrameRef = useRef(-1);

  /* ─── Mobile video refs ─── */
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoDurationRef = useRef(0);
  const lastSeekTimeRef = useRef(-1);

  /* ─── Desktop performance refs ─── */
  const loadFrameFnRef = useRef<((index: number) => Promise<boolean>) | null>(null);
  const loadingInProgressRef = useRef<Set<number>>(new Set());

  const [isLoaded, setIsLoaded] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  /* ─── Detect mobile (< 768px) for object-position logic ─── */
  const isMobileRef = useRef(false);
  const initialMobileVhRef = useRef(0);
  useEffect(() => {
    const check = () => { 
      const isMobile = window.innerWidth < 768;
      isMobileRef.current = isMobile; 
      if (isMobile && initialMobileVhRef.current === 0) {
        initialMobileVhRef.current = window.innerHeight;
      }
    };
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

    let sourceWidth = 0;
    let sourceHeight = 0;
    let drawableSource: CanvasImageSource | null = null;

    if (isMobileRef.current) {
      const video = videoRef.current;
      if (!video || video.readyState < 2) return;
      sourceWidth = video.videoWidth;
      sourceHeight = video.videoHeight;
      drawableSource = video;
      
      // We don't skip redraws strictly based on frameIndex for video, 
      // because currentTime seeks might trigger multiple subtle updates.
    } else {
      const resolvedFrameIndex = getNearestLoadedFrameIndex(frameIndex);
      if (resolvedFrameIndex === null) return;
      if (resolvedFrameIndex === lastDrawnFrameRef.current) return;

      const img = imagesRef.current[resolvedFrameIndex];
      if (!img || !img.complete || img.naturalWidth === 0) return;
      
      sourceWidth = img.naturalWidth;
      sourceHeight = img.naturalHeight;
      drawableSource = img;
      lastDrawnFrameRef.current = resolvedFrameIndex;
    }

    if (!drawableSource || sourceWidth === 0) return;

    /* DPR: cap on mobile to reduce canvas buffer size.
       iPhone 3x DPR → 1.5x = 4x fewer pixels per drawImage call. */
    const rawDpr = window.devicePixelRatio || 1;
    const dpr = isMobileRef.current ? Math.min(rawDpr, MOBILE_MAX_DPR) : rawDpr;
    const vw = window.innerWidth;
    const vh = isMobileRef.current && initialMobileVhRef.current > 0 ? initialMobileVhRef.current : window.innerHeight;

    /* Resize canvas buffer only when viewport or effective DPR changes */
    if (sizeRef.current.w !== vw || sizeRef.current.h !== vh || sizeRef.current.dpr !== dpr) {
      canvas.width = Math.round(vw * dpr);
      canvas.height = Math.round(vh * dpr);
      canvas.style.width = `${vw}px`;
      canvas.style.height = `${vh}px`;
      sizeRef.current = { w: vw, h: vh, dpr };
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    /* "copy" composite atomically replaces canvas content in a single drawImage.
       This prevents the blank frame that clearRect + source-over produces when
       the mobile compositor samples the canvas between the two operations. */
    ctx.globalCompositeOperation = "copy";

    if (isMobileRef.current) {
      // True 'Contain' Scaling Math (Works universally on all devices)
      const scale = Math.min(vw / sourceWidth, vh / sourceHeight);
      const camera = getMobileCamera(scrollProgressRef.current);
      const drawWidth = sourceWidth * scale * camera.zoom;
      const drawHeight = sourceHeight * scale * camera.zoom;

      // Virtual mobile camera: pan/zoom the whole rendered sequence via drawImage destination rect.
      const centeredX = (vw - drawWidth) / 2;
      const overflowX = Math.max(0, drawWidth - vw);
      const drawX = centeredX + overflowX * camera.focusX;
      const centeredY = (vh - drawHeight) / 2;
      const safeLift = Math.min(vh * camera.focusY, Math.max(0, centeredY));
      const drawY = Math.max(0, centeredY - safeLift);

      // Draw the frame with rounded coordinates to prevent sub-pixel jitter
      ctx.drawImage(
        drawableSource, 
        Math.round(drawX), 
        Math.round(drawY), 
        Math.round(drawWidth), 
        Math.round(drawHeight)
      );
    } else {
      // Desktop: standard cover fit
      const imgRatio = sourceWidth / sourceHeight;
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

      ctx.drawImage(drawableSource, drawX, drawY, drawW, drawH);
    }

    ctx.globalCompositeOperation = "source-over";
  }, [getNearestLoadedFrameIndex]);

  /* ─── Progressive Frame Loading ─── */
  useEffect(() => {
    let isCancelled = false;
    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none";

    if (isMobileRef.current) {
      /* ─── Mobile: MP4 Video Loading ─── */
      const video = videoRef.current;
      if (!video) return;

      const handleLoadedMetadata = () => {
        if (isCancelled) return;
        videoDurationRef.current = video.duration;
      };

      const handleCanPlayThrough = () => {
        if (isCancelled) return;
        setLoadProgress(100);
        setIsLoaded(true);
        requestAnimationFrame(() => {
          document.body.style.overflow = "";
          document.body.style.touchAction = "";
          drawFrame(0);
        });
      };

      const handleSeeked = () => {
        if (isCancelled || !isLoaded) return;
        drawFrame(currentFrameRef.current);
      };

      video.addEventListener("loadedmetadata", handleLoadedMetadata);
      video.addEventListener("canplaythrough", handleCanPlayThrough);
      video.addEventListener("seeked", handleSeeked);

      // Fallback if events already fired
      if (video.readyState >= 1) handleLoadedMetadata();
      if (video.readyState >= 3) handleCanPlayThrough();

      return () => {
        isCancelled = true;
        video.removeEventListener("loadedmetadata", handleLoadedMetadata);
        video.removeEventListener("canplaythrough", handleCanPlayThrough);
        video.removeEventListener("seeked", handleSeeked);
        document.body.style.overflow = "";
        document.body.style.touchAction = "";
      };
    }

    /* ─── Desktop: 310 Image Loading ─── */
    const images: (HTMLImageElement | null)[] = new Array(TOTAL_FRAMES).fill(null);
    let startupLoadedCount = 0;

    imagesRef.current = images;
    loadedFrameIndexesRef.current = new Set();

    const scheduleCurrentFrameDraw = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = 0;
        drawFrame(currentFrameRef.current);
      });
    };

    const loadFrame = (index: number, isStartupFrame = false) =>
      new Promise<boolean>((resolve) => {
        /* Guard: skip if already loaded or currently loading */
        if (loadedFrameIndexesRef.current.has(index)) { resolve(true); return; }
        if (loadingInProgressRef.current.has(index)) { resolve(true); return; }
        loadingInProgressRef.current.add(index);

        const img = new Image();
        img.setAttribute("fetchpriority", isStartupFrame ? "high" : "low");
        img.src = getFramePath(index);

        img.decode().then(() => {
          loadingInProgressRef.current.delete(index);
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
          loadingInProgressRef.current.delete(index);
          if (!isCancelled && isStartupFrame) {
            startupLoadedCount++;
            setLoadProgress(Math.round((startupLoadedCount / STARTUP_FRAME_COUNT) * 100));
          }
          resolve(false);
        });
      });

    /* Expose loadFrame for demand-based reloading of evicted frames */
    loadFrameFnRef.current = (index: number) => loadFrame(index);

    const loadRemainingFrames = async () => {
      /* 1. Transition boundary frames — highest priority after startup */
      const transitionFrames = [
        ...Array.from({ length: 16 }, (_, i) => 90 + i),   // 90–105
        ...Array.from({ length: 21 }, (_, i) => 190 + i),  // 190–210
      ].filter((i) => !loadedFrameIndexesRef.current.has(i));

      await Promise.all(transitionFrames.map((i) => loadFrame(i)));

      /* 2. Fill remaining frames sequentially, skipping already-loaded ones.
            On mobile, use reduced concurrency to lower memory pressure. */
      const concurrency = isMobileRef.current
        ? MOBILE_LOAD_CONCURRENCY
        : BACKGROUND_LOAD_CONCURRENCY;
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
        Array.from({ length: concurrency }, () => worker())
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

    const loadingSet = loadingInProgressRef.current;
    return () => {
      isCancelled = true;
      loadFrameFnRef.current = null;
      loadingSet.clear();
      document.body.style.overflow = "";
      document.body.style.touchAction = "";
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isLoaded, drawFrame, getNearestLoadedFrameIndex]);

  /* ─── Scroll → Frame ─── */
  useMotionValueEvent(scrollYProgress, "change", (latest) => {
    if (!isLoaded) return;
    scrollProgressRef.current = latest;

    if (isMobileRef.current) {
      const video = videoRef.current;
      if (video && videoDurationRef.current > 0) {
        // We use Math.max(0.001) because currentTime = 0 on some mobile browsers can show a blank frame
        const targetTime = Math.max(0.001, latest * videoDurationRef.current);
        
        // Only seek if the time has changed meaningfully (prevent micro-jitter)
        if (Math.abs(targetTime - lastSeekTimeRef.current) > 0.01) {
          video.currentTime = targetTime;
          lastSeekTimeRef.current = targetTime;
        }
      }
    } else {
      const frameIndex = Math.min(
        TOTAL_FRAMES - 1,
        Math.max(0, Math.floor(latest * (TOTAL_FRAMES - 1)))
      );
      currentFrameRef.current = frameIndex;

      /* Skip entirely if same frame is already displayed */
      if (frameIndex === lastDrawnFrameRef.current) return;

      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = 0;
        drawFrame(currentFrameRef.current);
      });
    }
  });

  /* ─── Resize ─── */
  useEffect(() => {
    if (!isLoaded) return;
    let resizeRaf: number;
    const handleResize = () => {
      cancelAnimationFrame(resizeRaf);
      /* Force redraw on resize even if frame index hasn't changed,
         since the canvas buffer dimensions or DPR may have changed. */
      lastDrawnFrameRef.current = -1;
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

          {/* Hidden video element exclusively for mobile rendering */}
          <video
            ref={videoRef}
            src="/hero-sequence.mp4"
            preload="auto"
            playsInline
            muted
            className="hidden"
          />

        </div>
      </div>

      {/* HUD overlay - viewport-level layer, isolated from the sticky canvas scene */}
      {isLoaded && <HUDOverlay scrollYProgress={scrollYProgress} />}
      {isLoaded && <MobileScrollIndicator scrollYProgress={scrollYProgress} />}
    </>
  );
}
