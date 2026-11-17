import { formatDashboardMoney } from "../../lib/quotes";

/** Dashboard metric amount — shared ILS format, bdi-safe, compact tooltip when abbreviated. */
export function DashboardMoney({
  value,
  className,
}: {
  value: number | null | undefined;
  className?: string;
}) {
  const { text, title, compact } = formatDashboardMoney(value);
  return (
    <bdi className={["ss-dashboard-money", className].filter(Boolean).join(" ")} title={compact ? title : undefined}>
      {text}
    </bdi>
  );
}
