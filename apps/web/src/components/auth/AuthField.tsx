import { cn, Input, type InputProps } from "@site-secure/ui";

export function AuthField({ className, ltr, appearance = "default", ...props }: InputProps & { ltr?: boolean }) {
  return (
    <Input
      appearance={appearance}
      className={cn(
        "auth-field-focus min-h-12 border-border bg-transparent px-3.5 text-fg",
        "transition-[border-color,box-shadow] duration-150",
        appearance === "comfortable" && "min-h-[var(--premium-control-height)] bg-bg-2 px-4 text-fg placeholder:text-fg-muted",
        ltr && "ltr-meta",
        className,
      )}
      {...props}
    />
  );
}
