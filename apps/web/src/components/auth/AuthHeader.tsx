export function AuthHeader({
  title,
  welcome,
  description,
}: {
  title: string;
  welcome?: string;
  description?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-[1.5rem] font-semibold leading-tight text-fg sm:text-2xl">{title}</h1>
      {welcome ? <p className="text-sm font-medium leading-relaxed text-fg">{welcome}</p> : null}
      {description ? <p className="text-sm leading-relaxed text-fg-muted">{description}</p> : null}
    </div>
  );
}
