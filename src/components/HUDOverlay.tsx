"use client";

import { motion, MotionValue, type Transition } from "framer-motion";
import { useState, useEffect } from "react";

interface HUDOverlayProps {
  scrollYProgress: MotionValue<number>;
}

type PhaseId = 1 | 2 | 3;
type ResponsiveText = string | { mobile: string; desktop: string };
type CopyEmphasis = "accent" | "subtle";
type CopyLine = string | Array<{ text: string; emphasis?: CopyEmphasis }>;
type ResponsiveCopy = CopyLine | { mobile: CopyLine; desktop: CopyLine };
type MobilePosition = "left" | "right" | "center";
type MobileAnchor = "torso" | "underCharacter";
type MobileCardSize = "side" | "center";
type DesktopPosition = "left" | "right" | "centerBottom";
type TextAlignment = "left" | "center";
type TimelineStartKey = "contentStart" | "headlineStart" | "descriptionStart" | "supportingStart";
type TimelineEndKey = "contentEnd" | "sceneEnd";

interface PhaseTimeline {
  sceneStart: number;
  contentStart: number;
  headlineStart: number;
  descriptionStart: number;
  supportingStart: number;
  contentEnd: number;
  sceneEnd: number;
}

interface PhaseConfig {
  id: PhaseId;
  eyebrow: ResponsiveText;
  title: CopyLine[];
  description: ResponsiveCopy;
  mobileLayout: {
    position: MobilePosition;
    verticalAnchor: MobileAnchor;
    cardSize: MobileCardSize;
    safeMargin: "default";
    textAlign: TextAlignment;
  };
  desktopLayout: {
    position: DesktopPosition;
    textAlign: TextAlignment;
  };
  timeline: PhaseTimeline;
  mobileTimeline?: PhaseTimeline;
  animation: PhaseAnimation;
  logos?: {
    mobileCompact: boolean;
    desktopCompact: boolean;
  };
  cta?: {
    href: string;
    label: string;
    spacingClass: string;
  };
}

interface PhaseAnimation {
  initialY: number;
  visibleY: number;
  hiddenY: number;
  transition: Transition;
}

type PhaseFrameTimeline = Record<keyof PhaseTimeline, number>;

const TOTAL_HERO_FRAMES = 310;

const frameToProgress = (frame: number) => frame / (TOTAL_HERO_FRAMES - 1);

const timelineFromFrames = (timeline: PhaseFrameTimeline): PhaseTimeline => ({
  sceneStart: frameToProgress(timeline.sceneStart),
  contentStart: frameToProgress(timeline.contentStart),
  headlineStart: frameToProgress(timeline.headlineStart),
  descriptionStart: frameToProgress(timeline.descriptionStart),
  supportingStart: frameToProgress(timeline.supportingStart),
  contentEnd: frameToProgress(timeline.contentEnd),
  sceneEnd: frameToProgress(timeline.sceneEnd),
});

const DEFAULT_PHASE_ANIMATION = {
  initialY: 12,
  visibleY: 0,
  hiddenY: 10,
  transition: {
    duration: 0.42,
    ease: [0.22, 1, 0.36, 1] as const,
  },
} satisfies PhaseAnimation;

const TIMING_OFFSETS = {
  eyebrowAfterCard: 0.012,
};

const TEXT_PRESENTATION = {
  eyebrowDelay: 0,
  headlineDelay: 0.08,
  headlineLineStagger: 0.08,
  supportingDelay: 0.16,
  toolNameStagger: 0.045,
  ctaDelay: 0.08,
};



const CARD_STYLES = {
  base: "z-[90] rounded-2xl bg-white/72 dark:bg-white/[0.11] backdrop-blur-[24px] border border-slate-300/60 dark:border-white/[0.16] shadow-[inset_0_1px_0_rgba(255,255,255,0.68),0_14px_34px_rgba(15,23,42,0.08)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_14px_34px_rgba(0,0,0,0.18)] transition-all duration-700 ease-in-out flex flex-col text-left pointer-events-auto",
  mobileSide: "w-[41vw] max-w-[180px] p-3.5",
  mobileSideShell: "w-[48vw] max-w-[230px]",
  mobileIconStrip: "w-[41vw] max-w-[180px] px-3 py-2.5",
  mobileCenter: "w-[84vw] max-w-[340px] p-4",
  desktopMetadata: "w-[360px] max-w-[360px] p-5",
  desktopIconStrip: "w-[360px] max-w-[360px] px-5 py-4",
  desktopEditorialShell: "w-[520px] max-w-[520px]",
  desktop: "w-[420px] max-w-[420px] p-8",
};

