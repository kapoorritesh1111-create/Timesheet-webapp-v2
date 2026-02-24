// src/app/admin/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import RequireOnboarding from "../../components/auth/RequireOnboarding";
import AppShell from "../../components/layout/AppShell";
import AdminTabs from "../../components/admin/AdminTabs";
import { supabase } from "../../lib/supabaseBrowser";
import { useProfile } from "../../lib/useProfile";
import { Search } from "lucide-react";

type Role = "admin" | "manager" | "contractor";
type ManagerRow = { id: string; full_name: string | null; role: Role };
type ProjectRow = { id: string; name: string; is_active: boolean };

function isValidEmail(s: string) {
  const v = s.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function normalize(s: string | null | undefined) {
  return (s ?? "").toLowerCase().trim();
}

export default function AdminPage() {
  return (
    <RequireOnboarding>
      <AdminInner />
    </RequireOnboarding>
  );
}

function AdminInner() {
  const { loading: profLoading, userId, profile, error: profErr } = useProfile();

  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [hourlyRate, setHourlyRate] = useState<number>(0);
  const [inviteRole, setInviteRole] = useState<Exclude<Role, "admin">>("contractor");

  const [managers, setManagers] = useState<ManagerRow[]>([]);
  const [managerId, setManagerId] = useState<string>("");

  // Projects for invite-time assignment
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [projectQuery, setProjectQuery] = useState("");
  const [projectIds, setProjectIds] = useState<string[]>([]);

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>("");

  const isAdmin = profile?.role === "admin";

  const canSend = useMemo(() => {
    if (!isValidEmail(email)) return false;
    if (!fullName.trim()) return false;
    if (!["manager", "contractor"].includes(inviteRole)) return false;

    if (inviteRole === "contractor") {
      if (!managerId) return false;
      if (Number.isNaN(hourlyRate) || hourlyRate < 0) return false;
    }
    return true;
  }, [email, fullName, inviteRole, hourlyRate, managerId]);

  // Load managers list
  useEffect(() => {
    if (!profile?.org_id) return;
    if (!isAdmin) return;

    let cancelled = false;
    (async () => {
      setMsg("");

      const { data: mgrs, error: mgrErr } = await supabase
        .from("profiles")
        .select("id, full_name, role")
        .eq("org_id", profile.org_id)
        .in("role", ["admin", "manager"])
        .eq("is_active", true)
        .order("role", { ascending: true })
        .order("full_name", { ascending: true });

      if (cancelled) return;

      if (mgrErr) {
        setManagers([]);
        setManagerId("");
        setMsg(mgrErr.message);
        return;
      }

      const list = (((mgrs as any) ?? []) as ManagerRow[]) || [];
      setManagers(list);

      const prefer = list.find((m) => m.role === "manager")?.id || list[0]?.id || "";
      setManagerId((prev) => prev || prefer);
    })();

    return () => {
      cancelled = true;
    };
  }, [profile?.org_id, isAdmin]);

  // Load projects for assignment
  useEffect(() => {
    if (!profile?.org_id) return;
    if (!isAdmin) return;

    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, name, is_active")
        .eq("org_id", profile.org_id)
        .order("is_active", { ascending: false })
        .order("name", { ascending: true });

      if (cancelled) return;

      if (error) {
        // Don't hard-fail the page; just show message
        setProjects([]);
        setMsg((m) => m || error.message);
        return;
      }

      setProjects(((data as any) ?? []) as ProjectRow[]);
    })();

    return () => {
      cancelled = true;
    };
  }, [profile?.org_id, isAdmin]);

  // If role changes, keep project selection (works for both)
  // but you can optionally auto-clear for managers if you prefer.
  useEffect(() => {
    if (inviteRole === "manager") {
      // Keep selections (some orgs want managers on projects too).
      // If you want to clear, uncomment:
      // setProjectIds([]);
    }
  }, [inviteRole]);

  const filteredProjects = useMemo(() => {
    const needle = normalize(projectQuery);
    if (!needle) return projects;
    return projects.filter((p) => normalize(p.name).includes(needle));
  }, [projects, projectQuery]);

  const selectedProjects = useMemo(() => {
    const map = new Map(projects.map((p) => [p.id, p] as const));
    return projectIds.map((id) => map.get(id)).filter(Boolean) as ProjectRow[];
  }, [projects, projectIds]);

  function toggleProject(id: string) {
    setProjectIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function clearProjects() {
    setProjectIds([]);
    setProjectQuery("");
  }

  async function sendInvite(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    setBusy(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        setMsg("Not logged in.");
        return;
      }

      const body = {
        email: email.trim(),
        full_name: fullName.trim(),
        hourly_rate: inviteRole === "contractor" ? Number(hourlyRate ?? 0) : 0,
        role: inviteRole,
        manager_id: inviteRole === "contractor" ? (managerId || null) : null,
        project_ids: projectIds, // ✅ already supported by your /api/admin/invite
      };

      const res = await fetch("/api/admin/invite", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(body),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) {
        setMsg(json?.error || `Invite failed (${res.status})`);
        return;
      }

      setMsg("Invite sent ✅ (projects assigned)");
      setEmail("");
      setFullName("");
      setHourlyRate(0);
      setInviteRole("contractor");
      setProjectIds([]);
      setProjectQuery("");
    } catch (err: any) {
      setMsg(err?.message || "Invite failed");
    } finally {
      setBusy(false);
    }
  }

  if (profLoading) {
    return (
      <AppShell title="Admin" subtitle="Loading…">
        <div className="card cardPad" style={{ maxWidth: 980 }}>
          <div className="skeleton" style={{ height: 16, width: 220 }} />
          <div className="skeleton" style={{ height: 42, width: "100%", marginTop: 10 }} />
          <div className="skeleton" style={{ height: 320, width: "100%", marginTop: 10 }} />
        </div>
      </AppShell>
    );
  }

  if (!userId) {
    return (
      <AppShell title="Admin" subtitle="Admin-only tools">
        <div className="card cardPad" style={{ maxWidth: 980 }}>
          <div style={{ fontWeight: 950 }}>Please log in.</div>
        </div>
      </AppShell>
    );
  }

  if (!profile) {
    return (
      <AppShell title="Admin" subtitle="Admin-only tools">
        <div className="card cardPad" style={{ maxWidth: 980 }}>
          <div style={{ fontWeight: 950 }}>Profile missing</div>
          <pre style={{ whiteSpace: "pre-wrap", marginTop: 8 }}>{profErr || "No profile found."}</pre>
        </div>
      </AppShell>
    );
  }

  if (!isAdmin) {
    return (
      <AppShell title="Admin" subtitle="Admin-only tools">
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
            Your role is <b>{profile.role}</b>. Ask an admin for access if needed.
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Admin" subtitle="Invite users and maintain org setup">
      <AdminTabs active="invite" />

      {msg ? (
        <div
          className="card cardPad"
          style={{
            maxWidth: 980,
            marginBottom: 12,
            borderColor: msg.includes("✅") ? "rgba(34,197,94,0.35)" : "rgba(239,68,68,0.35)",
            background: msg.includes("✅") ? "rgba(34,197,94,0.06)" : "rgba(239,68,68,0.06)",
          }}
        >
          <div style={{ fontWeight: 950 }}>{msg.includes("✅") ? "Success" : "Notice"}</div>
          <div style={{ whiteSpace: "pre-wrap", marginTop: 6, fontSize: 13 }}>{msg}</div>
        </div>
      ) : null}

      <div className="card cardPad" style={{ maxWidth: 980 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            alignItems: "baseline",
            flexWrap: "wrap",
          }}
        >
          <div>
            <div style={{ fontWeight: 950, fontSize: 16 }}>Invite user</div>
            <div className="muted" style={{ marginTop: 6 }}>
              Assign projects now so they’re ready on day one.
            </div>
          </div>
          <span className="tag">Admin</span>
        </div>

        <form onSubmit={sendInvite} style={{ marginTop: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 2fr", gap: 12 }}>
            <div>
              <div className="label">Email</div>
              <input
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
              />
            </div>
            <div>
              <div className="label">Full name</div>
              <input
                className="input"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Jane Contractor"
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
            <div>
              <div className="label">Role</div>
              <select className="select" value={inviteRole} onChange={(e) => setInviteRole(e.target.value as any)}>
                <option value="contractor">contractor</option>
                <option value="manager">manager</option>
              </select>
            </div>

            {inviteRole === "contractor" ? (
              <div>
                <div className="label">Hourly rate</div>
                <input
                  className="input"
                  type="number"
                  value={hourlyRate}
                  onChange={(e) => setHourlyRate(Number(e.target.value))}
                  min={0}
                />
              </div>
            ) : (
              <div>
                <div className="label">Hourly rate</div>
                <input className="input" value="0" disabled />
              </div>
            )}
          </div>

          {inviteRole === "contractor" ? (
            <div style={{ marginTop: 12 }}>
              <div className="label">Assign manager</div>
              <select className="select" value={managerId} onChange={(e) => setManagerId(e.target.value)}>
                {managers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.full_name ?? m.id} ({m.role})
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {/* Project assignment */}
          <div style={{ marginTop: 12 }}>
            <div className="label">Assign projects (optional)</div>

            <div className="peopleSearch" style={{ marginTop: 8, maxWidth: 520 }}>
              <Search size={16} />
              <input
                value={projectQuery}
                onChange={(e) => setProjectQuery(e.target.value)}
                placeholder="Search projects…"
              />
            </div>

            {selectedProjects.length > 0 ? (
              <div className="row" style={{ gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                {selectedProjects.map((p) => (
                  <span key={p.id} className={`tag ${p.is_active ? "tagOk" : "tagMuted"}`}>
                    {p.name}
                  </span>
                ))}
                <button type="button" className="pill" onClick={clearProjects}>
                  Clear projects
                </button>
              </div>
            ) : (
              <div className="muted" style={{ marginTop: 8 }}>
                No projects selected.
              </div>
            )}

            <div
              className="card"
              style={{
                marginTop: 10,
                padding: 10,
                maxHeight: 220,
                overflow: "auto",
                borderColor: "rgba(255,255,255,0.08)",
              }}
            >
              {filteredProjects.length === 0 ? (
                <div className="muted" style={{ padding: 8 }}>
                  No projects match your search.
                </div>
              ) : (
                filteredProjects.map((p) => (
                  <label
                    key={p.id}
                    style={{
                      display: "flex",
                      gap: 10,
                      alignItems: "center",
                      padding: "8px 6px",
                      borderRadius: 10,
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={projectIds.includes(p.id)}
                      onChange={() => toggleProject(p.id)}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 800 }}>{p.name}</div>
                      <div className="muted" style={{ fontSize: 12 }}>
                        {p.is_active ? "Active" : "Inactive"} • {p.id}
                      </div>
                    </div>
                    <span className={`tag ${p.is_active ? "tagOk" : "tagMuted"}`}>{p.is_active ? "Active" : "Inactive"}</span>
                  </label>
                ))
              )}
            </div>

            <div className="muted" style={{ marginTop: 8, fontSize: 13 }}>
              Tip: Assigning projects here will create <span className="mono">project_members</span> rows immediately for the invited user.
            </div>
          </div>

          <div style={{ marginTop: 14, display: "flex", gap: 10, alignItems: "center" }}>
            <button className="btn" type="submit" disabled={!canSend || busy}>
              {busy ? "Sending…" : "Send invite"}
            </button>
            <div className="muted" style={{ fontSize: 13 }}>
              Invites are sent via Supabase Auth.
            </div>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
