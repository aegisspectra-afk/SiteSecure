/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_API_URL: string;
  readonly VITE_PLATFORM_HOME_URL?: string;
  /** Host that still serves public `/ssp/:token` until B4.3 */
  readonly VITE_WEB_ORIGIN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface BarcodeDetector {
  detect: (source: CanvasImageSource) => Promise<Array<{ rawValue: string; format?: string }>>;
}

interface BarcodeDetectorConstructor {
  new (options?: { formats?: string[] }): BarcodeDetector;
  getSupportedFormats?: () => Promise<string[]>;
}

interface Window {
  BarcodeDetector?: BarcodeDetectorConstructor;
}

declare const BarcodeDetector: BarcodeDetectorConstructor | undefined;