const MOBILE_SAFE_MARGIN_CLASSES = {
  default: {
    left: "left-[4vw]",
    right: "right-[4vw]",
  },
};

const MOBILE_VERTICAL_ANCHOR_CLASSES: Record<MobileAnchor, string> = {
  torso: "top-[33svh]",
  underCharacter: "top-[53svh]",
};

const MOBILE_POSITION_CLASSES: Record<MobilePosition, string> = {
  left: "absolute",
  right: "absolute",
  center: "absolute left-0 right-0 mx-auto",
};

const MOBILE_CARD_SIZE_CLASSES: Record<MobileCardSize, string> = {
  side: CARD_STYLES.mobileSide,
  center: CARD_STYLES.mobileCenter,
};

const MOBILE_ALIGNMENT_CLASSES: Record<TextAlignment, string> = {
  left: "",
  center: "items-center text-center",
};

const DESKTOP_LAYOUT_CLASSES: Record<DesktopPosition, string> = {
  left: "hidden md:flex absolute inset-0 items-center justify-start pl-[8%]",
  right: "hidden md:flex absolute inset-0 items-center justify-end pr-[8%]",
  centerBottom: "hidden md:block absolute left-0 right-0 bottom-[20vh] mx-auto w-[420px]",
};

const DESKTOP_ALIGNMENT_CLASSES: Record<TextAlignment, string> = {
  left: "",
  center: "items-center text-center",
};

const TYPOGRAPHY_CLASSES = {
  mobile: {
    side: {
      eyebrow: "text-[#008CFF] font-semibold tracking-[0.1em] uppercase text-[9px] mb-1",
      title: "text-[24px] font-extrabold text-[#111827] dark:text-[#F8FAFC] leading-[1.02] mb-1.5 tracking-[-0.01em] [word-spacing:0.02em] drop-shadow-[0_0_10px_rgba(17,24,39,0.04)] dark:drop-shadow-[0_0_10px_rgba(248,250,252,0.08)]",
      outsideTitle: "text-[24px] font-extrabold text-[#111827] dark:text-[#F8FAFC] leading-[1.02] mb-0 tracking-[-0.01em] [word-spacing:0.02em] drop-shadow-[0_0_10px_rgba(17,24,39,0.04)] dark:drop-shadow-[0_0_10px_rgba(248,250,252,0.08)]",
      description: "text-[rgba(17,24,39,0.72)] dark:text-[rgba(248,250,252,0.72)] text-[11px] leading-[1.38] tracking-[0.005em] [word-spacing:0.03em]",
    },
    center: {
      eyebrow: "text-[#008CFF] font-semibold tracking-[0.1em] uppercase text-[10px] mb-1.5",
      title: "text-3xl font-extrabold text-[#111827] dark:text-[#F8FAFC] leading-[1.05] mb-2 tracking-[-0.01em] [word-spacing:0.02em] drop-shadow-[0_0_12px_rgba(17,24,39,0.04)] dark:drop-shadow-[0_0_12px_rgba(248,250,252,0.08)]",
      outsideTitle: "text-3xl font-extrabold text-[#111827] dark:text-[#F8FAFC] leading-[1.05] mb-0 tracking-[-0.01em] [word-spacing:0.02em] drop-shadow-[0_0_12px_rgba(17,24,39,0.04)] dark:drop-shadow-[0_0_12px_rgba(248,250,252,0.08)]",
      description: "text-[rgba(17,24,39,0.72)] dark:text-[rgba(248,250,252,0.72)] text-[13px] leading-[1.42] tracking-[0.005em] [word-spacing:0.03em]",
    },
  },
  desktop: {
    eyebrow: "text-[#008CFF] font-semibold tracking-[0.1em] uppercase text-sm mb-1.5",
    title: "text-5xl font-extrabold text-[#111827] dark:text-[#F8FAFC] leading-[1.04] mb-2 tracking-[-0.01em] [word-spacing:0.02em] drop-shadow-[0_0_14px_rgba(17,24,39,0.04)] dark:drop-shadow-[0_0_14px_rgba(248,250,252,0.08)]",
    outsideTitle: "text-5xl font-extrabold text-[#111827] dark:text-[#F8FAFC] leading-[1.04] mb-0 tracking-[-0.01em] [word-spacing:0.02em] drop-shadow-[0_0_14px_rgba(17,24,39,0.04)] dark:drop-shadow-[0_0_14px_rgba(248,250,252,0.08)]",
    description: "text-[rgba(17,24,39,0.72)] dark:text-[rgba(248,250,252,0.72)] text-base leading-[1.45] tracking-[0.005em] [word-spacing:0.03em]",
    descriptionWithLogos: "text-[rgba(17,24,39,0.72)] dark:text-[rgba(248,250,252,0.72)] text-base leading-[1.45] tracking-[0.005em] [word-spacing:0.03em] mb-3",
  },
};

