"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import RequireOnboarding from "../../../components/auth/RequireOnboarding";
import AppShell from "../../../components/layout/AppShell";
import AdminTabs from "../../../components/admin/AdminTabs";
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

  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string>("");

  const didLoad = useRef(false);

  useEffect(() => {
    if (!isAdmin) return;
    if (didLoad.current) return;
    didLoad.current = true;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  useEffect(() => {
    function onDocClick() {
      setOpenMenuId(null);
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

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
          <table className="table" style={{ width: "100%" }}>
            <thead>
              <tr>
                <th style={{ width: 360 }}>Email</th>
                <th style={{ width: 110 }}>Status</th>
                <th style={{ width: 140 }}>Invited</th>
                <th style={{ width: 140 }}>Created</th>
                <th style={{ width: 140 }}>Last sign-in</th>
                <th style={{ width: 90 }} />
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ padding: 14 }} className="muted">
                    Loading…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: 14 }} className="muted">
                    No results.
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{r.email || "—"}</div>
                      <div className="muted" style={{ fontSize: 12 }}>
                        {r.id}
                      </div>
                    </td>

                    <td>
                      <span className={r.status === "pending" ? "badge badgeWarn" : "badge badgeOk"}>{r.status}</span>
                    </td>

                    <td>{fmtDate(r.invited_at)}</td>
                    <td>{fmtDate(r.created_at)}</td>
                    <td>{fmtDate(r.last_sign_in_at)}</td>

                    <td style={{ textAlign: "right" }}>
                      <div style={{ position: "relative", display: "inline-block" }}>
                        <button
                          className="btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenuId((prev) => (prev === r.id ? null : r.id));
                          }}
                          disabled={busyId === r.id}
                          aria-label="Actions"
                        >
                          •••
                        </button>

                        {openMenuId === r.id ? (
                          <div
                            className="card"
                            style={{
                              position: "absolute",
                              right: 0,
                              top: 40,
                              zIndex: 20,
                              width: 220,
                              padding: 6,
                            }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              style={menuBtn}
                              onClick={async () => {
                                await navigator.clipboard.writeText(r.email || "");
                                setMsg("Email copied ✅");
                                setOpenMenuId(null);
                              }}
                            >
                              Copy email
                            </button>

                            <button
                              style={menuBtn}
                              onClick={async () => {
                                await navigator.clipboard.writeText(r.id);
                                setMsg("User ID copied ✅");
                                setOpenMenuId(null);
                              }}
                            >
                              Copy user ID
                            </button>

                            <button
                              style={menuBtn}
                              disabled={!r.email || busyId === r.email}
                              onClick={async () => {
                                if (!r.email) return;
                                await copyInviteLink(r.email);
                                setOpenMenuId(null);
                              }}
                            >
                              {busyId === r.email ? "Working…" : "Copy invite link"}
                            </button>

                            {r.status === "pending" ? (
                              <button
                                style={{ ...menuBtn, color: "rgba(239,68,68,0.95)" }}
                                disabled={busyId === r.id}
                                onClick={async () => {
                                  await cancelInvite(r.id);
                                  setOpenMenuId(null);
                                }}
                              >
                                {busyId === r.id ? "Cancelling…" : "Cancel invitation"}
                              </button>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const menuBtn: React.CSSProperties = {
  width: "100%",
  textAlign: "left",
  padding: "10px 12px",
  background: "transparent",
  border: "none",
  cursor: "pointer",
  fontSize: 13,
};
