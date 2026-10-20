import { ApiClientError } from "@site-secure/api-client";
import { Input, Select } from "@site-secure/ui";
import { createFileRoute } from "@tanstack/react-router";
import { Users } from "lucide-react";
import { useState, type FormEvent } from "react";
import {
  CreatePanel,
  EmptyRows,
  ErrorState,
  ModuleScaffold,
  SearchCreateBar,
  SimpleEntityTable,
  useMutation,
  useQuery,
} from "../../../components/modules/ModuleKit";
import { RequirePermission } from "../../../components/settings/RequirePermission";
import { he } from "../../../i18n/he";
import { can } from "../../../lib/can";
import { useSession } from "../../../lib/session";

export const Route = createFileRoute("/app/workforce/employees")({
  component: WorkforceEmployeesPage,
});

const PRODUCT_ROLE_LABEL: Record<string, string> = {
  employee: he.workforceRoleEmployee,
  site_manager: he.workforceRoleSiteManager,
  scheduler: he.workforceRoleScheduler,
  regional_manager: he.workforceRoleRegionalManager,
  national_manager: he.workforceRoleNationalManager,
  org_admin: he.workforceRoleOrgAdmin,
  payroll: he.workforceRolePayroll,
  auditor: he.workforceRoleAuditor,
};

function WorkforceEmployeesPage() {
  return (
    <RequirePermission permission="workforce.employees.view">
      <WorkforceEmployeesBody />
    </RequirePermission>
  );
}