const PHASE_CONFIGS: PhaseConfig[] = [
  {
    id: 1,
    eyebrow: "HI, I'M KRISH",
    title: [
      "I edit videos",
      "people actually",
      [{ text: "finish watching", emphasis: "accent" }],
    ],
    description: [
      { text: "2+ years", emphasis: "accent" },
      { text: " editing for creators, founders, brands, and businesses." },
    ],
    mobileLayout: {
      position: "left",
      verticalAnchor: "torso",
      cardSize: "side",
      safeMargin: "default",
      textAlign: "left",
    },
    desktopLayout: {
      position: "left",
      textAlign: "left",
    },
    timeline: {
      sceneStart: 0,
      contentStart: 0,
      headlineStart: 0,
      descriptionStart: 0,
      supportingStart: 0,
      contentEnd: 0.32,
      sceneEnd: 0.35,
    },
    mobileTimeline: timelineFromFrames({
      sceneStart: 0,
      contentStart: 0,
      headlineStart: 0,
      descriptionStart: 0,
      supportingStart: 0,
      contentEnd: 70,
      sceneEnd: 80,
    }),
    animation: DEFAULT_PHASE_ANIMATION,
  },
  {
    id: 2,
    eyebrow: "",
    title: [
      [{ text: "Human creativity.", emphasis: "accent" }],
      [{ text: "AI acceleration", emphasis: "accent" }],
    ],
    description: [
      { text: "Powered by " },
      { text: "Premiere Pro", emphasis: "subtle" },
      { text: ", " },
      { text: "After Effects", emphasis: "subtle" },
      { text: ", " },
      { text: "Photoshop", emphasis: "subtle" },
      { text: ", " },
      { text: "ChatGPT", emphasis: "subtle" },
      { text: ", " },
      { text: "Claude", emphasis: "subtle" },
      { text: ", " },
      { text: "Gemini", emphasis: "subtle" },
      { text: ", and " },
      { text: "AI", emphasis: "subtle" },
      { text: "." },
    ],
    mobileLayout: {
      position: "right",
      verticalAnchor: "torso",
      cardSize: "side",
      safeMargin: "default",
      textAlign: "left",
    },
    desktopLayout: {
      position: "right",
      textAlign: "left",
    },
    timeline: {
      sceneStart: 0.32,
      contentStart: 0.32,
      headlineStart: 0.32,
      descriptionStart: 0.32,
      supportingStart: 0.32,
      contentEnd: 0.64,
      sceneEnd: 0.67,
    },
    mobileTimeline: timelineFromFrames({
      sceneStart: 70,
      contentStart: 70,
      headlineStart: 70,
      descriptionStart: 70,
      supportingStart: 70,
      contentEnd: 189,
      sceneEnd: 200,
    }),
    animation: DEFAULT_PHASE_ANIMATION,
    logos: {
      mobileCompact: true,
      desktopCompact: false,
    },
  },
  {
    id: 3,
    eyebrow: "",
    title: [
      "This is just the",
      [{ text: "introduction", emphasis: "accent" }],
    ],
    description: [
      { text: "The " },
      { text: "real story", emphasis: "accent" },
      { text: " starts below." },
    ],
    mobileLayout: {
      position: "center",
      verticalAnchor: "underCharacter",
      cardSize: "center",
      safeMargin: "default",
      textAlign: "center",
    },
    desktopLayout: {
      position: "centerBottom",
      textAlign: "center",
    },
    timeline: {
      sceneStart: 0.64,
      contentStart: 0.64,
      headlineStart: 0.67,
      descriptionStart: 0.71,
      supportingStart: 0.80,
      contentEnd: 1,
      sceneEnd: 1,
    },
    mobileTimeline: {
      sceneStart: 0.61,
      contentStart: 0.61,
      headlineStart: 0.64,
      descriptionStart: 0.68,
      supportingStart: 0.80,
      contentEnd: 1,
      sceneEnd: 1,
    },
    animation: DEFAULT_PHASE_ANIMATION,
    cta: {
      href: "/portfolio",
      label: "See My Work",
      spacingClass: "mt-5 md:mt-6",
    },
  },
];

