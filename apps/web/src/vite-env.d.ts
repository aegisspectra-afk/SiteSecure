/// <reference types="vite/client" />

declare module "lottie-web/build/player/lottie_light" {
  import type lottie from "lottie-web";
  const player: typeof lottie;
  export default player;
}

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_API_URL: string;
  readonly VITE_WORKFORCE_APP_URL?: string;
  readonly VITE_ENABLE_VERCEL_ANALYTICS?: string;
  /** International digits for marketing WhatsApp (wa.me). Empty = hide channel. */
  readonly VITE_MARKETING_WHATSAPP?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface Document {
  startViewTransition?: (updateCallback: () => void) => { finished: Promise<void> };
}
