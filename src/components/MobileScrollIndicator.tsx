"use client";

import { motion, MotionValue, useMotionValueEvent, useReducedMotion, useTransform } from "framer-motion";
import { useState } from "react";

interface MobileScrollIndicatorProps {
  scrollYProgress: MotionValue<number>;
}

const FADE_START = 0.02;
const FADE_END = 0.095;
const IDLE_ANIMATION_END = 0.01;

export default function MobileScrollIndicator({
  scrollYProgress,
}: MobileScrollIndicatorProps) {
  const opacity = useTransform(
    scrollYProgress,
    [0, FADE_START, FADE_END, 1],
    [1, 1, 0, 0]
  );
  
  const [shouldAnimate, setShouldAnimate] = useState(true);
  const prefersReducedMotion = useReducedMotion();

  useMotionValueEvent(scrollYProgress, "change", (latest) => {
    const isIdle = latest <= IDLE_ANIMATION_END;
    if (shouldAnimate !== (!prefersReducedMotion && isIdle)) {
      setShouldAnimate(!prefersReducedMotion && isIdle);
    }
  });

  return (
    <motion.div
      aria-hidden="true"
      style={{ opacity }}
      className="fixed left-1/2 bottom-[calc(22px+env(safe-area-inset-bottom))] z-[999998] hidden -translate-x-1/2 md:hidden pointer-events-none select-none max-md:block"
    >
      <motion.div
        animate={shouldAnimate ? { opacity: [0.58, 0.78, 0.58], y: [0, 3, 0] } : { opacity: 0.66, y: 0 }}
        transition={
          shouldAnimate
            ? { duration: 2.8, ease: "easeInOut", repeat: Infinity }
            : { duration: 0.3, ease: "easeOut" }
        }
        className="flex h-10 w-5 flex-col items-center justify-end text-neutral-950/45 dark:text-white/45"
      >
        <span className="h-7 w-px rounded-full bg-current" />
        <span className="mt-1 h-2 w-2 rotate-45 border-b border-r border-current" />
      </motion.div>
    </motion.div>
  );
}
