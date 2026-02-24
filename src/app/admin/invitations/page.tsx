"use client";

import RequireOnboarding from "../../../components/auth/RequireOnboarding";
import AppShell from "../../../components/layout/AppShell";
import AdminTabs from "../../../components/admin/AdminTabs";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabaseBrowser";
import { useProfile } from "../../../lib/useProfile";
import { Copy, MoreHorizontal, RefreshCw, Search } from "lucide-react";

type InviteStatus = "pending" | "active";
type InviteUser = {
  id: string;
  email: string;
  status: InviteStatus;
  created_at: string | null;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
};

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
}

export default function AdminInvitationsPage() {
  const { profile } = useProfile();
  const isAdmin = profile?.role === "admin";

  return (
    <RequireOnboarding>
      <AppShell title="Invitations" subtitle="Admin directory (Invitations)">
        <AdminTabs active="invitations" />
        {isAdmin ? <Invitations /> : <AdminOnly />}
      </AppShell>
    </RequireOnboarding>
  );
}

function AdminOnly() {
  return (
    <div
      className="card cardPad"
      style={{
        maxWidth: 980,
        borderColor: "rgba(239,68,68,0.35)",
        background: "rgba(239,68,68,0.06)",
      }}
    >
      <div style={{ fontWeight: 950 }}>Admin only</div>
      <div className="muted" style={{ marginTop: 6 }}>
        You don’t have access to Invitations.
      </div>
    </div>
  );
}

function Invitations() {
  const { userId } = useProfile();

  const [rows, setRows] = useState<InviteUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string>("");
  const [msg, setMsg] = useState<string>("");

  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | InviteStatus>("all");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      const t = e.target as HTMLElement | null;
      if (!t) return;
      if (t.closest?.("[data-row-menu]")) return;
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

      const json = await res.json().catch(() => ({}));
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

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (status !== "all" && r.status !== status) return false;
      if (!needle) return true;
      return (r.email || "").toLowerCase().includes(needle) || r.id.toLowerCase().includes(needle);
    });
  }, [rows, q, status]);

  const counts = useMemo(() => {
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

      const json = await res.json().catch(() => ({}));
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

      const json = await res.json().catch(() => ({}));
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

  return (
    <div style={{ maxWidth: 980 }}>
      {/* Directory toolbar */}
      <div className="card cardPad" style={{ marginBottom: 12 }}>
        <div className="row" style={{ justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div className="row" style={{ gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <div className="peopleSearch" style={{ minWidth: 260 }}>
              <Search size={16} />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search email or user ID…" />
            </div>

            <select className="select" value={status} onChange={(e) => setStatus(e.target.value as any)} style={{ width: 160 }}>
              <option value="all">All</option>
              <option value="pending">Pending</option>
              <option value="active">Active</option>
            </select>

            <button className="pill" onClick={() => { setQ(""); setStatus("all"); }}>
              Clear
            </button>
          </div>

          <div className="row" style={{ gap: 8, alignItems: "center" }}>
            <span className="tag tagMuted">Total: {counts.total}</span>
            <span className="tag tagWarn">Pending: {counts.pending}</span>
            <span className="tag tagOk">Active: {counts.active}</span>
            <span className="tag tagMuted">Showing: {counts.showing}</span>

            <button className="iconBtn" onClick={load} title="Refresh" aria-label="Refresh">
              <RefreshCw size={18} />
            </button>
          </div>
        </div>

        {msg ? (
          <div
            style={{
              marginTop: 12,
              padding: 10,
              borderRadius: 12,
              border: `1px solid ${msg.includes("✅") ? "rgba(34,197,94,0.35)" : "rgba(239,68,68,0.35)"}`,
              background: msg.includes("✅") ? "rgba(34,197,94,0.06)" : "rgba(239,68,68,0.06)",
              fontSize: 13,
              whiteSpace: "pre-wrap",
            }}
          >
            {msg}
          </div>
        ) : null}
      </div>

      {/* Table */}
      <div className="card" style={{ overflow: "hidden" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.6fr 0.6fr 0.8fr 0.8fr 120px",
            gap: 12,
            padding: "12px 14px",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
            fontSize: 12,
            letterSpacing: 0.4,
            fontWeight: 900,
            color: "rgba(255,255,255,0.72)",
          }}
        >
          <div>Email</div>
          <div>Status</div>
          <div>Created</div>
          <div>Last sign-in</div>
          <div style={{ textAlign: "right" }}>Actions</div>
        </div>

        {loading ? (
          <div style={{ padding: 18 }} className="muted">Loading…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 18 }}>
            <div style={{ fontWeight: 950 }}>No results</div>
            <div className="muted" style={{ marginTop: 6 }}>Try changing search or filters.</div>
          </div>
        ) : (
          filtered.map((r) => (
            <div
              key={r.id}
              style={{
                display: "grid",
                gridTemplateColumns: "1.6fr 0.6fr 0.8fr 0.8fr 120px",
                gap: 12,
                padding: "12px 14px",
                borderBottom: "1px solid rgba(255,255,255,0.06)",
                alignItems: "center",
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 900, overflow: "hidden", textOverflow: "ellipsis" }}>
                  {r.email || "—"}
                </div>
                <div className="muted mono" style={{ fontSize: 11, marginTop: 4, overflow: "hidden", textOverflow: "ellipsis" }}>
                  {r.id}
                </div>
              </div>

              <div>
                <span className={`tag ${r.status === "pending" ? "tagWarn" : "tagOk"}`}>{r.status}</span>
              </div>

              <div>{fmtDate(r.created_at)}</div>
              <div>{fmtDate(r.last_sign_in_at)}</div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, alignItems: "center" }}>
                {r.status === "pending" ? (
                  <button className="pill" disabled={busyId === r.email} onClick={() => copyInviteLink(r.email)}>
                    <Copy size={16} style={{ marginRight: 8 }} />
                    {busyId === r.email ? "…" : "Copy link"}
                  </button>
                ) : null}

                <div data-row-menu style={{ position: "relative" }}>
                  <button
                    className="iconBtn"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setOpenMenuId((cur) => (cur === r.id ? null : r.id));
                    }}
                    aria-label="Row actions"
                  >
                    <MoreHorizontal size={18} />
                  </button>

                  {openMenuId === r.id && (
                    <div
                      style={{
                        position: "absolute",
                        right: 0,
                        top: "calc(100% + 8px)",
                        background: "rgba(12,16,24,0.98)",
                        border: "1px solid rgba(255,255,255,0.10)",
                        borderRadius: 12,
                        minWidth: 200,
                        overflow: "hidden",
                        boxShadow: "0 20px 60px rgba(0,0,0,0.45)",
                        zIndex: 20,
                      }}
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

                      {r.status === "pending" ? (
                        <button
                          style={{ ...menuBtn, color: "rgba(239,68,68,0.95)" }}
                          onClick={() => {
                            setOpenMenuId(null);
                            cancelInvite(r.id);
                          }}
                        >
                          Cancel invitation
                        </button>
                      ) : (
                        <div style={{ padding: 10 }} className="muted">
                          Cancel applies to pending only.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
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
