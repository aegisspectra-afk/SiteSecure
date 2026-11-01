import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { NotificationOut } from "@site-secure/api-client";
import { he } from "../i18n/he";
import { activeMembership } from "../lib/active-membership";
import { useSession } from "../lib/session";

function goTo(item: NotificationOut, navigate: ReturnType<typeof useNavigate>) {
  if (item.entity_type === "quote" && item.entity_id) {
    void navigate({ to: "/app/quotes/$quoteId", params: { quoteId: item.entity_id } });
    return;
  }
  if (item.entity_type === "task") {
    void navigate({ to: "/app/tasks" });
  }
}

export function NotificationBell() {
  const { api, session } = useSession();
  const membership = activeMembership(session);
  const workspaceId = membership?.workspace_id;
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const menuId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  const listQuery = useQuery({
    queryKey: ["notifications", workspaceId],
    enabled: Boolean(workspaceId),
    refetchInterval: 30_000,
    retry: 2,
    queryFn: () => api.listNotifications(workspaceId!, { limit: 20 }),
  });

  const markOne = useMutation({
    mutationFn: (id: string) => api.markNotificationRead(workspaceId!, id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["notifications", workspaceId] }),
  });
  const markAll = useMutation({
    mutationFn: () => api.markAllNotificationsRead(workspaceId!),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["notifications", workspaceId] }),
  });

  useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!workspaceId) return null;
  const unread = listQuery.data?.unread_count ?? 0;
  const items = listQuery.data?.items ?? [];

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="relative inline-flex size-10 items-center justify-center rounded-[var(--radius-control)] text-fg-muted hover:bg-bg-subtle hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        aria-label={he.notificationsBell}
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        data-testid="notifications-bell"
        onClick={() => setOpen((value) => !value)}
      >
        <Bell className="size-4" aria-hidden />
        {unread > 0 ? (
          <span className="absolute end-1 top-1 min-w-4 rounded-full bg-danger px-1 text-[10px] font-semibold text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        ) : null}
      </button>
      {open
        ? createPortal(
            <div
              ref={panelRef}
              id={menuId}
              role="menu"
              className="fixed z-50 w-[min(22rem,calc(100vw-1.5rem))] rounded-[var(--radius-card)] border border-border bg-bg-1 p-2 shadow-lg"
              style={{
                top: (triggerRef.current?.getBoundingClientRect().bottom ?? 0) + 8,
                insetInlineEnd: 16,
              }}
            >
              <div className="mb-2 flex items-center justify-between gap-2 px-2 py-1">
                <p className="text-sm font-semibold text-fg">{he.notificationsTitle}</p>
                {unread > 0 ? (
                  <button
                    type="button"
                    className="text-xs text-fg-muted hover:text-fg"
                    onClick={() => markAll.mutate()}
                  >
                    {he.notificationsMarkAll}
                  </button>
                ) : null}
              </div>
              {listQuery.isError && !listQuery.isFetching ? (
                <p className="px-2 py-3 text-sm text-fg-muted">{he.notificationsError}</p>
              ) : items.length === 0 ? (
                <p className="px-2 py-3 text-sm text-fg-muted">{he.notificationsEmpty}</p>
              ) : (
                <ul className="max-h-80 overflow-auto">
                  {items.map((item) => {
                    const unreadItem = !item.read_at;
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          role="menuitem"
                          className={`flex w-full flex-col items-start gap-0.5 rounded-[var(--radius-control)] px-2 py-2 text-start text-sm hover:bg-bg-subtle ${unreadItem ? "font-medium" : "text-fg-muted"}`}
                          onClick={() => {
                            if (unreadItem) markOne.mutate(item.id);
                            setOpen(false);
                            goTo(item, navigate);
                          }}
                        >
                          <span>{item.title}</span>
                          {item.body ? <span className="text-xs text-fg-muted">{item.body}</span> : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
              <Link
                to="/app/settings/notifications"
                className="mt-1 block px-2 py-2 text-xs text-fg-muted hover:text-fg"
                onClick={() => setOpen(false)}
              >
                {he.notificationsPrefs}
              </Link>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
