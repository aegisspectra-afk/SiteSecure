import {
  BookOpen,
  Building2,
  CalendarDays,
  ClipboardList,
  FileText,
  FolderKanban,
  LayoutDashboard,
  ListChecks,
  Lock,
  MoreHorizontal,
  Package,
  ScrollText,
  Settings,
  Shield,
  ShieldCheck,
  UserPlus,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type { NavIconKey } from "../lib/app-nav";

const icons: Record<NavIconKey, LucideIcon> = {
  overview: LayoutDashboard,
  today: ListChecks,
  calendar: CalendarDays,
  customers: Building2,
  leads: UserPlus,
  quotes: FileText,
  catalog: Package,
  projects: FolderKanban,
  sites: ClipboardList,
  service: Wrench,
  warranties: ShieldCheck,
  knowledge: BookOpen,
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
