import { ApiClientError } from "@site-secure/api-client";
import type { CustomerContact, CustomerOut, DocumentOut, LeadOut, ProjectOut, QuoteOut, ServiceCallOut, SiteOut } from "@site-secure/api-client";
import { Button, Input, Modal, Select, Status, Switch, Tabs } from "@site-secure/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  Building2,
  ChevronLeft,
  FileText,
  Mail,
  MapPin,
  Phone,
  Plus,
  User,
  Wrench,
} from "lucide-react";
import { useEffect, useRef, useState, type FormEvent, type ReactNode, type RefObject } from "react";
import {
  addressFromForm,
  formatAddressLine,
  formatAddressLines,
  hasAddress,
  mapsSearchUrl,
  parseAddress,
  type StructuredAddress,
} from "../../lib/address";
import { CustomerNewQuoteButton } from "../quotes/CustomerNewQuoteButton";
import { QuoteFlowSheet } from "../quotes/quote-creation/QuoteFlowSheet";
import { NextActionDialog } from "../workflow/NextActionDialog";
import { he } from "../../i18n/he";
import { planQuotaMessage } from "../../lib/plan-quota";
import {
  buildCustomerActivity,
  buildSiteStats,
  customerProfileTabs,
  customerStatusLabel,
  customerStatusTone,
  customerTypeLabel,
  formatActivityDateTime,
  formatActivityStamp,
  installationStatusLabel,
  pickCustomerNextLead,
  projectStatusLabel,
  serviceStatusLabel,
  siteCardSummary,
  type CustomerProfileTab,
  type SiteCardStats,
} from "../../lib/customer-profile";
import { leadDisplayTitle, leadPriorityLabel, leadPrimaryAction, leadRequirementsSummary, leadStatusLabel } from "../../lib/leads";
import { formatMoney, quoteStatusLabel, quoteStatusTone } from "../../lib/quotes";
import { CustomerActionMenu, customerMenuIcons } from "./CustomerActionMenu";

const EMPTY_ADDRESS: StructuredAddress = {};

function AddressFields({
  idPrefix,
  value,
  onChange,
}: {
  idPrefix: string;
  value: StructuredAddress;
  onChange: (next: StructuredAddress) => void;
}) {
  function setField(key: keyof StructuredAddress, next: string) {
    onChange({ ...value, [key]: next });
  }
  return (
    <div className="customer-360-address-fields">
      <div className="customer-360-address-grid">
        <Input
          id={`${idPrefix}-street`}
          label={he.customer360Street}
          value={value.street ?? ""}
          onChange={(ev) => setField("street", ev.target.value)}
        />
        <Input
          id={`${idPrefix}-house`}
          label={he.customer360HouseNumber}
          value={value.house_number ?? ""}
          onChange={(ev) => setField("house_number", ev.target.value)}
        />
      </div>
      <div className="customer-360-address-grid">
        <Input
          id={`${idPrefix}-city`}
          label={he.customer360City}
          value={value.city ?? ""}
          onChange={(ev) => setField("city", ev.target.value)}
        />
        <Input
          id={`${idPrefix}-postal`}
          label={he.customer360PostalCode}
          value={value.postal_code ?? ""}
          onChange={(ev) => setField("postal_code", ev.target.value)}
        />
      </div>
      <div className="customer-360-address-grid is-triple">
        <Input
          id={`${idPrefix}-apt`}
          label={he.customer360Apartment}
          value={value.apartment ?? ""}
          onChange={(ev) => setField("apartment", ev.target.value)}
        />
        <Input
          id={`${idPrefix}-floor`}
          label={he.customer360Floor}
          value={value.floor ?? ""}
          onChange={(ev) => setField("floor", ev.target.value)}
        />
        <Input
          id={`${idPrefix}-entrance`}
          label={he.customer360Entrance}
          value={value.entrance ?? ""}
          onChange={(ev) => setField("entrance", ev.target.value)}
        />
      </div>
    </div>
  );
}

function AddressDisplay({
  address,
  showMaps,
}: {
  address?: Record<string, unknown> | null;
  showMaps?: boolean;
}) {
  const lines = formatAddressLines(address);
  if (!lines.length) return <span>—</span>;
  const maps = showMaps ? mapsSearchUrl(address) : null;
  return (
    <div className="customer-360-address-block">
      <div className="customer-360-address-text">
        {lines.map((line) => (
          <p key={line}>{line}</p>
        ))}
      </div>
      {maps ? (
        <a className="customer-360-maps-link" href={maps} target="_blank" rel="noreferrer">
          {he.customer360OpenInMaps}
        </a>
      ) : null}
    </div>
  );
}

type CustomerProfileProps = {
  customerId: string;
  workspaceId: string;
  api: ReturnType<typeof import("../../lib/session").useSession>["api"];
  canEdit: boolean;
  canDelete: boolean;
  canCreateSite: boolean;
  canCreateQuote: boolean;
  canCreateProject: boolean;
  canCreateService: boolean;
};

