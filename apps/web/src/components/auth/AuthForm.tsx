import { cn } from "@site-secure/ui";
import type { FormHTMLAttributes, ReactNode } from "react";

export function AuthForm({
  children,
  className,
  ...props
}: FormHTMLAttributes<HTMLFormElement> & { children: ReactNode }) {
  return (
    <form className={cn("flex flex-col gap-4", className)} noValidate {...props}>
      {children}
    </form>
  );
}
