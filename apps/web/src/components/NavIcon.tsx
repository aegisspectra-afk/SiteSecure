import {
  LayoutDashboard,
  ListChecks,
  Lock,
  MoreHorizontal,
  ScrollText,
  Settings,
  Shield,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { NavIconKey } from "../lib/app-nav";

const icons: Record<NavIconKey, LucideIcon> = {
  overview: LayoutDashboard,
  today: ListChecks,
  team: Users,
  roles: Shield,
  security: Lock,
  audit: ScrollText,
  settings: Settings,
  more: MoreHorizontal,
};

export function NavIcon({
  name,
  active = false,
  className,
}: {
  name: NavIconKey;
  active?: boolean;
  className?: string;
}) {
  const Icon = icons[name];
  return <Icon className={className} strokeWidth={active ? 2.25 : 1.75} aria-hidden />;
}