const getResponsiveText = (text: ResponsiveText, viewport: "mobile" | "desktop") => {
  if (typeof text === "string") return text;
  return text[viewport];
};

const getResponsiveCopy = (copy: ResponsiveCopy, viewport: "mobile" | "desktop") => {
  if (typeof copy === "object" && !Array.isArray(copy) && "mobile" in copy) {
    return copy[viewport];
  }

  return copy;
};

const EMPHASIS_CLASSES: Record<"card" | "outside", Record<CopyEmphasis, string>> = {
  card: {
    accent: "text-[#0F172A] dark:text-white font-semibold tracking-[0.005em]",
    subtle: "text-[#0F172A] dark:text-white font-semibold tracking-[0.005em]",
  },
  outside: {
    accent: "text-[#0F172A] dark:text-white font-semibold tracking-[0.005em]",
    subtle: "text-[#0F172A] dark:text-white font-semibold tracking-[0.005em]",
  },
};

const renderCopyLine = (
  line: CopyLine,
  keyPrefix: string,
  options?: {
    staggerSubtle?: boolean;
    isVisible?: boolean;
    tone?: "card" | "outside";
  }
) => {
  if (typeof line === "string") return line;

  let subtleIndex = 0;
  const tone = options?.tone ?? "card";

  return line.map((segment, index) => (
    options?.staggerSubtle && segment.emphasis === "subtle" ? (
      <motion.span
        key={`${keyPrefix}-${index}`}
        className={EMPHASIS_CLASSES[tone].subtle}
        initial={{ opacity: 0, y: 2 }}
        animate={options.isVisible ? { opacity: 1, y: 0 } : { opacity: 0, y: 2 }}
        transition={{
          duration: 0.32,
          ease: [0.22, 1, 0.36, 1],
          delay: subtleIndex++ * TEXT_PRESENTATION.toolNameStagger,
        }}
      >
        {segment.text}
      </motion.span>
    ) : (
      <span
        key={`${keyPrefix}-${index}`}
        className={segment.emphasis ? EMPHASIS_CLASSES[tone][segment.emphasis] : undefined}
      >
        {segment.text}
      </span>
    )
  ));
};

const getMobilePositionClass = (layout: PhaseConfig["mobileLayout"]) => {
  const safeMargin = MOBILE_SAFE_MARGIN_CLASSES[layout.safeMargin];
  if (layout.position === "left") return `${MOBILE_POSITION_CLASSES.left} ${safeMargin.left}`;
  if (layout.position === "right") return `${MOBILE_POSITION_CLASSES.right} ${safeMargin.right}`;
  return MOBILE_POSITION_CLASSES.center;
};

const isVisibleInRange = (progress: number, start: number, end: number) => (
  progress >= start && progress <= end
);

const getSegmentVisibilityAnimation = (
  progress: number,
  start: number,
  holdEnd: number,
  fadeEnd: number,
  animation: PhaseAnimation = DEFAULT_PHASE_ANIMATION
) => {
  if (progress < start || progress > fadeEnd) {
    return {
      opacity: 0,
      y: animation.hiddenY,
    };
  }

  if (progress <= holdEnd || holdEnd >= fadeEnd) {
    return {
      opacity: 1,
      y: animation.visibleY,
    };
  }

  const exitProgress = (progress - holdEnd) / (fadeEnd - holdEnd);
  return {
    opacity: 1 - exitProgress,
    y: animation.visibleY + (animation.hiddenY - animation.visibleY) * exitProgress,
  };
};

const getTimelineVisibilityAnimation = (
  progress: number,
  timeline: PhaseTimeline,
  startKey: TimelineStartKey,
  animation: PhaseAnimation = DEFAULT_PHASE_ANIMATION,
  endKey: TimelineEndKey = "contentEnd"
) => {
  const isWithinScene = isVisibleInRange(progress, timeline.sceneStart, timeline.sceneEnd);
  const segmentAnimation = getSegmentVisibilityAnimation(
    progress,
    timeline[startKey],
    timeline[endKey],
    endKey === "contentEnd" ? timeline.sceneEnd : timeline[endKey],
    animation
  );

  return {
    opacity: isWithinScene ? segmentAnimation.opacity : 0,
    y: isWithinScene ? segmentAnimation.y : animation.hiddenY,
  };
};

