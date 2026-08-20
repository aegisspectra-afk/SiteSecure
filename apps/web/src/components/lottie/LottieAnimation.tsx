import { cn } from "@site-secure/ui";
import { memo, useEffect, useRef, useState } from "react";
import { useReducedMotion } from "../../lib/use-reduced-motion";
import { LOTTIE_ANIMATIONS, type LottieName } from "./lottie-registry";

type AnimationItem = {
  play: () => void;
  pause: () => void;
  stop: () => void;
  destroy: () => void;
  setSpeed: (speed: number) => void;
  goToAndStop: (value: number, isFrame: boolean) => void;
  addEventListener: (name: string, cb: () => void) => void;
  removeEventListener: (name: string, cb: () => void) => void;
  getDuration: (inFrames?: boolean) => number;
  totalFrames: number;
};

type LottiePlayer = {
  loadAnimation: (params: {
    container: Element;
    renderer: "svg";
    loop: boolean;
    autoplay: boolean;
    animationData: object;
    rendererSettings?: { progressiveLoad?: boolean; preserveAspectRatio?: string };
  }) => AnimationItem;
};

let playerPromise: Promise<LottiePlayer> | null = null;

function loadPlayer() {
  playerPromise ??= import("lottie-web/build/player/lottie_light").then(
    (mod) => (mod.default ?? mod) as LottiePlayer,
  );
  return playerPromise;
}

function unwrapAnimationData(mod: unknown): object {
  if (mod && typeof mod === "object" && "default" in mod) {
    const value = (mod as { default: unknown }).default;
    if (value && typeof value === "object") return value;
  }
  if (mod && typeof mod === "object") return mod;
  throw new Error("invalid lottie");
}

export type LottieAnimationProps = {
  name: LottieName;
  width?: number;
  height?: number;
  size?: number;
  autoplay?: boolean;
  loop?: boolean;
  speed?: number;
  playOnHover?: boolean;
  className?: string;
  label?: string;
  pauseWhenHidden?: boolean;
};

export const LottieAnimation = memo(function LottieAnimation({
  name,
  width,
  height,
  size = 64,
  autoplay = true,
  loop,
  speed = 1,
  playOnHover = false,
  className,
  label,
  pauseWhenHidden = true,
}: LottieAnimationProps) {
  const spec = LOTTIE_ANIMATIONS[name];
  const w = width ?? size;
  const h = height ?? size;
  const shouldLoop = loop ?? spec.defaultLoop;
  const reduced = useReducedMotion();
  const hostRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<AnimationItem | null>(null);
  const completedRef = useRef(false);
  const [visible, setVisible] = useState(!pauseWhenHidden);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const node = hostRef.current;
    if (!pauseWhenHidden || !node) {
      setVisible(true);
      return;
    }
    if (typeof IntersectionObserver !== "function") {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { rootMargin: "40px", threshold: 0.05 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [pauseWhenHidden]);

  useEffect(() => {
    const node = hostRef.current;
    if (!node || !visible || failed) return;
    let cancelled = false;
    let anim: AnimationItem | null = null;
    completedRef.current = false;
    const onComplete = () => {
      completedRef.current = true;
    };

    void (async () => {
      try {
        const [player, data] = await Promise.all([loadPlayer(), spec.load()]);
        if (cancelled || !hostRef.current) return;
        hostRef.current.replaceChildren();
        const animationData = unwrapAnimationData(data);
        anim = player.loadAnimation({
          container: hostRef.current,
          renderer: "svg",
          loop: shouldLoop && !reduced && !playOnHover,
          autoplay: false,
          animationData,
          rendererSettings: {
            progressiveLoad: true,
            preserveAspectRatio: "xMidYMid meet",
          },
        });
        anim.setSpeed(speed);
        anim.addEventListener("complete", onComplete);
        animRef.current = anim;
        if (reduced) {
          const frame = spec.reducedFrame === "last" ? Math.max(0, anim.totalFrames - 1) : 0;
          anim.goToAndStop(frame, true);
          return;
        }
        if (playOnHover) {
          anim.goToAndStop(0, true);
          return;
        }
        if (autoplay) anim.play();
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      if (anim) {
        anim.removeEventListener("complete", onComplete);
        anim.destroy();
      }
      animRef.current = null;
    };
  }, [autoplay, failed, name, playOnHover, reduced, shouldLoop, spec, speed, visible]);

  useEffect(() => {
    const anim = animRef.current;
    if (!anim || reduced || playOnHover) return;
    if (!visible) {
      anim.pause();
      return;
    }
    if (shouldLoop || !completedRef.current) anim.play();
  }, [playOnHover, reduced, shouldLoop, visible]);

  return (
    <div
      ref={hostRef}
      className={cn("inline-block overflow-hidden", className)}
      style={{ width: w, height: h }}
      aria-hidden={label ? undefined : true}
      role={label ? "img" : undefined}
      aria-label={label}
      onMouseEnter={() => {
        if (!playOnHover || reduced) return;
        animRef.current?.goToAndStop(0, true);
        animRef.current?.play();
      }}
      onMouseLeave={() => {
        if (!playOnHover || reduced) return;
        animRef.current?.goToAndStop(0, true);
      }}
    />
  );
});
