import { Outlet, createRootRoute, createRoute, createRouter } from "@tanstack/react-router";
import { AuthenticatedLayout } from "./routes/AuthenticatedLayout";
import { DashboardPage } from "./routes/DashboardPage";
import { EmployeesPage } from "./routes/EmployeesPage";
import { LoginPage } from "./routes/LoginPage";
import { MyShiftsPage } from "./routes/MyShiftsPage";
import { PositionsPage } from "./routes/PositionsPage";
import { ProfilePage } from "./routes/ProfilePage";
import { ReportsPage } from "./routes/ReportsPage";
import { SchedulesPage } from "./routes/SchedulesPage";
import { SettingsPage } from "./routes/SettingsPage";
import { SitesPage } from "./routes/SitesPage";
import { TimeOffPage } from "./routes/TimeOffPage";

const rootRoute = createRootRoute({
  component: () => <Outlet />,
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  component: LoginPage,
});

const appRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "authenticated",
  component: AuthenticatedLayout,
});

const dashboardRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/",
  component: DashboardPage,
});

const employeesRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/employees",
  component: EmployeesPage,
});

const sitesRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/sites",
  component: SitesPage,
});

const positionsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/positions",
  component: PositionsPage,
});

const schedulesRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/schedules",
  component: SchedulesPage,
});

const timeOffRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/time-off",
  component: TimeOffPage,
});

const myShiftsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/my-shifts",
  component: MyShiftsPage,
});

const profileRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/profile",
  component: ProfilePage,
});

const reportsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/reports",
  component: ReportsPage,
});

const settingsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/settings",
  component: SettingsPage,
});

const routeTree = rootRoute.addChildren([
  loginRoute,
  appRoute.addChildren([
    dashboardRoute,
    employeesRoute,
    sitesRoute,
    positionsRoute,
    schedulesRoute,
    timeOffRoute,
    myShiftsRoute,
    profileRoute,
    reportsRoute,
    settingsRoute,
  ]),
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
