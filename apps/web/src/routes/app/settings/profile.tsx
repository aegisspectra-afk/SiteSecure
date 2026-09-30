import { Button, ErrorState, Input, cn } from "@site-secure/ui";
import { ApiClientError } from "@site-secure/api-client";
import { Link, createFileRoute } from "@tanstack/react-router";
import { ChevronRight, Lock, Shield } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { AccountAvatarPicker } from "../../../components/AccountAvatarPicker";
import { ThemePicker } from "../../../components/ThemePicker";
import { RequirePermission } from "../../../components/settings/RequirePermission";
import { useSettingsIdentity } from "../../../components/settings/SettingsShell";
import { he } from "../../../i18n/he";
import { roleLabel } from "../../../lib/app-nav";
import { canAny } from "../../../lib/can";
import { useSession } from "../../../lib/session";

export const Route = createFileRoute("/app/settings/profile")({
  component: ProfileSettingsPage,
});

function ProfileSettingsPage() {
  return (
    <RequirePermission permission="settings.view">
      <ProfileSettingsBody />
    </RequirePermission>
  );
}

type Draft = { fullName: string; phone: string };

function ProfileSettingsBody() {
  const { session, api, refresh } = useSession();
  const identity = useSettingsIdentity();
  const membership = session?.memberships[0];
  const roleKey = membership?.role_key;
  const features = membership?.features ?? [];
  const grants = membership?.permissions ?? null;
  const canSecurity = canAny(roleKey, ["settings.general", "workspace.edit"], features, grants);
  const [draft, setDraft] = useState<Draft>({ fullName: "", phone: "" });
  const [baseline, setBaseline] = useState<Draft | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const next: Draft = {
      fullName: session?.profile?.full_name?.trim() || "",
      phone: session?.profile?.phone?.trim() || "",
    };
    setDraft(next);
    setBaseline(next);
  }, [session?.profile?.full_name, session?.profile?.phone]);

  const dirty = useMemo(() => {
    if (!baseline) return false;
    return draft.fullName.trim() !== baseline.fullName.trim() || draft.phone.trim() !== baseline.phone.trim();
  }, [baseline, draft]);

  const canSave = dirty && Boolean(draft.fullName.trim()) && !saving;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSave) return;
    setSaving(true);
    setFormError(null);
    setSavedFlash(false);
    try {
      await api.patchMe({
        full_name: draft.fullName.trim(),
        phone: draft.phone.trim(),
      });
      await refresh();
      setBaseline({ fullName: draft.fullName.trim(), phone: draft.phone.trim() });
      setSavedFlash(true);
      window.setTimeout(() => setSavedFlash(false), 1800);
    } catch (err) {
      setFormError(err instanceof ApiClientError ? err.message : he.sessionError);
    } finally {
      setSaving(false);
    }
  }

  if (!session) return <ErrorState title={he.sessionError} />;

  const roleDisplay = roleLabel(roleKey) || "—";
  const workspaceDisplay = membership?.workspace_name?.trim() || "—";

  return (
    <div className="settings-profile" data-testid="settings-profile">
      <header className="settings-profile-header">
        <Link to="/app/settings" className="settings-profile-back" aria-label={he.settingsBackToHub}>
          <ChevronRight size={20} strokeWidth={1.75} aria-hidden />
        </Link>
        <div className="settings-profile-header-copy">
          <h1 className="settings-profile-title">{he.settingsEditProfile}</h1>
          <p className="settings-profile-lead">{he.settingsProfileLead}</p>
        </div>
        <span className="settings-profile-header-spacer" aria-hidden />
      </header>

      <section className="settings-profile-identity" aria-labelledby="profile-identity-name">
        <div className="settings-profile-avatar-wrap">
          <button
            type="button"
            className={cn("settings-profile-avatar-btn", avatarOpen && "is-open")}
            onClick={() => setAvatarOpen((v) => !v)}
            aria-expanded={avatarOpen}
            aria-controls="settings-profile-avatar-picker"
            aria-label={he.accountAvatarChange}
          >
            <img
              className="settings-profile-avatar"
              src={identity.avatarUrl}
              alt=""
              width={104}
              height={104}
              decoding="async"
            />
          </button>
          <button
            type="button"
            className="settings-profile-avatar-caption"
            onClick={() => setAvatarOpen((v) => !v)}
            aria-expanded={avatarOpen}
            aria-controls="settings-profile-avatar-picker"
          >
            {he.accountAvatarChangeShort}
          </button>
        </div>

        <h2
          id="profile-identity-name"
          className={cn("settings-profile-name", !identity.hasName && "is-placeholder")}
        >
          {identity.name}
        </h2>
        {identity.email ? (
          <p className="settings-profile-email ltr-meta" dir="ltr">
            {identity.email}
          </p>
        ) : null}

        <p className="settings-profile-meta">
          <span className="settings-profile-role-chip">{roleDisplay}</span>
          {workspaceDisplay !== "—" ? (
            <>
              <span className="settings-profile-meta-sep" aria-hidden>
                ·
              </span>
              <span className="settings-profile-workspace">{workspaceDisplay}</span>
            </>
          ) : null}
        </p>
      </section>

      {avatarOpen ? (
        <div
          id="settings-profile-avatar-picker"
          className="settings-profile-avatar-panel"
          role="region"
          aria-label={he.accountAvatarLabel}
        >
          <p className="settings-section-title" id="profile-avatar-heading">
            {he.accountAvatarLabel}
          </p>
          <AccountAvatarPicker id="settings-profile-avatar" labelledBy="profile-avatar-heading" showHint />
        </div>
      ) : null}

      <section
        className="settings-profile-section"
        aria-labelledby="profile-prefs-heading"
        data-testid="settings-profile-prefs"
      >
        <h2 id="profile-prefs-heading" className="settings-section-title">
          {he.settingsProfilePrefsHeading}
        </h2>
        <ThemePicker id="settings-profile-theme" />
        <p className="settings-profile-hint is-optional">{he.settingsProfileThemeDeviceHint}</p>
      </section>

      <form className="settings-profile-form" onSubmit={(e) => void onSubmit(e)}>
        <section className="settings-profile-section" aria-labelledby="profile-personal-heading">
          <h2 id="profile-personal-heading" className="settings-section-title">
            {he.settingsProfilePersonalHeading}
          </h2>

          {!identity.hasName ? (
            <p className="settings-profile-hint" role="status">
              {he.settingsProfileNameHint}
            </p>
          ) : null}

          <Input
            id="profile-full-name"
            label={he.fullName}
            value={draft.fullName}
            onChange={(ev) => setDraft((d) => ({ ...d, fullName: ev.target.value }))}
            autoComplete="name"
            placeholder={he.settingsProfileNamePlaceholder}
          />
          <Input
            id="profile-phone"
            label={he.phone}
            value={draft.phone}
            onChange={(ev) => setDraft((d) => ({ ...d, phone: ev.target.value }))}
            className="ltr-meta"
            autoComplete="tel"
          />
          {!draft.phone.trim() ? (
            <p className="settings-profile-hint is-optional">{he.settingsProfilePhoneHint}</p>
          ) : null}
        </section>

        <section className="settings-profile-section" aria-labelledby="profile-account-heading">
          <h2 id="profile-account-heading" className="settings-section-title">
            {he.settingsProfileAccountHeading}
          </h2>
          <dl className="settings-profile-readonly-list">
            <div className="settings-profile-readonly-row">
              <dt>
                <Lock size={14} strokeWidth={1.75} aria-hidden />
                {he.email}
              </dt>
              <dd className="ltr-meta" dir="ltr">
                {session.email || "—"}
              </dd>
            </div>
            <div className="settings-profile-readonly-row">
              <dt>
                <Lock size={14} strokeWidth={1.75} aria-hidden />
                {he.roleCaption}
              </dt>
              <dd>{roleDisplay}</dd>
            </div>
            <div className="settings-profile-readonly-row">
              <dt>
                <Lock size={14} strokeWidth={1.75} aria-hidden />
                {he.workspaceName}
              </dt>
              <dd>{workspaceDisplay}</dd>
            </div>
          </dl>
        </section>

        <section className="settings-profile-section" aria-labelledby="profile-security-heading">
          <h2 id="profile-security-heading" className="settings-section-title">
            {he.settingsProfileSecurityHeading}
          </h2>
          <div className="settings-profile-actions">
            {canSecurity ? (
              <Link to="/app/settings/security" className="settings-profile-action-link">
                <Shield size={16} strokeWidth={1.75} aria-hidden />
                {he.settingsProfileSecurityLink}
              </Link>
            ) : null}
            <Link to="/forgot-password" className="settings-profile-action-link">
              {he.securityPasswordResetCta}
            </Link>
          </div>
        </section>

        {formError ? (
          <p className="settings-profile-feedback is-error" role="alert">
            {formError}
          </p>
        ) : null}
        {savedFlash ? (
          <p className="settings-profile-feedback is-success" role="status">
            {he.settingsProfileSaved}
          </p>
        ) : null}

        <Button
          type="submit"
          variant="primary"
          className="settings-save-cta settings-profile-save"
          loading={saving}
          disabled={!canSave}
          title={!dirty ? he.settingsSaveDisabled : !draft.fullName.trim() ? he.settingsProfileNameRequired : undefined}
        >
          {saving ? he.saving : he.settingsSaveChanges}
        </Button>
      </form>
    </div>
  );
}
