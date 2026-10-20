import { encode } from "uqr";

/** SVG QR for a server-issued checkpoint code. Quiet zone included by uqr. */
export function qrSvgMarkup(value: string, opts?: { sizePx?: number }): string {
  const encoded = encode(value, { ecc: "M", boostEcc: true, border: 2 });
  const size = encoded.size;
  const bits = encoded.data;
  const parts: string[] = [];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (bits[y]?.[x]) parts.push(`M${x} ${y}h1v1h-1z`);
    }
  }
  const px = opts?.sizePx ?? 192;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${px}" height="${px}" shape-rendering="crispEdges" role="img"><rect width="${size}" height="${size}" fill="#fff"/><path fill="#111" d="${parts.join("")}"/></svg>`;
}
