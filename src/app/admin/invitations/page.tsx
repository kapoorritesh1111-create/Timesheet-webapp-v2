"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import RequireOnboarding from "../../../components/auth/RequireOnboarding";
import AppShell from "../../../components/layout/AppShell";
import AdminTabs from "../../../components/admin/AdminTabs";
import DataTable, { Tag, ActionItem } from "../../../components/ui/DataTable";
import { supabase } from "../../../lib/supabaseBrowser";
import { useProfile } from "../../../lib/useProfile";

type InviteStatus = "all" | "pending" | "active";

type InviteUser = {
  id: string;
  email: string | null;
  status: "pending" | "active";
  invited_at: string | null;
  created_at: string | null;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
};

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
    });
  } catch {
    return "—";
  }
}

export default function AdminInvitationsPage() {
  return (
    <RequireOnboarding>
      <AppShell>
        <InvitationsInner />
      </AppShell>
    </RequireOnboarding>
  );
}

function InvitationsInner() {
  const { profile } = useProfile();
  const isAdmin = profile?.role === "admin";

  const [rows, setRows] = useState<InviteUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  const [q, setQ] = useState("");
  const [status, setStatus] = useState<InviteStatus>("all");

  const [busyId, setBusyId] = useState<string>("");

  const didLoad = useRef(false);

  useEffect(() => {
    if (!isAdmin) return;
    if (didLoad.current) return;
    didLoad.current = true;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  async function load() {
    setLoading(true);
    setMsg("");

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      if (!token) {
        setMsg("Not logged in.");
        setRows([]);
        return;
      }

      const res = await fetch("/api/admin/invitations", {
        headers: { authorization: `Bearer ${token}` },
      });

      const json = await res.json().catch(() => ({} as any));
      if (!res.ok || !json.ok) {
        setMsg(json?.error || `Failed to load (${res.status})`);
        setRows([]);
        return;
      }

      setRows((json.users ?? []) as InviteUser[]);
    } catch (e: any) {
      setMsg(e?.message || "Failed to load");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (status !== "all" && r.status !== status) return false;
      if (!needle) return true;
      const hay = `${r.email ?? ""} ${r.id}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [rows, q, status]);

  const stats = useMemo(() => {
    const total = rows.length;
    const pending = rows.filter((r) => r.status === "pending").length;
    const active = rows.filter((r) => r.status === "active").length;
    return { total, pending, active, showing: filtered.length };
  }, [rows, filtered]);

  async function copyInviteLink(email: string) {
    setBusyId(email);
    setMsg("");

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        setMsg("Not logged in.");
        return;
      }

      const res = await fetch("/api/admin/invitations", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ email }),
      });

      const json = await res.json().catch(() => ({} as any));
      if (!res.ok || !json.ok) {
        setMsg(json?.error || `Failed to generate link (${res.status})`);
        return;
      }

      const link = String(json.action_link || "");
      await navigator.clipboard.writeText(link);
      setMsg("Invite link copied ✅");
    } catch (e: any) {
      setMsg(e?.message || "Could not copy invite link");
    } finally {
      setBusyId("");
    }
  }

  async function cancelInvite(user_id: string) {
    if (!confirm("Cancel this invitation? This will delete the invited user.")) return;

    setBusyId(user_id);
    setMsg("");

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      if (!token) {
        setMsg("Not logged in.");
        return;
      }

      const res = await fetch("/api/admin/invitations", {
        method: "DELETE",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ user_id }),
      });

      const json = await res.json().catch(() => ({} as any));
      if (!res.ok || !json.ok) {
        setMsg(json?.error || `Cancel failed (${res.status})`);
        return;
      }

      setMsg("Invitation cancelled ✅");
      setRows((prev) => prev.filter((r) => r.id !== user_id));
    } catch (e: any) {
      setMsg(e?.message || "Cancel failed");
    } finally {
      setBusyId("");
    }
  }

  if (!isAdmin) {
    return (
      <div style={{ maxWidth: 980 }}>
        <h1 style={{ margin: "8px 0 4px" }}>Invitations</h1>
        <div className="muted">Admins only.</div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1100 }}>
      <div className="row" style={{ alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h1 style={{ margin: "8px 0 4px" }}>Invitations</h1>
          <div className="muted">Admin directory (Invitations)</div>
        </div>

        <button className="btn" onClick={load} disabled={loading} title="Refresh">
          Refresh
        </button>
      </div>

      <div style={{ marginTop: 12, marginBottom: 12 }}>
        <AdminTabs active="invitations" />
      </div>

      <div className="card cardPad" style={{ marginBottom: 12 }}>
        <div className="row" style={{ gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <input
            className="input"
            placeholder="Search email or user ID…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ width: 260 }}
          />

          <select className="input" value={status} onChange={(e) => setStatus(e.target.value as InviteStatus)} style={{ width: 160 }}>
            <option value="all">All</option>
            <option value="pending">Pending</option>
            <option value="active">Active</option>
          </select>

          <button
            className="btn"
            onClick={() => {
              setQ("");
              setStatus("all");
            }}
          >
            Clear
          </button>

          <div className="row" style={{ marginLeft: "auto", gap: 8, flexWrap: "wrap" }}>
            <span className="badge">Total: {stats.total}</span>
            <span className="badge badgeWarn">Pending: {stats.pending}</span>
            <span className="badge badgeOk">Active: {stats.active}</span>
            <span className="badge">Showing: {stats.showing}</span>
          </div>
        </div>

        {msg ? (
          <div style={{ marginTop: 10 }} className="muted">
            {msg}
          </div>
        ) : null}
      </div>

      <div className="card" style={{ overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <DataTable
            loading={loading}
            rows={filtered}
            rowKey={(r) => r.id}
            columns={[
              {
                key: "email",
                header: "Email",
                width: 360,
                cell: (r) => (
                  <div>
                    <div style={{ fontWeight: 800 }}>{r.email || "—"}</div>
                    <div className="muted" style={{ fontSize: 12 }}>
                      {r.id}
                    </div>
                  </div>
                ),
              },
              {
                key: "status",
                header: "Status",
                width: 120,
                cell: (r) => (
                  <Tag tone={r.status === "pending" ? "warn" : "success"}>{r.status}</Tag>
                ),
              },
              { key: "invited", header: "Invited", width: 140, cell: (r) => fmtDate(r.invited_at) },
              { key: "created", header: "Created", width: 140, cell: (r) => fmtDate(r.created_at) },
              { key: "last", header: "Last sign-in", width: 140, cell: (r) => fmtDate(r.last_sign_in_at) },
            ]}
            emptyTitle="No invitations"
            emptySubtitle="Try adjusting your search or status filter."
            actions={(r): ActionItem<InviteUser>[] => [
              {
                label: "Copy email",
                disabled: !r.email,
                onSelect: async () => {
                  await navigator.clipboard.writeText(r.email || "");
                  setMsg("Email copied ✅");
                },
              },
              {
                label: "Copy user ID",
                onSelect: async () => {
                  await navigator.clipboard.writeText(r.id);
                  setMsg("User ID copied ✅");
                },
              },
              {
                label: busyId === (r.email || "") ? "Working…" : "Copy invite link",
                disabled: !r.email || busyId === (r.email || ""),
                onSelect: async () => {
                  if (!r.email) return;
                  await copyInviteLink(r.email);
                },
              },
              ...(r.status === "pending"
                ? [
                    {
                      label: busyId === r.id ? "Cancelling…" : "Cancel invitation",
                      danger: true,
                      disabled: busyId === r.id,
                      onSelect: async () => {
                        await cancelInvite(r.id);
                      },
                    } as ActionItem<InviteUser>,
                  ]
                : []),
            ]}
          />
        </div>
      </div>
    </div>
  );
}
