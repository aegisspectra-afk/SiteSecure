declare module "jsqr" {
  export type BinaryColor = 0 | 1;
  export default function jsQR(
    data: Uint8ClampedArray,
    width: number,
    height: number,
    options?: { inversionAttempts?: "dontInvert" | "onlyInvert" | "attemptBoth" | "invertFirst" },
  ): { data: string } | null;
}