const getTimelineVisibilityAnimationWithOffset = (
  progress: number,
  timeline: PhaseTimeline,
  startKey: TimelineStartKey,
  offset: number,
  animation: PhaseAnimation = DEFAULT_PHASE_ANIMATION,
  endKey: TimelineEndKey = "contentEnd"
) => {
  const isWithinScene = isVisibleInRange(progress, timeline.sceneStart, timeline.sceneEnd);
  const segmentAnimation = getSegmentVisibilityAnimation(
    progress,
    timeline[startKey] + offset,
    timeline[endKey],
    endKey === "contentEnd" ? timeline.sceneEnd : timeline[endKey],
    animation
  );

  return {
    opacity: isWithinScene ? segmentAnimation.opacity : 0,
    y: isWithinScene ? segmentAnimation.y : animation.hiddenY,
  };
};

const isTimelineSegmentVisible = (
  progress: number,
  timeline: PhaseTimeline,
  startKey: TimelineStartKey,
  endKey: TimelineEndKey = "contentEnd"
) => (
  isVisibleInRange(progress, timeline.sceneStart, timeline.sceneEnd) &&
  isVisibleInRange(progress, timeline[startKey], timeline[endKey])
);

const isInitiallyVisible = (
  timeline: PhaseTimeline,
  startKey: TimelineStartKey,
  offset = 0
) => timeline.sceneStart === 0 && timeline[startKey] + offset <= 0;

const getInitialAnimation = (animation: PhaseAnimation = DEFAULT_PHASE_ANIMATION, isVisible = false) => ({
  opacity: isVisible ? 1 : 0,
  y: isVisible ? animation.visibleY : animation.initialY,
});

const getTimelineInitialAnimation = (
  timeline: PhaseTimeline,
  startKey: TimelineStartKey,
  animation: PhaseAnimation = DEFAULT_PHASE_ANIMATION,
  offset = 0
) => getInitialAnimation(animation, isInitiallyVisible(timeline, startKey, offset));

const getPresentationTransition = (
  animation: PhaseAnimation,
  delay = 0
): Transition => ({
  ...animation.transition,
  delay,
});

const getEyebrowOffset = (timeline: PhaseTimeline) => (
  timeline.sceneStart === 0 ? 0 : TIMING_OFFSETS.eyebrowAfterCard
);

