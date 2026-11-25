import type { ReactNode } from "react";

type Brand = "SITE SECURE" | "Aegis Spectra";

/** Latin brand names inside Hebrew/RTL copy — isolate bidi with <bdi>. */
export function BrandBdi({
  name,
  children,
  className,
}: {
  name?: Brand;
  children?: ReactNode;
  className?: string;
}) {
  return <bdi className={className}>{children ?? name}</bdi>;
}
