export type LottieName = keyof typeof LOTTIE_ANIMATIONS;

export type LottieReducedFrame = "first" | "last";

export type LottieUsage = {
  purpose: string;
  where: string;
  why: string;
  trigger: string;
  loop: boolean;
  durationMs: number;
};

type LottieEntry = {
  file: string;
  load: () => Promise<unknown>;
  width: number;
  height: number;
  defaultLoop: boolean;
  reducedFrame: LottieReducedFrame;
  usage: LottieUsage;
};

export const LOTTIE_ANIMATIONS = {
  securityShield: {
    file: "security-shield.json",
    load: () => import("../../assets/lottie/security-shield.json"),
    width: 500,
    height: 500,
    defaultLoop: false,
    reducedFrame: "last",
    usage: {
      purpose:
        "Marks the Security Center as a security surface on mount, without decorating the signal list or competing with status copy.",
      where: "Security Center header — /app/settings/security, 48px, beside the page title",
      why: "Marks the security surface without changing the signal list.",
      trigger: "Page mount, after signals have loaded",
      loop: false,
      durationMs: 2800,
    },
  },
  scan: {
    file: "scan.json",
    load: () => import("../../assets/lottie/scan.json"),
    width: 160,
    height: 160,
    defaultLoop: true,
    reducedFrame: "first",
    usage: {
      purpose:
        "Makes a real security-data wait feel like the product is checking, then stops the instant signals resolve.",
      where: "Security Center loading — /app/settings/security, 80px, replaces the page until query settles",
      why: "The wait is security-themed and longer than a toolbar spinner.",
      trigger: "While security signals load",
      loop: true,
      durationMs: 3000,
    },
  },
  success: {
    file: "success.json",
    load: () => import("../../assets/lottie/success.json"),
    width: 300,
    height: 300,
    defaultLoop: false,
    reducedFrame: "last",
    usage: {
      purpose:
        "Confirms an irreversible completed step. Heading and the next button stay available immediately — the animation does not gate progress.",
      where:
        "Onboarding workspace ready (OnboardingForm, 72px); public quote approved (/public/quotes/$token, 64px)",
      why: "Confirms a completed, irreversible step. Copy still carries the meaning.",
      trigger: "After workspace create succeeds; after public quote status is approved",
      loop: false,
      durationMs: 2000,
    },
  },
  sentEmail: {
    file: "sent-email.json",
    load: () => import("../../assets/lottie/sent-email.json"),
    width: 120,
    height: 120,
    defaultLoop: false,
    reducedFrame: "last",
    usage: {
      purpose:
        "Provides immediate visual confirmation that the server successfully completed an outbound email action.",
      where:
        "Quote send confirmation (QuoteBuilder, 48px, after send succeeds); forgot-password email sent (/forgot-password, 72px)",
      why: "The action is literally dispatching a message to the recipient.",
      trigger: "After send / reset-email succeeds",
      loop: false,
      durationMs: 1533,
    },
  },
  networkConnecting: {
    file: "network-connecting.json",
    load: () => import("../../assets/lottie/network-connecting.json"),
    width: 101,
    height: 84,
    defaultLoop: true,
    reducedFrame: "first",
    usage: {
      purpose:
        "Signals a real browser-offline or reconnecting state in the workspace header. Unmounts the instant the network is back.",
      where: "App shell system-status control — chip 28px and status popover 36px, only when navigator.onLine is false",
      why: "The wait is a live connectivity failure, not a decorative online badge.",
      trigger: "Browser offline event",
      loop: true,
      durationMs: 1200,
    },
  },
} as const satisfies Record<string, LottieEntry>;