export default function HUDOverlay({ scrollYProgress }: HUDOverlayProps) {
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    return scrollYProgress.on("change", (v) => {
      setScrollProgress(v);
    });
  }, [scrollYProgress]);

  const renderPortfolioButton = (cta: NonNullable<PhaseConfig["cta"]>) => (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        window.location.href = cta.href;
      }}
      style={{ fontFamily: "'General Sans', sans-serif" }}
      className={`${cta.spacingClass} self-center inline-flex items-center gap-2 px-5 md:px-6 py-2.5 bg-[#008CFF] hover:bg-[#0070cc] text-white text-sm md:text-base font-bold rounded-full shadow-[0_4px_20px_rgba(0,140,255,0.5)] active:bg-[#005fa8] cursor-pointer whitespace-nowrap select-none pointer-events-auto`}
    >
      {cta.label} &rarr;
    </button>
  );

  const renderTitle = (
    config: PhaseConfig,
    className: string,
    timeline = config.timeline,
    tone: "card" | "outside" = "card"
  ) => (
    <motion.h1
      style={{ fontFamily: "'Clash Display', sans-serif" }}
      className={className}
      initial={getInitialAnimation(config.animation, false)}
      animate={getTimelineVisibilityAnimation(
        scrollProgress,
        timeline,
        "headlineStart",
        config.animation
      )}
      transition={getPresentationTransition(config.animation, TEXT_PRESENTATION.headlineDelay)}
    >
      {config.title.map((line, index) => (
        <motion.span
          key={`title-line-${config.id}-${index}`}
          className="inline-block"
          initial={{ opacity: 0, y: 4 }}
          animate={
            isTimelineSegmentVisible(scrollProgress, timeline, "headlineStart")
              ? { opacity: 1, y: 0 }
              : { opacity: 0, y: 4 }
          }
          transition={getPresentationTransition(
            config.animation,
            TEXT_PRESENTATION.headlineDelay + index * TEXT_PRESENTATION.headlineLineStagger
          )}
        >
          {renderCopyLine(line, `title-${config.id}-${index}`, { tone })}
          {index < config.title.length - 1 && <br />}
        </motion.span>
      ))}
    </motion.h1>
  );

  const renderMobileCard = (config: PhaseConfig) => {
    const layout = config.mobileLayout;
    const timeline = config.mobileTimeline ?? config.timeline;
    const typography = TYPOGRAPHY_CLASSES.mobile[layout.cardSize];
    const descriptionClass = `${typography.description}${config.logos ? " mb-2" : ""}`;
    const eyebrowOffset = getEyebrowOffset(timeline);
    const eyebrowText = getResponsiveText(config.eyebrow, "mobile");
    const description = getResponsiveCopy(config.description, "mobile");
    const isDescriptionVisible = isTimelineSegmentVisible(scrollProgress, timeline, "descriptionStart");
    const shouldStaggerToolNames = config.id === 2;
    const isEditorialPhase = config.id === 1 || config.id === 2;
    const editorialStackClass = config.id === 2 ? "-mt-4 gap-1.5" : "gap-2";
    const mobileContentOffsetClass = config.id === 3 ? "-mt-7" : "";

    const eyebrowElement = eyebrowText && (
      <motion.h4
        className={config.id === 1 ? "text-[#0EA5E9] font-extrabold tracking-[0.15em] uppercase text-[11px] mb-4 drop-shadow-sm" : typography.eyebrow}
        style={{
          fontFamily: "'General Sans', sans-serif",
        }}
        initial={getInitialAnimation(config.animation, false)}
        animate={getTimelineVisibilityAnimationWithOffset(
          scrollProgress,
          timeline,
          "contentStart",
          eyebrowOffset,
          config.animation
        )}
        transition={getPresentationTransition(config.animation, TEXT_PRESENTATION.eyebrowDelay)}
      >
        {eyebrowText}
      </motion.h4>
    );

    const descriptionElement = (
      <motion.p
        style={{ fontFamily: "'General Sans', sans-serif" }}
        className={descriptionClass}
        initial={getInitialAnimation(config.animation, false)}
        animate={getTimelineVisibilityAnimation(
          scrollProgress,
          timeline,
          "descriptionStart",
          config.animation
        )}
        transition={getPresentationTransition(config.animation, TEXT_PRESENTATION.supportingDelay)}
      >
        {renderCopyLine(description, `mobile-description-${config.id}`, {
          staggerSubtle: shouldStaggerToolNames,
          isVisible: isDescriptionVisible,
        })}
      </motion.p>
    );

    if (isEditorialPhase) {
      return (
        <div
          className={`${CARD_STYLES.mobileSideShell} ${getMobilePositionClass(layout)} ${MOBILE_VERTICAL_ANCHOR_CLASSES[layout.verticalAnchor]} md:hidden flex flex-col items-start ${editorialStackClass} pointer-events-none`}
        >
          {config.id === 1 && eyebrowElement}
          {renderTitle(config, typography.outsideTitle, timeline, "outside")}
          <div className={`${CARD_STYLES.base} ${CARD_STYLES.mobileSide}`}>
            {config.id !== 1 && eyebrowElement}
            {descriptionElement}
          </div>
          {config.logos && (
            <motion.div
              initial={getTimelineInitialAnimation(timeline, "supportingStart", config.animation)}
              animate={getTimelineVisibilityAnimation(
                scrollProgress,
                timeline,
                "supportingStart",
                config.animation
              )}
              transition={config.animation.transition}
              className={`${CARD_STYLES.base} ${CARD_STYLES.mobileIconStrip}`}
            >
              <FloatingLogos
                compact={config.logos.mobileCompact}
                bare
                isVisible={isTimelineSegmentVisible(scrollProgress, timeline, "supportingStart")}
              />
            </motion.div>
          )}
        </div>
      );
    }

    return (
      <div
        className={`${CARD_STYLES.base} ${MOBILE_CARD_SIZE_CLASSES[layout.cardSize]} ${getMobilePositionClass(layout)} ${MOBILE_VERTICAL_ANCHOR_CLASSES[layout.verticalAnchor]} ${mobileContentOffsetClass} ${MOBILE_ALIGNMENT_CLASSES[layout.textAlign]} md:hidden`}
      >
        {eyebrowElement}
        {renderTitle(config, typography.title, timeline)}
        {descriptionElement}
        {config.logos && (
          <motion.div
            initial={getTimelineInitialAnimation(timeline, "supportingStart", config.animation)}
            animate={getTimelineVisibilityAnimation(
              scrollProgress,
              timeline,
              "supportingStart",
              config.animation
            )}
            transition={config.animation.transition}
          >
            <FloatingLogos
              compact={config.logos.mobileCompact}
              isVisible={isTimelineSegmentVisible(scrollProgress, timeline, "supportingStart")}
            />
          </motion.div>
        )}
        {config.cta && (
          <motion.div
            initial={{ ...getInitialAnimation(config.animation, false), scale: 0.96 }}
            animate={{
              ...getTimelineVisibilityAnimation(
                scrollProgress,
                timeline,
                "supportingStart",
                config.animation
              ),
              scale: isTimelineSegmentVisible(scrollProgress, timeline, "supportingStart") ? 1 : 0.96,
            }}
            transition={getPresentationTransition(config.animation, TEXT_PRESENTATION.ctaDelay)}
          >
            {renderPortfolioButton(config.cta)}
          </motion.div>
        )}
      </div>
    );
  };

  const renderDesktopCard = (config: PhaseConfig) => {
    const eyebrowOffset = getEyebrowOffset(config.timeline);
    const eyebrowText = getResponsiveText(config.eyebrow, "desktop");
    const description = getResponsiveCopy(config.description, "desktop");
    const isDescriptionVisible = isTimelineSegmentVisible(scrollProgress, config.timeline, "descriptionStart");
    const shouldStaggerToolNames = config.id === 2;
    const isEditorialPhase = config.id === 1 || config.id === 2;
    const editorialStackClass = config.id === 2 ? "-mt-7 gap-3" : "gap-4";
    const desktopContentOffsetClass = config.id === 3 ? "-mt-7" : "";

    const eyebrowElement = eyebrowText && (
      <motion.h4
        className={config.id === 1 ? "text-[#0EA5E9] font-extrabold tracking-[0.15em] uppercase text-[17.5px] mb-4 drop-shadow-sm" : TYPOGRAPHY_CLASSES.desktop.eyebrow}
        style={{
          fontFamily: "'General Sans', sans-serif",
        }}
        initial={getInitialAnimation(config.animation, false)}
        animate={getTimelineVisibilityAnimationWithOffset(
          scrollProgress,
          config.timeline,
          "contentStart",
          eyebrowOffset,
          config.animation
        )}
        transition={getPresentationTransition(config.animation, TEXT_PRESENTATION.eyebrowDelay)}
      >
        {eyebrowText}
      </motion.h4>
    );

    const descriptionElement = (
      <motion.p
        style={{ fontFamily: "'General Sans', sans-serif" }}
        className={config.logos ? TYPOGRAPHY_CLASSES.desktop.descriptionWithLogos : TYPOGRAPHY_CLASSES.desktop.description}
        initial={getInitialAnimation(config.animation, false)}
        animate={getTimelineVisibilityAnimation(
          scrollProgress,
          config.timeline,
          "descriptionStart",
          config.animation
        )}
        transition={getPresentationTransition(config.animation, TEXT_PRESENTATION.supportingDelay)}
      >
        {renderCopyLine(description, `desktop-description-${config.id}`, {
          staggerSubtle: shouldStaggerToolNames,
          isVisible: isDescriptionVisible,
        })}
      </motion.p>
    );

    if (isEditorialPhase) {
      return (
        <div className={DESKTOP_LAYOUT_CLASSES[config.desktopLayout.position]}>
          <div className={`${CARD_STYLES.desktopEditorialShell} flex flex-col items-start ${editorialStackClass}`}>
            {config.id === 1 && eyebrowElement}
            {renderTitle(config, TYPOGRAPHY_CLASSES.desktop.outsideTitle, config.timeline, "outside")}
            <div className={`${CARD_STYLES.base} ${CARD_STYLES.desktopMetadata}`}>
              {config.id !== 1 && eyebrowElement}
              {descriptionElement}
            </div>
            {config.logos && (
              <motion.div
                initial={getTimelineInitialAnimation(config.timeline, "supportingStart", config.animation)}
                animate={getTimelineVisibilityAnimation(
                  scrollProgress,
                  config.timeline,
                  "supportingStart",
                  config.animation
                )}
                transition={config.animation.transition}
                className={`${CARD_STYLES.base} ${CARD_STYLES.desktopIconStrip}`}
              >
                <FloatingLogos
                  compact={config.logos.desktopCompact}
                  bare
                  isVisible={isTimelineSegmentVisible(scrollProgress, config.timeline, "supportingStart")}
                />
              </motion.div>
            )}
          </div>
        </div>
      );
    }

    return (
    <div className={DESKTOP_LAYOUT_CLASSES[config.desktopLayout.position]}>
      <div className={`${CARD_STYLES.base} ${CARD_STYLES.desktop} ${desktopContentOffsetClass} ${DESKTOP_ALIGNMENT_CLASSES[config.desktopLayout.textAlign]}`}>
        {eyebrowElement}
        {renderTitle(config, TYPOGRAPHY_CLASSES.desktop.title)}
        {descriptionElement}
        {config.logos && (
          <motion.div
            initial={getTimelineInitialAnimation(config.timeline, "supportingStart", config.animation)}
            animate={getTimelineVisibilityAnimation(
              scrollProgress,
              config.timeline,
              "supportingStart",
              config.animation
            )}
            transition={config.animation.transition}
          >
            <FloatingLogos
              compact={config.logos.desktopCompact}
              isVisible={isTimelineSegmentVisible(scrollProgress, config.timeline, "supportingStart")}
            />
          </motion.div>
        )}
        {config.cta && (
          <motion.div
            initial={{ ...getInitialAnimation(config.animation, false), scale: 0.96 }}
            animate={{
              ...getTimelineVisibilityAnimation(
                scrollProgress,
                config.timeline,
                "supportingStart",
                config.animation
              ),
              scale: isTimelineSegmentVisible(scrollProgress, config.timeline, "supportingStart") ? 1 : 0.96,
            }}
            transition={getPresentationTransition(config.animation, TEXT_PRESENTATION.ctaDelay)}
          >
            {renderPortfolioButton(config.cta)}
          </motion.div>
        )}
      </div>
    </div>
    );
  };

  return (
    <div data-hud-overlay className="fixed inset-0 z-[999999] pointer-events-none select-none overflow-visible">
      {PHASE_CONFIGS.map((config) => {
        const mobileTimeline = config.mobileTimeline ?? config.timeline;

        return (
          <div key={config.id} className="absolute inset-0 pointer-events-none">
            <motion.div
              initial={getTimelineInitialAnimation(mobileTimeline, "contentStart", config.animation)}
              animate={getTimelineVisibilityAnimation(
                scrollProgress,
                mobileTimeline,
                "contentStart",
                config.animation
              )}
              transition={config.animation.transition}
              className="absolute inset-0 pointer-events-none md:hidden"
            >
              {renderMobileCard(config)}
            </motion.div>
            <motion.div
              initial={getTimelineInitialAnimation(config.timeline, "contentStart", config.animation)}
              animate={getTimelineVisibilityAnimation(
                scrollProgress,
                config.timeline,
                "contentStart",
                config.animation
              )}
              transition={config.animation.transition}
              className="absolute inset-0 pointer-events-none hidden md:block"
            >
              {renderDesktopCard(config)}
            </motion.div>
          </div>
        );
      })}
    </div>
  );
}

