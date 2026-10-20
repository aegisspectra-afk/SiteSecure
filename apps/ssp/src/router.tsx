import { Outlet, createRootRoute, createRoute, createRouter } from "@tanstack/react-router";
import { ActivatePage } from "./routes/ActivatePage";
import { ActivityPage } from "./routes/ActivityPage";
import { AlertsPage } from "./routes/AlertsPage";
import { AuthenticatedLayout } from "./routes/AuthenticatedLayout";
import { DevicesPage } from "./routes/DevicesPage";
import { CheckpointPrintPage } from "./routes/CheckpointPrintPage";
import { CheckpointsPage } from "./routes/CheckpointsPage";
import { CheckpointsPrintSheetPage } from "./routes/CheckpointsPrintSheetPage";
import { DashboardPage } from "./routes/DashboardPage";
import { DistributionsPage } from "./routes/DistributionsPage";
import { EnrollmentsPage } from "./routes/EnrollmentsPage";
import { EventDetailPage } from "./routes/EventDetailPage";
import { EventsPage } from "./routes/EventsPage";
import { FieldFormPage } from "./routes/FieldFormPage";
import { FieldHomePage } from "./routes/FieldHomePage";
import { FormDetailPage } from "./routes/FormDetailPage";
import { FormsListPage } from "./routes/FormsListPage";
import { MessagesPage } from "./routes/MessagesPage";
import { MobilityPage } from "./routes/MobilityPage";
import { SiteDetailPage } from "./routes/SiteDetailPage";
import { SitesListPage } from "./routes/SitesListPage";
import { LoginPage } from "./routes/LoginPage";
import { OfficersPage } from "./routes/OfficersPage";
import { OrganizationPage } from "./routes/OrganizationPage";
import { PatrolRunDetailPage } from "./routes/PatrolRunDetailPage";
import { PatrolsPage } from "./routes/PatrolsPage";
import { ScanPage } from "./routes/ScanPage";
import { SettingsPage } from "./routes/SettingsPage";
import { SubmissionDetailPage } from "./routes/SubmissionDetailPage";
import { SubmissionsListPage } from "./routes/SubmissionsListPage";
import { TaskTemplatesPage } from "./routes/TaskTemplatesPage";
import { TemplatesPage } from "./routes/TemplatesPage";
import { UsersPage } from "./routes/UsersPage";

const rootRoute = createRootRoute({
  component: () => <Outlet />,
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  component: LoginPage,
});

const activateRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/activate",
  component: ActivatePage,
});

const fieldRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/field",
  component: FieldHomePage,
});

const fieldFormRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/field/forms/$assignmentId",
  component: FieldFormPage,
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

const alertsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/alerts",
  component: AlertsPage,
});

const activityRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/activity",
  component: ActivityPage,
});

const usersRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/users",
  component: UsersPage,
});

const messagesRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/messages",
  component: MessagesPage,
});

const mobilityRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/mobility",
  component: MobilityPage,
});

const taskTemplatesRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/task-templates",
  component: TaskTemplatesPage,
});

const templatesRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/templates",
  component: TemplatesPage,
});

const devicesRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/devices",
  component: DevicesPage,
});

const officersRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/officers",
  component: OfficersPage,
});

const patrolsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/patrols",
  component: PatrolsPage,
});

const patrolRunRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/patrols/runs/$runId",
  component: PatrolRunDetailPage,
});

const checkpointsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/checkpoints",
  component: CheckpointsPage,
});

const checkpointsPrintSheetRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/checkpoints/print",
  component: CheckpointsPrintSheetPage,
});

const checkpointPrintRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/checkpoints/$checkpointId/print",
  component: CheckpointPrintPage,
});

const scanRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/scan",
  validateSearch: (s: Record<string, unknown>) => ({
    runId: typeof s.runId === "string" ? s.runId : undefined,
    code: typeof s.code === "string" ? s.code : undefined,
  }),
  component: ScanPage,
});

const eventsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/events",
  component: EventsPage,
});

const eventDetailRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/events/$eventId",
  component: EventDetailPage,
});

const sitesIndexRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/sites",
  validateSearch: (s: Record<string, unknown>): { activation?: string } => {
    const activation = typeof s.activation === "string" ? s.activation : undefined;
    return activation ? { activation } : {};
  },
  component: SitesListPage,
});

const enrollmentsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/enrollments",
  validateSearch: (s: Record<string, unknown>): { status?: string } => {
    const status = typeof s.status === "string" ? s.status : undefined;
    return status ? { status } : {};
  },
  component: EnrollmentsPage,
});

const siteDetailRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/sites/$siteId",
  component: SiteDetailPage,
});

const formsIndexRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/forms",
  component: FormsListPage,
});

const formDetailRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/forms/$formId",
  component: FormDetailPage,
});

const distributionsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/distributions",
  component: DistributionsPage,
});

const submissionsIndexRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/submissions",
  component: SubmissionsListPage,
});

const submissionDetailRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/submissions/$submissionId",
  component: SubmissionDetailPage,
});

const organizationRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/organization",
  component: OrganizationPage,
});

const settingsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/settings",
  component: SettingsPage,
});

const routeTree = rootRoute.addChildren([
  loginRoute,
  activateRoute,
  fieldRoute,
  fieldFormRoute,
  appRoute.addChildren([
    dashboardRoute,
    alertsRoute,
    activityRoute,
    usersRoute,
    messagesRoute,
    mobilityRoute,
    taskTemplatesRoute,
    templatesRoute,
    devicesRoute,
    officersRoute,
    patrolsRoute,
    patrolRunRoute,
    checkpointsRoute,
    checkpointsPrintSheetRoute,
    checkpointPrintRoute,
    scanRoute,
    eventsRoute,
    eventDetailRoute,
    sitesIndexRoute,
    siteDetailRoute,
    enrollmentsRoute,
    formsIndexRoute,
    formDetailRoute,
    distributionsRoute,
    submissionsIndexRoute,
    submissionDetailRoute,
    organizationRoute,
    settingsRoute,
  ]),
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
