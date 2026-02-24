"use client";

import RequireOnboarding from "../../../components/auth/RequireOnboarding";
import AppShell from "../../../components/layout/AppShell";
import AdminTabs from "../../../components/admin/AdminTabs";
import UserDrawer, { UserRow } from "../../../components/admin/UserDrawer";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabaseBrowser";
import { useProfile } from "../../../lib/useProfile";
import { Search } from "lucide-react";

type Role = "admin" | "manager" | "contractor";
type ManagerLite = { id: string; full_name: string | null };

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
}

export default function AdminUsersPage() {
  const { profile } = useProfile();
  const isAdmin = profile?.role === "admin";

  return (
    <RequireOnboarding>
      <AppShell title="User management" subtitle="Admin directory (Users)">
        <AdminTabs active="users" />
        {isAdmin ? <UsersDirectory /> : <AdminOnly />}
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
        You don’t have access to Users.
      </div>
    </div>
  );
}

function UsersDirectory() {
  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  const [q, setQ] = useState("");
  const [role, setRole] = useState<"all" | Role>("all");
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all");

  const [selected, setSelected] = useState<UserRow | null>(null);

  const [managers, setManagers] = useState<ManagerLite[]>([]);

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

      const res = await fetch("/api/admin/users", {
        headers: { authorization: `Bearer ${token}` },
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) {
        setMsg(json?.error || `Failed to load (${res.status})`);
        setRows([]);
        return;
      }

      setRows((json.users ?? []) as UserRow[]);
    } catch (e: any) {
      setMsg(e?.message || "Failed to load");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadManagers() {
    // for dropdown in drawer
    const { data, error } = await supabase.from("profiles").select("id, full_name, role").eq("role", "manager");
    if (!error) {
      setManagers(((data as any) ?? []).map((m: any) => ({ id: m.id, full_name: m.full_name })));
    }
  }

  useEffect(() => {
    load();
    loadManagers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (role !== "all" && r.role !== role) return false;
      if (status !== "all") {
        if (status === "active" && !r.is_active) return false;
        if (status === "inactive" && r.is_active) return false;
      }
      if (!needle) return true;
      const hay = `${r.full_name ?? ""} ${r.email ?? ""} ${r.id}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [rows, q, role, status]);

  const stats = useMemo(() => {
    const total = rows.length;
    const active = rows.filter((r) => r.is_active).length;
    const inactive = total - active;
    return { total, active, inactive, showing: filtered.length };
  }, [rows, filtered]);

  return (
    <div style={{ maxWidth: 1100 }}>
      <div className="card cardPad" style={{ marginBottom: 12 }}>
        <div className="row" style={{ justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div className="peopleSearch" style={{ minWidth: 320 }}>
            <Search size={16} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email, or ID…" />
          </div>

          <div className="row" style={{ gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <select className="select" value={role} onChange={(e) => setRole(e.target.value as any)} style={{ width: 160 }}>
              <option value="all">All roles</option>
              <option value="admin">Admin</option>
              <option value="manager">Manager</option>
              <option value="contractor">Contractor</option>
            </select>

            <select className="select" value={status} onChange={(e) => setStatus(e.target.value as any)} style={{ width: 160 }}>
              <option value="all">All status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>

            <button className="pill" onClick={() => { setQ(""); setRole("all"); setStatus("all"); }}>
              Clear
            </button>
          </div>

          <div className="row" style={{ gap: 8, alignItems: "center" }}>
            <span className="tag tagMuted">Users: {stats.total}</span>
            <span className="tag tagOk">Active: {stats.active}</span>
            <span className="tag tagWarn">Inactive: {stats.inactive}</span>
            <span className="tag tagMuted">Showing: {stats.showing}</span>
            <button className="pill" onClick={load} disabled={loading}>
              {loading ? "Loading…" : "Refresh"}
            </button>
          </div>
        </div>

        {msg ? (
          <div style={{ marginTop: 12 }} className="muted">
            {msg}
          </div>
        ) : null}
      </div>

      <div className="card" style={{ overflow: "hidden" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.6fr 0.7fr 0.8fr 0.6fr 0.6fr 0.7fr",
            gap: 12,
            padding: "12px 14px",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
            fontSize: 12,
            fontWeight: 900,
            color: "rgba(255,255,255,0.72)",
          }}
        >
          <div>User</div>
          <div>Role</div>
          <div>Manager</div>
          <div>Rate</div>
          <div>Status</div>
          <div>Last sign-in</div>
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
            <button
              key={r.id}
              onClick={() => setSelected(r)}
              style={{
                width: "100%",
                textAlign: "left",
                background: "transparent",
                border: "none",
                cursor: "pointer",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1.6fr 0.7fr 0.8fr 0.6fr 0.6fr 0.7fr",
                  gap: 12,
                  padding: "12px 14px",
                  borderBottom: "1px solid rgba(255,255,255,0.06)",
                  alignItems: "center",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 900, overflow: "hidden", textOverflow: "ellipsis" }}>
                    {r.full_name || r.email || "—"}
                  </div>
                  <div className="muted" style={{ fontSize: 12, marginTop: 4, overflow: "hidden", textOverflow: "ellipsis" }}>
                    {r.email || r.id}
                  </div>
                </div>

                <div style={{ textTransform: "capitalize" }}>{r.role}</div>

                <div className="muted" style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                  {r.role === "contractor"
                    ? managers.find((m) => m.id === r.manager_id)?.full_name || "—"
                    : "—"}
                </div>

                <div>{Number(r.hourly_rate || 0)}</div>

                <div>
                  <span className={`tag ${r.is_active ? "tagOk" : "tagWarn"}`}>
                    {r.is_active ? "active" : "inactive"}
                  </span>
                </div>

                <div>{fmtDate(r.last_sign_in_at)}</div>
              </div>
            </button>
          ))
        )}
      </div>

      <UserDrawer
        open={!!selected}
        onClose={() => setSelected(null)}
        user={selected}
        managers={managers}
        onSaved={async () => {
          await load();
          await loadManagers();
        }}
      />
    </div>
  );
}
