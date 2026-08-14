import { cn, Input, type InputProps } from "@site-secure/ui";

export function AuthField({ className, ltr, ...props }: InputProps & { ltr?: boolean }) {
  return (
    <Input
      className={cn(
        "min-h-12 px-3.5",
        "focus-visible:border-action",
        ltr && "ltr-meta",
        className,
      )}
      {...props}
    />
  );
}
