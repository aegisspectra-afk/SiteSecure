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
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface Document {
  startViewTransition?: (updateCallback: () => void) => { finished: Promise<void> };
}