export function CustomerProfile({
  customerId,
  workspaceId,
  api,
  canEdit,
  canDelete,
  canCreateSite,
  canCreateQuote,
  canCreateProject,
  canCreateService,
}: CustomerProfileProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [tab, setTab] = useState<CustomerProfileTab>("overview");
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [customerType, setCustomerType] = useState("private");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [billingAddress, setBillingAddress] = useState<StructuredAddress>(EMPTY_ADDRESS);
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [siteSheet, setSiteSheet] = useState(false);
  const [siteName, setSiteName] = useState("");
  const [siteAddress, setSiteAddress] = useState<StructuredAddress>(EMPTY_ADDRESS);

  const [contactSheet, setContactSheet] = useState(false);
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPrimary, setContactPrimary] = useState(false);
  const [contactFormError, setContactFormError] = useState<string | null>(null);
  const [contactToast, setContactToast] = useState(false);
  const addContactTriggerRef = useRef<HTMLButtonElement>(null);

  const [serviceSheet, setServiceSheet] = useState(false);
  const [serviceTitle, setServiceTitle] = useState("");
  const [serviceSiteId, setServiceSiteId] = useState("");

  const [projectSheet, setProjectSheet] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [projectSiteId, setProjectSiteId] = useState("");

  const [siteNextAction, setSiteNextAction] = useState<{ customerId: string; siteId: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);

  const customerQuery = useQuery({
    queryKey: ["customer", workspaceId, customerId],
    queryFn: async () => {
      const row = await api.getCustomer(workspaceId, customerId);
      if (!hydrated) {
        setName(row.display_name);
        setCustomerType(row.type || "private");
        setEmail(row.email ?? "");
        setPhone(row.phone ?? "");
        setNotes(row.notes ?? "");
        setBillingAddress(parseAddress(row.billing_address));
        setHydrated(true);
      }
      return row;
    },
  });

  const contactsQuery = useQuery({
    queryKey: ["customer-contacts", workspaceId, customerId],
    queryFn: () => api.listCustomerContacts(workspaceId, customerId),
  });

  const sitesQuery = useQuery({
    queryKey: ["customer-sites", workspaceId, customerId],
    queryFn: () => api.listSites(workspaceId, { customer_id: customerId, limit: 100 }),
  });

  const quotesQuery = useQuery({
    queryKey: ["customer-quotes", workspaceId, customerId],
    queryFn: () => api.listQuotes(workspaceId, { customer_id: customerId, limit: 100 }),
  });

  const projectsQuery = useQuery({
    queryKey: ["customer-projects", workspaceId, customerId],
    queryFn: () => api.listProjects(workspaceId, { customer_id: customerId, limit: 100 }),
  });

  const serviceQuery = useQuery({
    queryKey: ["customer-service", workspaceId, customerId],
    queryFn: async () => {
      const page = await api.listServiceCalls(workspaceId, { limit: 100 });
      return { items: page.items.filter((row) => row.customer_id === customerId) };
    },
  });

  const docsQuery = useQuery({
    queryKey: ["customer-docs", workspaceId, customerId],
    queryFn: () => api.listDocuments(workspaceId, { entity_type: "customer", entity_id: customerId, limit: 100 }),
  });

  const warrantiesQuery = useQuery({
    queryKey: ["customer-warranties", workspaceId, customerId],
    queryFn: () => api.listWarranties(workspaceId, { customer_id: customerId, limit: 100 }),
  });

  const leadsQuery = useQuery({
    queryKey: ["customer-leads", workspaceId, customerId],
    queryFn: () => api.listLeads(workspaceId, { customer_id: customerId, limit: 20 }),
  });

  const customer = customerQuery.data;
  const sites = sitesQuery.data?.items ?? [];
  const quotes = quotesQuery.data?.items ?? [];
  const projects = projectsQuery.data?.items ?? [];
  const serviceCalls = serviceQuery.data?.items ?? [];
  const contacts = contactsQuery.data ?? [];
  const documents = docsQuery.data?.items ?? [];
  const warranties = warrantiesQuery.data?.items ?? [];
  const leads = leadsQuery.data?.items ?? [];
  const siteStats = buildSiteStats(sites, quotes, serviceCalls, projects);
  const activity = customer
    ? buildCustomerActivity({ customer, sites, quotes, projects, serviceCalls, contacts, leads })
    : [];
  const nextLead = pickCustomerNextLead(leads);
  const customerAddressLine = formatAddressLine(customer?.billing_address);
  const customerHasAddress = hasAddress(customer?.billing_address);

  function resetDraft(row: CustomerOut) {
    setName(row.display_name);
    setCustomerType(row.type || "private");
    setEmail(row.email ?? "");
    setPhone(row.phone ?? "");
    setNotes(row.notes ?? "");
    setBillingAddress(parseAddress(row.billing_address));
  }

  function invalidateAll() {
    void queryClient.invalidateQueries({ queryKey: ["customer", workspaceId, customerId] });
    void queryClient.invalidateQueries({ queryKey: ["customers", workspaceId] });
    void queryClient.invalidateQueries({ queryKey: ["customer-contacts", workspaceId, customerId] });
    void queryClient.invalidateQueries({ queryKey: ["customer-sites", workspaceId, customerId] });
    void queryClient.invalidateQueries({ queryKey: ["customer-quotes", workspaceId, customerId] });
    void queryClient.invalidateQueries({ queryKey: ["customer-projects", workspaceId, customerId] });
    void queryClient.invalidateQueries({ queryKey: ["customer-service", workspaceId] });
    void queryClient.invalidateQueries({ queryKey: ["customer-docs", workspaceId, customerId] });
    void queryClient.invalidateQueries({ queryKey: ["customer-warranties", workspaceId, customerId] });
    void queryClient.invalidateQueries({ queryKey: ["customer-leads", workspaceId, customerId] });
  }

  const save = useMutation({
    mutationFn: () =>
      api.patchCustomer(workspaceId, customerId, {
        display_name: name.trim(),
        type: customerType,
        email: email.trim() || null,
        phone: phone.trim() || null,
        notes: notes.trim() || null,
        billing_address: addressFromForm(billingAddress) ?? null,
      }),
    onSuccess: () => {
      setError(null);
      setEditing(false);
      invalidateAll();
    },
    onError: (err) => setError(err instanceof ApiClientError ? err.message : he.customersError),
  });

  const addContact = useMutation({
    mutationFn: () =>
      api.createCustomerContact(workspaceId, customerId, {
        full_name: contactName.trim(),
        phone: contactPhone.trim() || undefined,
        email: contactEmail.trim() || undefined,
        is_primary: contactPrimary,
      }),
    onSuccess: async (created) => {
      setContactFormError(null);
      queryClient.setQueryData<CustomerContact[]>(["customer-contacts", workspaceId, customerId], (prev) => {
        const list = prev ?? [];
        if (list.some((row) => row.id === created.id)) return list;
        return [...list, created];
      });
      await queryClient.invalidateQueries({ queryKey: ["customer-contacts", workspaceId, customerId] });
      setContactSheet(false);
      setContactName("");
      setContactPhone("");
      setContactEmail("");
      setContactPrimary(false);
      setContactToast(true);
      window.setTimeout(() => setContactToast(false), 2500);
    },
    onError: (err) => {
      setContactFormError(err instanceof ApiClientError ? err.message : he.customersError);
    },
  });

  const addSite = useMutation({
    mutationFn: () =>
      api.createSite(workspaceId, {
        customer_id: customerId,
        name: siteName.trim(),
        address: addressFromForm(siteAddress),
      }),
    onSuccess: (site) => {
      setSiteSheet(false);
      setSiteName("");
      setSiteAddress(EMPTY_ADDRESS);
      void queryClient.invalidateQueries({ queryKey: ["customer-sites", workspaceId, customerId] });
      if (canCreateQuote) {
        setSiteNextAction({ customerId, siteId: site.id });
      } else {
        void navigate({ to: "/app/sites/$siteId", params: { siteId: site.id } });
      }
    },
  });

  const addService = useMutation({
    mutationFn: () =>
      api.createServiceCall(workspaceId, {
        title: serviceTitle.trim(),
        customer_id: customerId,
        site_id: serviceSiteId,
      }),
    onSuccess: () => {
      setServiceSheet(false);
      setServiceTitle("");
      setServiceSiteId("");
      void queryClient.invalidateQueries({ queryKey: ["customer-service", workspaceId] });
    },
    onError: (err) => setError(err instanceof ApiClientError ? err.message : he.serviceError),
  });

  const addProject = useMutation({
    mutationFn: () =>
      api.createProject(workspaceId, {
        name: projectName.trim(),
        customer_id: customerId,
        site_id: projectSiteId || undefined,
      }),
    onSuccess: () => {
      setProjectSheet(false);
      setProjectName("");
      setProjectSiteId("");
      void queryClient.invalidateQueries({ queryKey: ["customer-projects", workspaceId, customerId] });
    },
    onError: (err) => setError(err instanceof ApiClientError ? err.message : he.projectsError),
  });

  const archive = useMutation({
    mutationFn: () => api.patchCustomer(workspaceId, customerId, { status: "inactive" }),
    onSuccess: invalidateAll,
  });

  const remove = useMutation({
    mutationFn: () => api.deleteCustomer(workspaceId, customerId),
    onSuccess: () => void navigate({ to: "/app/customers" }),
  });

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const intent = await api.createDocumentUpload(workspaceId, {
        entity_type: "customer",
        entity_id: customerId,
        kind: "document",
        mime_type: file.type || undefined,
        original_filename: file.name,
        byte_size: Math.max(file.size, 1),
      });
      const put = await fetch(intent.upload_url, {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!put.ok) throw new Error(he.customersError);
      await api.completeDocumentUpload(workspaceId, intent.document_id, {
        byte_size: file.size,
        mime_type: file.type || undefined,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["customer-docs", workspaceId, customerId] });
      if (fileRef.current) fileRef.current.value = "";
    },
    onError: (err) => setError(planQuotaMessage(err) ?? (err instanceof Error ? err.message : he.customersError)),
  });

  const dirty =
    editing &&
    customer != null &&
    (name.trim() !== customer.display_name ||
      customerType !== (customer.type || "private") ||
      email.trim() !== (customer.email ?? "") ||
      phone.trim() !== (customer.phone ?? "") ||
      notes.trim() !== (customer.notes ?? "") ||
      formatAddressLine(addressFromForm(billingAddress)) !== formatAddressLine(customer.billing_address));

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  if (!customer) return null;

  const siteOptions = sites.map((site) => ({ id: site.id, name: site.name }));

  function openSiteSheet() {
    setSiteName("");
    setSiteAddress(EMPTY_ADDRESS);
    setSiteSheet(true);
  }

  function openContactSheet() {
    setContactName("");
    setContactPhone("");
    setContactEmail("");
    setContactPrimary(false);
    setContactFormError(null);
    setContactSheet(true);
  }

  function openServiceSheet() {
    setServiceTitle("");
    setServiceSiteId(sites.length === 1 ? sites[0]!.id : "");
    setServiceSheet(true);
  }

  function openProjectSheet() {
    setProjectName("");
    setProjectSiteId("");
    setProjectSheet(true);
  }

  function startEdit() {
    setTab("overview");
    setEditing(true);
  }

  function cancelEdit() {
    if (!customer) return;
    resetDraft(customer);
    setEditing(false);
    setError(null);
  }

  function requestTabChange(next: CustomerProfileTab) {
    if (dirty && !window.confirm(he.customer360UnsavedWarn)) return;
    if (dirty && customer) {
      resetDraft(customer);
      setEditing(false);
      setError(null);
    }
    setTab(next);
  }

  const profileTabs = customerProfileTabs({
    sites: sites.length,
    quotes: quotes.length,
    projects: projects.length,
    service: serviceCalls.length,
    warranties: warranties.length,
    documents: documents.length,
  });

  const menuActions = [
    canEdit
      ? {
          id: "edit",
          label: he.customer360EditDetails,
          icon: customerMenuIcons.edit,
          group: "customer" as const,
          onSelect: startEdit,
        }
      : null,
    canEdit
      ? {
          id: "contact",
          label: he.customer360AddContact,
          icon: customerMenuIcons.contact,
          group: "customer" as const,
          onSelect: openContactSheet,
        }
      : null,
    canEdit
      ? {
          id: "upload",
          label: he.customer360UploadDoc,
          icon: customerMenuIcons.upload,
          group: "customer" as const,
          onSelect: () => {
            setTab("documents");
            window.setTimeout(() => fileRef.current?.click(), 0);
          },
        }
      : null,
    canCreateService
      ? {
          id: "service",
          label: he.customer360CreateService,
          icon: customerMenuIcons.service,
          group: "operations" as const,
          onSelect: openServiceSheet,
        }
      : null,
    canEdit
      ? {
          id: "archive",
          label: he.customer360Archive,
          icon: customerMenuIcons.archive,
          group: "lifecycle" as const,
          onSelect: () => setConfirmArchive(true),
        }
      : null,
    canDelete
      ? {
          id: "delete",
          label: he.customersDelete,
          icon: customerMenuIcons.delete,
          group: "lifecycle" as const,
          tone: "danger" as const,
          onSelect: () => setConfirmDelete(true),
        }
      : null,
  ].filter(Boolean) as import("./CustomerActionMenu").CustomerMenuAction[];

  return (
    <div className="customer-360">
      <nav className="customer-360-crumb" aria-label={he.customer360Back}>
        <Link to="/app/customers" className="customer-360-back">
          <ChevronLeft className="size-4" aria-hidden />
          {he.customer360Back}
        </Link>
        <span className="customer-360-crumb-sep" aria-hidden>
          /
        </span>
        <span className="customer-360-crumb-current">{customer.display_name}</span>
      </nav>

      <header className="customer-360-header">
        <div className="customer-360-hero">
          <div className="customer-360-avatar" aria-hidden>
            <User className="size-6" strokeWidth={1.75} />
          </div>
          <div className="customer-360-identity">
            <div className="customer-360-title-row">
              <h1 className="customer-360-name">{customer.display_name}</h1>
              <Status label={customerStatusLabel(customer.status)} tone={customerStatusTone(customer.status)} />
            </div>
            <p className="customer-360-type">{customerTypeLabel(customer.type)}</p>
            <div className="customer-360-contact-row">
              {customer.phone ? (
                <a href={`tel:${customer.phone}`} className="customer-360-contact-chip" dir="ltr">
                  <Phone className="size-3.5" aria-hidden />
                  {customer.phone}
                </a>
              ) : (
                <span className="customer-360-contact-chip is-empty">
                  <Phone className="size-3.5" aria-hidden />
                  —
                </span>
              )}
              {customer.email ? (
                <a href={`mailto:${customer.email}`} className="customer-360-contact-chip" dir="ltr">
                  <Mail className="size-3.5" aria-hidden />
                  {customer.email}
                </a>
              ) : (
                <span className="customer-360-contact-chip is-empty">
                  <Mail className="size-3.5" aria-hidden />
                  —
                </span>
              )}
            </div>
            {customerHasAddress ? (
              <div className="customer-360-header-address">
                <MapPin className="size-3.5 shrink-0 text-fg-muted" aria-hidden />
                <div className="min-w-0">
                  <p className="customer-360-header-address-label">{he.customer360Address}</p>
                  <p className="customer-360-header-address-value">{customerAddressLine}</p>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="customer-360-actions">
          {canCreateQuote ? (
            <CustomerNewQuoteButton
              customerId={customerId}
              customerName={customer.display_name}
              sites={siteOptions}
              label={
                <>
                  <Plus className="size-4" aria-hidden />
                  {he.customer360NewQuote}
                </>
              }
            />
          ) : null}
          {canCreateSite ? (
            <Button type="button" variant="secondary" onClick={openSiteSheet}>
              <Plus className="size-4" aria-hidden />
              {he.customer360NewSite}
            </Button>
          ) : null}
          <CustomerActionMenu actions={menuActions} />
        </div>
      </header>

      <div className="customer-360-tabs">
        <Tabs tabs={profileTabs} value={tab} onChange={(id) => requestTabChange(id as CustomerProfileTab)} />
      </div>

      <div className="customer-360-body">
        {tab === "overview" ? (
          <OverviewPanel
            customer={customer}
            contacts={contacts}
            leads={leads}
            sites={sites}
            siteStats={siteStats}
            activity={activity}
            nextLead={nextLead}
            kpi={{
              sites: sites.length,
              quotes: quotes.length,
              projects: projects.length,
              service: serviceCalls.length,
              leads: leads.length,
            }}
            editing={editing}
            canEdit={canEdit}
            name={name}
            customerType={customerType}
            email={email}
            phone={phone}
            notes={notes}
            billingAddress={billingAddress}
            error={error}
            savePending={save.isPending}
            onName={setName}
            onType={setCustomerType}
            onEmail={setEmail}
            onPhone={setPhone}
            onNotes={setNotes}
            onBillingAddress={setBillingAddress}
            onEdit={startEdit}
            onCancel={cancelEdit}
            onSave={() => save.mutate()}
            onAddContact={openContactSheet}
            onAddSite={openSiteSheet}
            canCreateSite={canCreateSite}
            canCreateContact={canEdit}
            addContactRef={addContactTriggerRef}
            contactToast={contactToast}
          />
        ) : null}

        {tab === "sites" ? (
          <SitesPanel
            sites={sites}
            siteStats={siteStats}
            canCreate={canCreateSite}
            onCreate={openSiteSheet}
          />
        ) : null}

        {tab === "quotes" ? (
          <QuotesPanel quotes={quotes} canCreate={canCreateQuote} customerId={customerId} sites={siteOptions} customerName={customer.display_name} />
        ) : null}

        {tab === "projects" ? (
          <ProjectsPanel
            projects={projects}
            sites={sites}
            canCreate={canCreateProject}
            onCreate={openProjectSheet}
          />
        ) : null}

        {tab === "service" ? (
          <ServicePanel serviceCalls={serviceCalls} canCreate={canCreateService} onCreate={openServiceSheet} />
        ) : null}

        {tab === "warranties" ? (
          <section className="ops-card p-4">
            <h2 className="text-sm font-semibold text-fg">{he.customer360TabWarranties}</h2>
            {warranties.length === 0 ? (
              <p className="mt-4 text-sm text-fg-muted">{he.customer360WarrantiesEmpty}</p>
            ) : (
              <ul className="mt-3 divide-y divide-border">
                {warranties.map((row) => (
                  <li key={row.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                    <div>
                      <p className="font-medium">{row.number}</p>
                      <p className="text-xs text-fg-muted">
                        {row.type} · {row.starts_on} → {row.ends_on}
                      </p>
                    </div>
                    <Status label={row.status} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}

        {tab === "documents" ? (
          <DocumentsPanel
            documents={documents}
            canUpload={canEdit}
            uploading={upload.isPending}
            fileRef={fileRef}
            onUpload={(file) => upload.mutate(file)}
          />
        ) : null}
      </div>

      <Modal open={confirmDelete} onClose={() => setConfirmDelete(false)} title={he.customer360DeleteTitle}>
        <p className="text-sm text-fg-muted">{he.customer360DeleteBody(customer.display_name)}</p>
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => setConfirmDelete(false)}>
            {he.cancel}
          </Button>
          <Button
            type="button"
            variant="danger"
            loading={remove.isPending}
            onClick={() => remove.mutate()}
          >
            {he.customersDelete}
          </Button>
        </div>
      </Modal>

      <Modal open={confirmArchive} onClose={() => setConfirmArchive(false)} title={he.customer360ArchiveTitle}>
        <p className="text-sm text-fg-muted">{he.customer360ArchiveBody(customer.display_name)}</p>
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => setConfirmArchive(false)}>
            {he.cancel}
          </Button>
          <Button
            type="button"
            loading={archive.isPending}
            onClick={() => {
              archive.mutate();
              setConfirmArchive(false);
            }}
          >
            {he.customer360Archive}
          </Button>
        </div>
      </Modal>

      <QuoteFlowSheet
        open={siteSheet}
        onClose={() => setSiteSheet(false)}
        title={he.customer360CreateSiteTitle}
        subtitle={he.customer360CreateSiteLead}
        variant="sheet"
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setSiteSheet(false)}>
              {he.cancel}
            </Button>
            <Button
              type="button"
              disabled={!siteName.trim() || addSite.isPending}
              loading={addSite.isPending}
              onClick={() => addSite.mutate()}
            >
              {he.save}
            </Button>
          </div>
        }
      >
        <div className="grid gap-3">
          <Input id="site-name" label={he.name} value={siteName} onChange={(ev) => setSiteName(ev.target.value)} data-autofocus />
          {customerHasAddress ? (
            <div>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setSiteAddress(parseAddress(customer.billing_address))}
              >
                {he.customer360UseCustomerAddress}
              </Button>
            </div>
          ) : null}
          <AddressFields idPrefix="site" value={siteAddress} onChange={setSiteAddress} />
          <Input
            id="site-notes"
            label={he.notes}
            value={siteAddress.notes ?? ""}
            onChange={(ev) => setSiteAddress({ ...siteAddress, notes: ev.target.value })}
          />
        </div>
      </QuoteFlowSheet>

      <QuoteFlowSheet
        open={contactSheet}
        onClose={() => {
          if (addContact.isPending) return;
          setContactSheet(false);
          setContactFormError(null);
        }}
        title={he.customer360CreateContactTitle}
        subtitle={he.customer360CreateContactLead}
        variant="sheet"
        returnFocusRef={addContactTriggerRef}
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={addContact.isPending}
              onClick={() => {
                setContactSheet(false);
                setContactFormError(null);
              }}
            >
              {he.cancel}
            </Button>
            <Button
              type="button"
              disabled={!contactName.trim() || addContact.isPending}
              loading={addContact.isPending}
              onClick={() => addContact.mutate()}
            >
              {addContact.isPending ? he.customer360AddingContact : he.customersAddContact}
            </Button>
          </div>
        }
      >
        <div className="grid gap-3">
          <Input
            id="contact-name"
            label={he.customer360ContactName}
            value={contactName}
            onChange={(ev) => setContactName(ev.target.value)}
            data-autofocus
            autoComplete="name"
          />
          <Input
            id="contact-phone"
            label={he.phone}
            value={contactPhone}
            onChange={(ev) => setContactPhone(ev.target.value)}
            autoComplete="tel"
            inputMode="tel"
          />
          <Input
            id="contact-email"
            label={he.email}
            type="email"
            value={contactEmail}
            onChange={(ev) => setContactEmail(ev.target.value)}
            autoComplete="email"
          />
          <Switch
            id="contact-primary"
            label={he.customer360PrimaryContact}
            checked={contactPrimary}
            onCheckedChange={setContactPrimary}
            disabled={addContact.isPending}
          />
          {contactFormError ? <p className="text-sm text-danger">{contactFormError}</p> : null}
        </div>
      </QuoteFlowSheet>

      <QuoteFlowSheet
        open={serviceSheet}
        onClose={() => setServiceSheet(false)}
        title={he.customer360CreateServiceTitle}
        subtitle={he.customer360CreateServiceLead}
        variant="sheet"
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setServiceSheet(false)}>
              {he.cancel}
            </Button>
            <Button
              type="button"
              disabled={!serviceTitle.trim() || !serviceSiteId || addService.isPending}
              loading={addService.isPending}
              onClick={() => addService.mutate()}
            >
              {he.save}
            </Button>
          </div>
        }
      >
        <div className="grid gap-3">
          <Input id="service-title" label={he.name} value={serviceTitle} onChange={(ev) => setServiceTitle(ev.target.value)} data-autofocus />
          <label className="grid gap-1 text-sm">
            <span className="font-medium text-fg">{he.customer360PickSite}</span>
            <select
              id="service-site"
              className="rounded-[var(--radius-control)] border border-border bg-bg px-3 py-2 text-sm"
              value={serviceSiteId}
              onChange={(ev) => setServiceSiteId(ev.target.value)}
            >
              <option value="">{he.customer360PickSite}</option>
              {sites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </QuoteFlowSheet>

      <QuoteFlowSheet
        open={projectSheet}
        onClose={() => setProjectSheet(false)}
        title={he.customer360CreateProjectTitle}
        subtitle={he.customer360CreateProjectLead}
        variant="sheet"
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setProjectSheet(false)}>
              {he.cancel}
            </Button>
            <Button
              type="button"
              disabled={!projectName.trim() || addProject.isPending}
              loading={addProject.isPending}
              onClick={() => addProject.mutate()}
            >
              {he.save}
            </Button>
          </div>
        }
      >
        <div className="grid gap-3">
          <Input id="project-name" label={he.name} value={projectName} onChange={(ev) => setProjectName(ev.target.value)} data-autofocus />
          {sites.length > 0 ? (
            <label className="grid gap-1 text-sm">
              <span className="font-medium text-fg">{he.customer360PickSite}</span>
              <select
                id="project-site"
                className="rounded-[var(--radius-control)] border border-border bg-bg px-3 py-2 text-sm"
                value={projectSiteId}
                onChange={(ev) => setProjectSiteId(ev.target.value)}
              >
                <option value="">{he.customer360PickSite}</option>
                {sites.map((site) => (
                  <option key={site.id} value={site.id}>
                    {site.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
      </QuoteFlowSheet>

      {siteNextAction ? (
        <NextActionDialog
          open
          onClose={() => {
            const siteId = siteNextAction.siteId;
            setSiteNextAction(null);
            void navigate({ to: "/app/sites/$siteId", params: { siteId } });
          }}
          title={he.workflowNextSiteTitle}
          body={he.workflowNextSiteBody}
          customerId={siteNextAction.customerId}
          siteId={siteNextAction.siteId}
          customerHref="/app/customers/$customerId"
        />
      ) : null}
    </div>
  );
}

function SectionHeader({
  title,
  action,
}: {
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="customer-360-section-head">
      <h2 className="customer-360-section-title">{title}</h2>
      {action}
    </div>
  );
}

function OverviewPanel({
  customer,
  contacts,
  leads,
  sites,
  siteStats,
  activity,
  nextLead,
  kpi,
  editing,
  canEdit,
  name,
  customerType,
  email,
  phone,
  notes,
  billingAddress,
  error,
  savePending,
  onName,
  onType,
  onEmail,
  onPhone,
  onNotes,
  onBillingAddress,
  onEdit,
  onCancel,
  onSave,
  onAddContact,
  onAddSite,
  canCreateSite,
  canCreateContact,
  addContactRef,
  contactToast,
}: {
  customer: CustomerOut;
  contacts: CustomerContact[];
  leads: LeadOut[];
  sites: SiteOut[];
  siteStats: Map<string, SiteCardStats>;
  activity: ReturnType<typeof buildCustomerActivity>;
  nextLead: LeadOut | null;
  kpi: { sites: number; quotes: number; projects: number; service: number; leads: number };
  editing: boolean;
  canEdit: boolean;
  name: string;
  customerType: string;
  email: string;
  phone: string;
  notes: string;
  billingAddress: StructuredAddress;
  error: string | null;
  savePending: boolean;
  onName: (v: string) => void;
  onType: (v: string) => void;
  onEmail: (v: string) => void;
  onPhone: (v: string) => void;
  onNotes: (v: string) => void;
  onBillingAddress: (v: StructuredAddress) => void;
  onEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
  onAddContact: () => void;
  onAddSite: () => void;
  canCreateSite: boolean;
  canCreateContact: boolean;
  addContactRef: RefObject<HTMLButtonElement | null>;
  contactToast: boolean;
}) {
  const siteById = new Map(sites.map((site) => [site.id, site]));
  const showKpis = kpi.sites + kpi.quotes + kpi.projects + kpi.service + kpi.leads > 0;

  return (
    <div className="customer-360-stack">
      {nextLead ? (
        <section className="customer-360-next-action" aria-label={he.customer360NextAction}>
          <p className="customer-360-next-action-eyebrow">{he.customer360NextAction}</p>
          <p className="customer-360-next-action-title">{nextLead.next_action}</p>
          <p className="customer-360-next-action-meta">
            {[leadDisplayTitle(nextLead), leadRequirementsSummary(nextLead)].filter((part) => part && part !== "—").join(" · ")}
          </p>
          {nextLead.site_id && siteById.get(nextLead.site_id) ? (
            <p className="customer-360-next-action-site">
              {formatAddressLine(siteById.get(nextLead.site_id)!.address) || siteById.get(nextLead.site_id)!.name}
            </p>
          ) : null}
          <div className="mt-3">
            <Link
              to="/app/leads/$leadId"
              params={{ leadId: nextLead.id }}
              className="customer-360-next-action-cta"
            >
              {leadPrimaryAction(nextLead.status) === "schedule_visit"
                ? he.customer360ScheduleVisit
                : he.customer360NextActionCta}
            </Link>
          </div>
        </section>
      ) : null}

      {showKpis ? (
        <div className="customer-360-kpis" role="group" aria-label={he.customer360Details}>
          <div className="customer-360-kpi">
            <span className="customer-360-kpi-value">{kpi.sites}</span>
            <span className="customer-360-kpi-label">{he.customer360KpiSites}</span>
          </div>
          <div className="customer-360-kpi">
            <span className="customer-360-kpi-value">{kpi.quotes}</span>
            <span className="customer-360-kpi-label">{he.customer360KpiQuotes}</span>
          </div>
          <div className="customer-360-kpi">
            <span className="customer-360-kpi-value">{kpi.projects}</span>
            <span className="customer-360-kpi-label">{he.customer360KpiProjects}</span>
          </div>
          <div className="customer-360-kpi">
            <span className="customer-360-kpi-value">{kpi.service}</span>
            <span className="customer-360-kpi-label">{he.customer360KpiService}</span>
          </div>
          <div className="customer-360-kpi">
            <span className="customer-360-kpi-value">{kpi.leads}</span>
            <span className="customer-360-kpi-label">{he.customer360KpiLeads}</span>
          </div>
        </div>
      ) : null}

      <section className="ops-card customer-360-panel">
        <SectionHeader title={he.customer360Details} />
        {editing ? (
          <form
            className="customer-360-details-form"
            onSubmit={(ev: FormEvent) => {
              ev.preventDefault();
              onSave();
            }}
          >
            <Input id="c-name" label={he.name} value={name} onChange={(ev) => onName(ev.target.value)} />
            <Select
              id="c-type"
              label={he.customer360CustomerType}
              value={customerType}
              onChange={(ev) => onType(ev.target.value)}
            >
              <option value="private">{he.customer360TypePrivate}</option>
              <option value="business">{he.customer360TypeBusiness}</option>
            </Select>
            <Input id="c-phone" label={he.phone} value={phone} onChange={(ev) => onPhone(ev.target.value)} />
            <Input id="c-email" label={he.email} value={email} onChange={(ev) => onEmail(ev.target.value)} />
            <div>
              <p className="customer-360-detail-label mb-2">{he.customer360Address}</p>
              <AddressFields idPrefix="customer" value={billingAddress} onChange={onBillingAddress} />
            </div>
            <Input id="c-notes" label={he.notes} value={notes} onChange={(ev) => onNotes(ev.target.value)} />
            {error ? <p className="text-sm text-danger">{error}</p> : null}
            <div className="flex flex-wrap gap-2">
              <Button type="submit" loading={savePending} disabled={savePending}>
                {savePending ? he.saving : he.save}
              </Button>
              <Button type="button" variant="secondary" onClick={onCancel}>
                {he.cancel}
              </Button>
            </div>
          </form>
        ) : (
          <dl className="customer-360-details-view">
            <DetailRow label={he.name} value={customer.display_name} />
            <DetailRow label={he.customer360CustomerType} value={customerTypeLabel(customer.type)} />
            <DetailRow label={he.phone} value={customer.phone || "—"} ltr={Boolean(customer.phone)} />
            <DetailRow label={he.email} value={customer.email || "—"} ltr={Boolean(customer.email)} />
            <div className="customer-360-detail-row">
              <dt className="customer-360-detail-label">{he.customer360Address}</dt>
              <dd className="customer-360-detail-value is-multiline">
                <AddressDisplay address={customer.billing_address} showMaps />
              </dd>
            </div>
            <DetailRow label={he.notes} value={customer.notes?.trim() || "—"} multiline />
            {canEdit ? (
              <div className="customer-360-details-actions">
                <Button type="button" variant="secondary" onClick={onEdit}>
                  {he.customer360EditDetails}
                </Button>
              </div>
            ) : null}
          </dl>
        )}
      </section>

      <section className="ops-card customer-360-panel">
        <SectionHeader
          title={he.customersContacts}
          action={
            canCreateContact && contacts.length > 0 ? (
              <Button ref={addContactRef} type="button" variant="secondary" onClick={onAddContact}>
                <Plus className="size-4" aria-hidden />
                {he.customersAddContact}
              </Button>
            ) : null
          }
        />
        {contactToast ? <p className="mb-3 text-sm text-success">{he.customer360ContactAdded}</p> : null}
        {contacts.length === 0 ? (
          <div className="customer-360-empty">
            <p className="customer-360-empty-title">{he.customersContactsEmpty}</p>
            {canCreateContact ? (
              <Button ref={addContactRef} type="button" variant="secondary" className="mt-4" onClick={onAddContact}>
                <Plus className="size-4" aria-hidden />
                {he.customersAddContact}
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="customer-360-contact-grid">
            {contacts.map((contact) => (
              <ContactCard key={contact.id} contact={contact} />
            ))}
          </div>
        )}
      </section>

      <section className="ops-card customer-360-panel">
        <SectionHeader title={he.leadsOpportunities} />
        {leads.length === 0 ? (
          <p className="text-sm text-fg-muted">{he.leadsOpportunitiesEmpty}</p>
        ) : (
          <div className="space-y-3">
            {leads.map((lead) => {
              const req = leadRequirementsSummary(lead);
              return (
                <Link
                  key={lead.id}
                  to="/app/leads/$leadId"
                  params={{ leadId: lead.id }}
                  className="block rounded-[var(--radius-card)] border border-border p-3 hover:border-border-strong"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-medium text-fg">{leadDisplayTitle(lead)}</p>
                    <Status label={leadStatusLabel(lead.status)} tone="info" />
                  </div>
                  <p className="mt-1 text-sm text-fg-muted">{leadPriorityLabel(lead.priority ?? "normal")}</p>
                  {req && req !== "—" ? <p className="mt-1 text-sm text-fg-muted">{req}</p> : null}
                  {lead.next_action?.trim() ? (
                    <p className="mt-2 text-sm text-fg">
                      <span className="text-fg-muted">{he.customer360LeadNextAction}: </span>
                      {lead.next_action}
                    </p>
                  ) : null}
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <section className="ops-card customer-360-panel is-emphasis">
        <SectionHeader
          title={he.customersSites}
          action={
            canCreateSite && sites.length > 0 ? (
              <Button type="button" variant="secondary" onClick={onAddSite}>
                <Plus className="size-4" aria-hidden />
                {he.sitesCreate}
              </Button>
            ) : null
          }
        />
        {sites.length === 0 ? (
          <div className="customer-360-empty">
            <p className="customer-360-empty-title">{he.sitesEmpty}</p>
            <p className="customer-360-empty-body">{he.customer360SitesEmptyLead}</p>
            {canCreateSite ? (
              <Button type="button" className="mt-4" onClick={onAddSite}>
                <Plus className="size-4" aria-hidden />
                {he.sitesCreate}
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="customer-360-site-grid">
            {sites.map((site) => (
              <SiteCard key={site.id} site={site} stats={siteStats.get(site.id)} />
            ))}
          </div>
        )}
      </section>

      <section className="customer-360-activity">
        <SectionHeader title={he.customer360RecentActivity} />
        {activity.length === 0 ? (
          <p className="text-sm text-fg-muted">{he.customer360NoActivity}</p>
        ) : (
          <ol className="customer-360-timeline">
            {activity.map((event) => (
              <li key={event.id} className="customer-360-timeline-item">
                <span className="customer-360-timeline-dot" aria-hidden />
                <div className="customer-360-timeline-content">
                  <time className="customer-360-timeline-day" dateTime={event.at}>
                    {formatActivityStamp(event.at)}
                  </time>
                  {event.href?.to === "/app/quotes/$quoteId" ? (
                    <Link
                      to="/app/quotes/$quoteId"
                      params={event.href.params}
                      className="customer-360-timeline-label is-link"
                    >
                      {event.label}
                    </Link>
                  ) : event.href?.to === "/app/sites/$siteId" ? (
                    <Link
                      to="/app/sites/$siteId"
                      params={event.href.params}
                      className="customer-360-timeline-label is-link"
                    >
                      {event.label}
                    </Link>
                  ) : event.href?.to === "/app/leads/$leadId" ? (
                    <Link
                      to="/app/leads/$leadId"
                      params={event.href.params}
                      className="customer-360-timeline-label is-link"
                    >
                      {event.label}
                    </Link>
                  ) : (
                    <span className="customer-360-timeline-label">{event.label}</span>
                  )}
                  <span className="sr-only">{formatActivityDateTime(event.at)}</span>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

function DetailRow({
  label,
  value,
  multiline,
  ltr,
}: {
  label: string;
  value: string;
  multiline?: boolean;
  ltr?: boolean;
}) {
  return (
    <div className="customer-360-detail-row">
      <dt className="customer-360-detail-label">{label}</dt>
      <dd
        className={multiline ? "customer-360-detail-value is-multiline" : "customer-360-detail-value"}
        dir={ltr ? "ltr" : undefined}
      >
        {value}
      </dd>
    </div>
  );
}

function ContactCard({ contact }: { contact: CustomerContact }) {
  const role = contact.role_title?.trim() || null;
  return (
    <article className="customer-360-contact-card">
      <div className="customer-360-contact-icon" aria-hidden>
        <User className="size-4" strokeWidth={1.75} />
      </div>
      <div className="min-w-0">
        <p className="customer-360-contact-name">{contact.full_name}</p>
        {contact.is_primary ? <p className="customer-360-contact-role">{he.customer360PrimaryContact}</p> : null}
        {role ? <p className="customer-360-contact-role">{role}</p> : null}
        {contact.phone ? (
          <p className="customer-360-contact-meta" dir="ltr">
            {contact.phone}
          </p>
        ) : null}
        {contact.email ? (
          <p className="customer-360-contact-meta" dir="ltr">
            {contact.email}
          </p>
        ) : null}
      </div>
    </article>
  );
}

function SiteCard({ site, stats }: { site: SiteOut; stats?: SiteCardStats }) {
  const systems = installationStatusLabel(site.installation_status);
  const summary = stats ? siteCardSummary(stats) : he.customer360SiteNoActivity;
  const lines = formatAddressLines(site.address);
  return (
    <Link to="/app/sites/$siteId" params={{ siteId: site.id }} className="customer-360-site-card">
      <div className="customer-360-site-card-head">
        <Building2 className="size-5 shrink-0 text-fg-muted" aria-hidden strokeWidth={1.75} />
        <div className="min-w-0">
          <p className="customer-360-site-name">{site.name}</p>
          {lines.length ? (
            <div className="customer-360-site-address">
              {lines.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
          ) : (
            <p className="customer-360-site-address">—</p>
          )}
        </div>
      </div>
      {systems ? <p className="customer-360-site-systems">{systems}</p> : null}
      <div className="customer-360-site-foot">
        <span className="customer-360-site-stats">{summary}</span>
        <span className="customer-360-site-open">{he.customer360OpenSiteFile} →</span>
      </div>
    </Link>
  );
}

function SitesPanel({
  sites,
  siteStats,
  canCreate,
  onCreate,
}: {
  sites: SiteOut[];
  siteStats: Map<string, { quoteCount: number; serviceCount: number; projectCount: number }>;
  canCreate: boolean;
  onCreate: () => void;
}) {
  return (
    <section className="ops-card customer-360-panel">
      <SectionHeader
        title={he.customersSites}
        action={
          canCreate ? (
            <Button type="button" variant="secondary" onClick={onCreate}>
              <Plus className="size-4" aria-hidden />
              {he.sitesCreate}
            </Button>
          ) : null
        }
      />
      {sites.length === 0 ? (
          <div className="customer-360-empty">
            <p className="customer-360-empty-title">{he.sitesEmpty}</p>
            <p className="customer-360-empty-body">{he.customer360SitesEmptyLead}</p>
            {canCreate ? (
              <Button type="button" className="mt-4" onClick={onCreate}>
                <Plus className="size-4" aria-hidden />
                {he.sitesCreate}
              </Button>
            ) : null}
          </div>
        ) : (
        <div className="customer-360-site-grid">
          {sites.map((site) => (
            <SiteCard key={site.id} site={site} stats={siteStats.get(site.id)} />
          ))}
        </div>
      )}
    </section>
  );
}

function QuotesPanel({
  quotes,
  canCreate,
  customerId,
  customerName,
  sites,
}: {
  quotes: QuoteOut[];
  canCreate: boolean;
  customerId: string;
  customerName: string;
  sites: { id: string; name: string }[];
}) {
  return (
    <section className="ops-card customer-360-panel">
      <SectionHeader
        title={he.customer360TabQuotes}
        action={
          canCreate ? (
            <CustomerNewQuoteButton
              customerId={customerId}
              customerName={customerName}
              sites={sites}
              variant="secondary"
              label={
                <>
                  <Plus className="size-4" aria-hidden />
                  {he.customer360NewQuote}
                </>
              }
            />
          ) : null
        }
      />
      {quotes.length === 0 ? (
        <p className="text-sm text-fg-muted">{he.customer360QuotesEmpty}</p>
      ) : (
        <ul className="customer-360-entity-list">
          {quotes.map((quote) => (
            <li key={quote.id}>
              <Link to="/app/quotes/$quoteId" params={{ quoteId: quote.id }} className="customer-360-entity-row">
                <span className="customer-360-entity-id">#{quote.number}</span>
                <span className="customer-360-entity-title">{quote.title || quote.project_name || quote.customer_notes || "—"}</span>
                <span className="customer-360-entity-amount">{formatMoney(quote.total_gross, quote.currency)}</span>
                <Status label={quoteStatusLabel(quote.status)} tone={quoteStatusTone(quote.status)} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ProjectsPanel({
  projects,
  sites,
  canCreate,
  onCreate,
}: {
  projects: ProjectOut[];
  sites: SiteOut[];
  canCreate: boolean;
  onCreate: () => void;
}) {
  const siteMap = new Map(sites.map((site) => [site.id, site]));
  return (
    <section className="ops-card customer-360-panel">
      <SectionHeader
        title={he.customer360TabProjects}
        action={
          canCreate ? (
            <Button type="button" variant="secondary" onClick={onCreate}>
              <Plus className="size-4" aria-hidden />
              {he.projectsCreate}
            </Button>
          ) : null
        }
      />
      {projects.length === 0 ? (
        <p className="text-sm text-fg-muted">{he.customer360ProjectsEmpty}</p>
      ) : (
        <ul className="customer-360-entity-list">
          {projects.map((project) => {
            const site = project.site_id ? siteMap.get(project.site_id) : undefined;
            const siteLabel = site
              ? formatAddressLine(site.address) || site.name
              : null;
            return (
              <li key={project.id} className="customer-360-project-row">
                <div>
                  <p className="customer-360-entity-title">{project.name}</p>
                  <p className="customer-360-entity-sub">
                    {projectStatusLabel(project.status)}
                    {siteLabel ? ` · ${he.sitesAddress}: ${siteLabel}` : null}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function ServicePanel({
  serviceCalls,
  canCreate,
  onCreate,
}: {
  serviceCalls: ServiceCallOut[];
  canCreate: boolean;
  onCreate: () => void;
}) {
  return (
    <section className="ops-card customer-360-panel">
      <SectionHeader
        title={he.customer360TabService}
        action={
          canCreate ? (
            <Button type="button" variant="secondary" onClick={onCreate}>
              <Plus className="size-4" aria-hidden />
              {he.serviceCreate}
            </Button>
          ) : null
        }
      />
      {serviceCalls.length === 0 ? (
        <p className="text-sm text-fg-muted">{he.customer360ServiceEmpty}</p>
      ) : (
        <ul className="customer-360-entity-list">
          {serviceCalls.map((call) => (
            <li key={call.id} className="customer-360-entity-row is-static">
              <Wrench className="size-4 text-fg-muted" aria-hidden />
              <span className="customer-360-entity-title">{call.title}</span>
              <Status label={serviceStatusLabel(call.status)} tone={call.status === "closed" ? "success" : "info"} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function DocumentsPanel({
  documents,
  canUpload,
  uploading,
  fileRef,
  onUpload,
}: {
  documents: DocumentOut[];
  canUpload: boolean;
  uploading: boolean;
  fileRef: RefObject<HTMLInputElement | null>;
  onUpload: (file: File) => void;
}) {
  return (
    <section className="ops-card customer-360-panel">
      <SectionHeader
        title={he.customer360TabDocuments}
        action={
          canUpload ? (
            <Button type="button" variant="secondary" loading={uploading} onClick={() => fileRef.current?.click()}>
              <Plus className="size-4" aria-hidden />
              {he.sitesUpload}
            </Button>
          ) : null
        }
      />
      <input
        ref={fileRef}
        type="file"
        className="sr-only"
        onChange={(ev) => {
          const file = ev.target.files?.[0];
          if (file) onUpload(file);
        }}
      />
      {documents.length === 0 ? (
        <p className="text-sm text-fg-muted">{he.customer360DocumentsEmpty}</p>
      ) : (
        <ul className="customer-360-doc-list">
          {documents.map((doc) => (
            <li key={doc.id} className="customer-360-doc-row">
              <FileText className="size-4 text-fg-muted" aria-hidden />
              <span>{doc.original_filename || doc.id}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
