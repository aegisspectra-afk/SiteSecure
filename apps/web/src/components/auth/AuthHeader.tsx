export function AuthHeader({
  kicker,
  title,
  description,
}: {
  kicker?: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      {kicker ? (
        <p className="public-mono text-[11px] tracking-[0.2em] text-fg-muted">{kicker}</p>
      ) : null}
      <h1 className="text-[1.65rem] font-semibold leading-tight tracking-[-0.03em] text-fg">{title}</h1>
      {description ? <p className="text-sm leading-6 text-fg-muted">{description}</p> : null}
    </div>
  );
}