function WorkforceEmployeesBody() {
  const { session, api } = useSession();
  const membership = session?.memberships[0];
  const workspaceId = membership?.workspace_id;
  const grants = membership?.permissions ?? null;
  const features = membership?.features ?? [];
  const canCreate = can(membership?.role_key, "workforce.employees.create_user", features, grants);
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [phone, setPhone] = useState("");
  const [employeeNumber, setEmployeeNumber] = useState("");
  const [productRole, setProductRole] = useState("employee");
  const [positionId, setPositionId] = useState("");
  const [regionId, setRegionId] = useState("");
  const [siteId, setSiteId] = useState("");
  const [hireDate, setHireDate] = useState("");

  const query = useQuery({
    queryKey: ["workforce-employees", workspaceId, q],
    enabled: Boolean(workspaceId),
    queryFn: () => api.listWorkforceEmployees(workspaceId!, { q: q.trim() || undefined }),
  });
  const lookups = useQuery({
    queryKey: ["workforce-lookups", workspaceId],
    enabled: Boolean(workspaceId && creating),
    queryFn: () => api.listWorkforceLookups(workspaceId!),
  });

  const resetForm = () => {
    setFirstName("");
    setLastName("");
    setUsername("");
    setEmail("");
    setPassword("");
    setPasswordConfirm("");
    setPhone("");
    setEmployeeNumber("");
    setProductRole("employee");
    setPositionId("");
    setRegionId("");
    setSiteId("");
    setHireDate("");
    setFormError(null);
  };

  const create = useMutation({
    mutationFn: () =>
      api.createWorkforceEmployee(workspaceId!, {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        username: username.trim().toLowerCase(),
        email: email.trim().toLowerCase(),
        password,
        phone: phone.trim() || undefined,
        employee_number: employeeNumber.trim() || undefined,
        product_role: productRole,
        position_id: positionId || undefined,
        region_id: regionId || undefined,
        site_id: siteId || undefined,
        hire_date: hireDate || undefined,
      }),
    onSuccess: async () => {
      setCreating(false);
      setSuccess(he.workforceCreated);
      resetForm();
      await query.refetch();
    },
    onError: (err) => {
      setFormError(err instanceof ApiClientError ? err.message : he.workforceLoadError);
    },
  });

  const rows = (query.data?.items ?? []).map((row) => ({
    id: row.id,
    title: `${row.first_name} ${row.last_name}`.trim(),
    meta: [row.employee_number, row.username, row.email].filter(Boolean).join(" · "),
    status: row.employment_status,
  }));
  const regions = (lookups.data?.regions ?? []).filter((item) => item.is_active);
  const sites = (lookups.data?.sites ?? []).filter((item) => item.is_active);
  const positions = (lookups.data?.positions ?? []).filter((item) => item.is_active);
  const productRoles = lookups.data?.product_roles ?? Object.keys(PRODUCT_ROLE_LABEL);

  return (
    <ModuleScaffold title={he.workforceEmployeesTitle} lead={he.workforceEmployeesLead}>
      <SearchCreateBar
        query={q}
        onQuery={setQ}
        canCreate={canCreate}
        creating={creating}
        onToggleCreate={() => {
          setCreating((value) => !value);
          setFormError(null);
          setSuccess(null);
        }}
        createLabel={he.workforceCreateEmployee}
      />
      {success ? (
        <p className="text-sm text-success" role="status">
          {success}
        </p>
      ) : null}
      <CreatePanel
        open={creating}
        pending={create.isPending}
        error={formError}
        onSubmit={(event: FormEvent) => {
          event.preventDefault();
          if (password !== passwordConfirm) {
            setFormError(he.workforcePasswordMismatch);
            return;
          }
          create.mutate();
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2" data-testid="workforce-create-employee">
          <Input
            id="wf-first-name"
            label={he.workforceFieldFirstName}
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
            autoComplete="given-name"
            required
          />
          <Input
            id="wf-last-name"
            label={he.workforceFieldLastName}
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
            autoComplete="family-name"
            required
          />
          <Input
            id="wf-username"
            label={he.workforceFieldUsername}
            hint={he.workforceUsernameHint}
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            autoComplete="username"
            required
          />
          <Input
            id="wf-email"
            label={he.workforceFieldEmail}
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="off"
            required
          />
          <Input
            id="wf-password"
            label={he.workforceFieldPassword}
            hint={he.workforcePasswordHint}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            revealable
            autoComplete="new-password"
            required
          />
          <Input
            id="wf-password-confirm"
            label={he.workforceFieldPasswordConfirm}
            value={passwordConfirm}
            onChange={(event) => setPasswordConfirm(event.target.value)}
            revealable
            autoComplete="new-password"
            required
          />
          <Input
            id="wf-phone"
            label={he.workforceFieldPhone}
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            autoComplete="tel"
          />
          <Input
            id="wf-employee-number"
            label={he.workforceFieldEmployeeNumber}
            value={employeeNumber}
            onChange={(event) => setEmployeeNumber(event.target.value)}
          />
          <Select
            id="wf-product-role"
            label={he.workforceFieldProductRole}
            value={productRole}
            onChange={(event) => setProductRole(event.target.value)}
          >
            {productRoles.map((role) => (
              <option key={role} value={role}>
                {PRODUCT_ROLE_LABEL[role] ?? role}
              </option>
            ))}
          </Select>
          <Select
            id="wf-position"
            label={he.workforceFieldPosition}
            value={positionId}
            onChange={(event) => setPositionId(event.target.value)}
          >
            <option value="">{he.workforceLookupNone}</option>
            {positions.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </Select>
          <Select
            id="wf-region"
            label={he.workforceFieldRegion}
            value={regionId}
            onChange={(event) => setRegionId(event.target.value)}
          >
            <option value="">{he.workforceLookupNone}</option>
            {regions.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </Select>
          <Select
            id="wf-site"
            label={he.workforceFieldSite}
            value={siteId}
            onChange={(event) => setSiteId(event.target.value)}
          >
            <option value="">{he.workforceLookupNone}</option>
            {sites.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </Select>
          <Input
            id="wf-hire-date"
            label={he.workforceFieldHireDate}
            type="date"
            value={hireDate}
            onChange={(event) => setHireDate(event.target.value)}
          />
        </div>
      </CreatePanel>
      {query.isError ? (
        <ErrorState title={he.workforceLoadError} description={he.workforceLoadErrorHint} />
      ) : query.isLoading ? (
        <p className="text-sm text-fg-muted">{he.loading}</p>
      ) : rows.length ? (
        <SimpleEntityTable
          rows={rows}
          empty={he.workforceEmployeesEmpty}
          statusLabel={(status) =>
            status === "active"
              ? he.workforceStatusActive
              : status === "inactive"
                ? he.workforceStatusInactive
                : he.workforceStatusTerminated
          }
          leadingIcon={Users}
        />
      ) : (
        <EmptyRows message={he.workforceEmployeesEmpty} />
      )}
    </ModuleScaffold>
  );
}
