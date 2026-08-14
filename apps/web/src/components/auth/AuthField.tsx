import { cn, Input, type InputProps } from "@site-secure/ui";

export function AuthField({ className, ltr, ...props }: InputProps & { ltr?: boolean }) {
  return (
    <Input
      className={cn(
        "auth-field-focus min-h-12 border-border bg-transparent px-3.5 text-fg",
        "transition-[border-color,box-shadow] duration-150",
        ltr && "ltr-meta",
        className,
      )}
      {...props}
    />
  );
}