export const FloatingLogos = ({
  compact = false,
  isVisible = true,
  bare = false,
}: {
  compact?: boolean;
  isVisible?: boolean;
  bare?: boolean;
}) => {
  const floatAnimation = {
    y: ["0%", "-20%", "0%"]
  };

  const logos = [
    { src: "/logos/pr.svg.webp", alt: "Premiere" },
    { src: "/logos/ae.svg.webp", alt: "After Effects" },
    { src: "/logos/ps.svg.webp", alt: "Photoshop" },
    { src: "/logos/gemini.png.webp", alt: "Gemini" },
    { src: "/logos/chatgpt.svg.webp", alt: "ChatGPT" },
    { src: "/logos/claude.svg.webp", alt: "Claude" },
  ];

  return (
    <div className={`${bare ? "" : compact ? "pt-2 mt-1.5 border-t border-black/10 dark:border-white/10" : "pt-4 mt-2 border-t border-black/10 dark:border-white/10"} flex flex-nowrap items-center justify-between w-full`}>
      {logos.map((logo, index) => (
        <motion.div 
          key={index}
          initial={{ opacity: 0, y: "0%" }}
          animate={isVisible ? { opacity: 1, ...floatAnimation } : { opacity: 0, y: "0%" }}
          transition={
            isVisible
              ? {
                  opacity: { delay: index * 0.08, duration: 0.35, ease: "easeOut" },
                  y: { delay: index * 0.08 + 0.2, duration: 3, ease: "easeInOut" as const, repeat: Infinity },
                }
              : { duration: 0.2, ease: "easeOut" }
          }
          className={`${compact ? "w-3.5 h-3.5" : "w-6 h-6 md:w-8 md:h-8"} relative shrink-0 drop-shadow-[0_1px_4px_rgba(15,23,42,0.16)] dark:drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logo.src} alt={logo.alt} loading="lazy" decoding="async" className="w-full h-full object-contain" onError={(e) => e.currentTarget.style.display = 'none'} />
        </motion.div>
      ))}
    </div>
  );
};

