// src/app/profiles/page.tsx
"use client";

import RequireOnboarding from "../../components/auth/RequireOnboarding";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "../../components/layout/AppShell";
import { supabase } from "../../lib/supabaseBrowser";
import { useProfile } from "../../lib/useProfile";
import { Copy, Filter, MoreHorizontal, Search, UserCheck, UserX, X } from "lucide-react";

type Role = "admin" | "manager" | "contractor";
type ActiveFilter = "all" | "active" | "inactive";
type ScopeFilter = "visible" | "all_org";

type ProfileRow = {
  id: string;
  org_id: string;
  role: Role;
  full_name: string | null;
  hourly_rate: number | null;
  is_active: boolean | null;
  manager_id: string | null;
  created_at?: string | null;
};

function normalize(s: string) {
  return s.trim().toLowerCase();
}

function tag(text: string, kind?: "ok" | "warn" | "muted") {
  const cls = kind === "ok" ? "tag tagOk" : kind === "warn" ? "tag tagWarn" : "tag";
  return <span className={cls}>{text}</span>;
}

function roleLabel(r: Role) {
  if (r === "admin") return "Admin";
  if (r === "manager") return "Manager";
  return "Contractor";
}

function safeName(r: ProfileRow) {
  return (r.full_name || "").trim() || "(no name)";
}

function copyToClipboard(text: string) {
  try {
    navigator.clipboard.writeText(text);
  } catch {
    // ignore
  }
}

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
}


function sig(r: Pick<ProfileRow, "full_name" | "role" | "manager_id" | "hourly_rate" | "is_active">) {
  return JSON.stringify({
    full_name: (r.full_name || "").trim() || null,
    role: r.role,
    manager_id: r.manager_id || null,
    hourly_rate: Number(r.hourly_rate ?? 0),
    is_active: r.is_active !== false,
  });
}

function ProfilesInner() {
  const router = useRouter();
  const { loading: profLoading, profile, userId, error: profErr } = useProfile();

  const [rows, setRows] = useState<ProfileRow[]>([]);
  const [msg, setMsg] = useState("");
  const [busyId, setBusyId] = useState<string>("");

  // selection + row actions
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const baselineRef = useRef<Record<string, string>>({});

  // UI filters
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState<Role | "all">("all");
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("all");
  const [scope, setScope] = useState<ScopeFilter>("visible");

  const isAdmin = profile?.role === "admin";
  const isManager = profile?.role === "manager";

  const visibleRows = useMemo(() => {
    if (!profile || !userId) return [];
    if (isAdmin) {
      if (scope === "all_org") return rows;
      return rows;
    }

    if (isManager) return rows.filter((r) => r.id === userId || r.manager_id === userId);
    return rows.filter((r) => r.id === userId);
  }, [rows, profile, userId, isAdmin, isManager, scope]);

  const managers = useMemo(() => {
    return rows
      .filter((r) => r.role === "manager" || r.role === "admin")
      .filter((r) => r.is_active !== false)
      .sort((a, b) => String(a.full_name || "").localeCompare(String(b.full_name || "")));
  }, [rows]);

  const filtered = useMemo(() => {
    const query = normalize(q);
    return visibleRows
      .filter((r) => {
        if (roleFilter !== "all" && r.role !== roleFilter) return false;
        if (activeFilter === "active" && r.is_active === false) return false;
        if (activeFilter === "inactive" && r.is_active !== false) return false;
        if (!query) return true;
        const hay = `${r.full_name || ""} ${r.id} ${r.role}`.toLowerCase();
        return hay.includes(query);
      })
      .sort((a, b) => safeName(a).localeCompare(safeName(b)));
  }, [visibleRows, q, roleFilter, activeFilter]);

  const counts = useMemo(() => {
    let total = visibleRows.length;
    let active = 0;
    let inactive = 0;

    for (const r of visibleRows) {
      if (r.is_active === false) inactive++;
      else active++;
    }
    return { total, active, inactive, showing: filtered.length };
  }, [visibleRows, filtered.length]);

  useEffect(() => {
    if (!profile?.org_id) return;

    let cancelled = false;
    (async () => {
      setMsg("");
      const { data, error } = await supabase
        .from("profiles")
        .select("id, org_id, role, full_name, hourly_rate, is_active, manager_id, created_at")
        .eq("org_id", profile.org_id)
        .order("role", { ascending: true })
        .order("full_name", { ascending: true });

      if (cancelled) return;

      if (error) {
        setMsg(error.message);
        setRows([]);
        return;
      }

      const nextRows = (((data as any) ?? []) as ProfileRow[]);
      setRows(nextRows);
      // reset baseline signatures + selection when refreshed
      baselineRef.current = Object.fromEntries(nextRows.map((r) => [r.id, sig(r)]));
      setSelected({});
      setOpenMenuId(null);
    })();

    return () => {
      cancelled = true;
    };
  }, [profile?.org_id]);

  useEffect(() => {
    if (!openMenuId) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t) return;
      if (t.closest("[data-people-menu-root]")) return;
      setOpenMenuId(null);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [openMenuId]);


  async function saveRow(id: string, patch: Partial<ProfileRow>) {
    setBusyId(id);
    setMsg("");

    const { error } = await supabase.from("profiles").update(patch).eq("id", id);
    if (error) {
      setMsg(error.message);
      setBusyId("");
      return;
    }

    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    // update baseline signature for this row
    const current = rows.find((x) => x.id === id);
    const merged = { ...(current as any), ...(patch as any) } as any;
    baselineRef.current[id] = sig(merged);
    setBusyId("");
  }

  if (profLoading) {
    return (
      <AppShell title="People" subtitle="Loading…">
        <div className="card cardPad prfShell">
          <div className="skeleton" style={{ height: 16, width: 220 }} />
          <div className="skeleton" style={{ height: 44, width: "100%", marginTop: 10 }} />
          <div className="skeleton" style={{ height: 360, width: "100%", marginTop: 10 }} />
        </div>
      </AppShell>
    );
  }

  if (!profile || !userId) {
    return (
      <AppShell title="People" subtitle="Profiles and access">
        <div className="card cardPad prfShell">
          <div style={{ fontWeight: 950, marginBottom: 8 }}>Please log in.</div>
          <button className="btnPrimary" onClick={() => router.push("/login")}>
            Go to Login
          </button>
        </div>
      </AppShell>
    );
  }

  const subtitle = isAdmin ? "Admin view (org users)" : isManager ? "Manager view (your team)" : "Your profile";

  // const selectedIds = useMemo(() => Object.keys(selected).filter((k) => selected[k]), [selected]);
  // const allSelected = useMemo(() => filtered.length > 0 && filtered.every((r) => selected[r.id]), [filtered, selected]);

  function isDirtyRow(r: ProfileRow) {
    const base = baselineRef.current[r.id];
    if (!base) return false;
    return base !== sig(r);
  }

  async function bulkUpdate(patch: Partial<ProfileRow>) {
    if (!isAdmin) return;
    const ids = selectedIds;
    if (ids.length === 0) return;
    setBusyId("bulk");
    setMsg("");

    const { error } = await supabase.from("profiles").update(patch).in("id", ids);
    if (error) {
      setMsg(error.message);
      setBusyId("");
      return;
    }

    setRows((prev) => prev.map((r) => (ids.includes(r.id) ? ({ ...r, ...patch } as any) : r)));
    for (const id of ids) {
      const r = rows.find((x) => x.id === id);
      const merged = { ...(r as any), ...(patch as any) } as any;
      baselineRef.current[id] = sig(merged);
    }
    setBusyId("");
    setSelected({});
    setOpenMenuId(null);
  }

  // Keep People clean (monday-style): navigation stays in the shell.
  const headerRight = isAdmin ? (
    <div className="peopleHeaderRight">
      <button className="btnPrimary" onClick={() => router.push("/admin")}>
        Invite
      </button>
    </div>
  ) : null;

  return (
    <AppShell title="People" subtitle={subtitle} right={headerRight}>
      {msg ? (
        <div className="alert alertInfo">
          <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>{msg}</pre>
        </div>
      ) : null}

      <div className="peopleTop" style={{ marginTop: 14 }}>
        <div className="peopleToolbar">
          <div className="peopleSearch">
            <Search size={16} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, role, or ID…" />
          </div>

          <div className="peopleFilters">
            <div className="peopleFilter">
              <Filter size={16} />
              <span>Filter</span>
            </div>

            <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as any)}>
              <option value="all">All roles</option>
              <option value="admin">Admin</option>
              <option value="manager">Manager</option>
              <option value="contractor">Contractor</option>
            </select>

            <select value={activeFilter} onChange={(e) => setActiveFilter(e.target.value as ActiveFilter)}>
              <option value="all">All status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>

            {isAdmin ? (
              <select value={scope} onChange={(e) => setScope(e.target.value as ScopeFilter)}>
                <option value="visible">Visible</option>
                <option value="all_org">All org</option>
              </select>
            ) : null}

            <button
              className="pill"
              onClick={() => {
                setQ("");
                setRoleFilter("all");
                setActiveFilter("all");
              }}
            >
              Clear
            </button>
          </div>
        </div>

        <div className="peopleStats">
          <div className="peopleStat"><div className="peopleStatNum">{counts.total}</div><div className="peopleStatLbl">Users</div></div>
          <div className="peopleStat"><div className="peopleStatNum">{counts.active}</div><div className="peopleStatLbl">Active</div></div>
          <div className="peopleStat"><div className="peopleStatNum">{counts.inactive}</div><div className="peopleStatLbl">Inactive</div></div>
          <div className="peopleStat"><div className="peopleStatNum">{counts.showing}</div><div className="peopleStatLbl">Showing</div></div>
        </div>
      </div>

      {!profile ? (
        <div className="alert alertWarn" style={{ marginTop: 14 }}>
          <div style={{ fontWeight: 950 }}>Profile missing</div>
          <pre style={{ whiteSpace: "pre-wrap", marginTop: 8 }}>{profErr || "No profile found."}</pre>
        </div>
      ) : null}

      
      {selectedIds.length > 0 ? (
        <div className="peopleBulkBar">
          <div className="peopleBulkLeft">
            <span className="tag tagMuted">{selectedIds.length} selected</span>
            <button className="pill" onClick={() => setSelected({})}>
              <X size={14} /> Clear
            </button>
            <button
              className="pill"
              onClick={() => {
                copyToClipboard(selectedIds.join("\n"));
                setMsg(`Copied ${selectedIds.length} user IDs to clipboard.`);
              }}
            >
              <Copy size={14} /> Copy IDs
            </button>
          </div>

          {isAdmin ? (
            <div className="peopleBulkRight">
              <button className="pill" disabled={busyId === "bulk"} onClick={() => bulkUpdate({ is_active: true })}>
                <UserCheck size={14} /> Activate
              </button>
              <button className="pill pillDanger" disabled={busyId === "bulk"} onClick={() => bulkUpdate({ is_active: false })}>
                <UserX size={14} /> Deactivate
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="card cardPad" style={{ marginTop: 14 }}>
        <div className="peopleTableWrap">
          <div className="peopleTableHeader">
            <div className="peopleCol peopleColChk">
              <input
                type="checkbox"
                aria-label="Select all"
                checked={allSelected}
                onChange={(e) => {
                  if (e.target.checked) {
                    const next: Record<string, boolean> = {};
                    for (const r of filtered) next[r.id] = true;
                    setSelected(next);
                  } else {
                    setSelected({});
                  }
                }}
              />
            </div>
            <div className="peopleCol peopleColName">Name</div>
            <div className="peopleCol">Role</div>
            <div className="peopleCol">Manager</div>
            <div className="peopleCol" style={{ textAlign: "right" }}>Rate</div>
            <div className="peopleCol">Status</div>
            <div className="peopleCol">Joined</div>
            <div className="peopleCol peopleColActions" />
          </div>

          {filtered.length === 0 ? (
            <div className="muted" style={{ padding: 14 }}>No results for your filters.</div>
          ) : (
            filtered.map((r) => {
              const isSelf = r.id === userId;
              const isDirectReport = r.manager_id === userId;

              const canEditRow = isAdmin || (isManager && (isSelf || isDirectReport)) || isSelf;
              const canAssignManager = isAdmin && r.role === "contractor";
              const canChangeRole = isAdmin && r.role !== "admin";
              const canEditHourlyRate = isAdmin || (isManager && isDirectReport);
              const canManageProjects = isAdmin; // projects access management is admin-only

              const saving = busyId === r.id;

              const managerName = r.manager_id
                ? safeName((rows.find((x) => x.id === r.manager_id) as any) || ({ full_name: null } as any))
                : "—";

              return (
                <div key={r.id} className={`peopleRow ${r.is_active === false ? "peopleRowInactive" : ""}`}>
                  <div className="peopleCol peopleColChk">
                    <input
                      type="checkbox"
                      aria-label={`Select ${safeName(r)}`}
                      checked={!!selected[r.id]}
                      onChange={(e) => setSelected((prev) => ({ ...prev, [r.id]: e.target.checked }))}
                    />
                  </div>
                  <div className="peopleCol peopleColName">
                    <div className="peopleNameCell">
                      <span className="peopleAvatar" aria-hidden>
                        {(safeName(r)[0] || "U").toUpperCase()}
                      </span>
                      <div>
                        <div className="peopleNameLine">
                          {canEditRow ? (
                          <input
                            className="peopleNameInput"
                            value={(r.full_name || "")}
                            placeholder="Full name"
                            onChange={(e) =>
                              setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, full_name: e.target.value } : x)))
                            }
                            onBlur={() => {
                              if (!canEditRow) return;
                              if (!isDirtyRow(r)) return;
                              saveRow(r.id, { full_name: (r.full_name || "").trim() || null });
                            }}
                          />
                        ) : (
                          <span className="peopleNameText">{safeName(r)}</span>
                        )}
                          {isSelf ? <span className="tag tagMuted">You</span> : null}
                        </div>
                        <div className="peopleMeta">{r.id}</div>
                      </div>
                    </div>
                  </div>

                  <div className="peopleCol">
                    <select
                      className="peopleSelect"
                      value={r.role}
                      disabled={!canChangeRole}
                      onChange={(e) =>
                        setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, role: e.target.value as Role } : x)))
                      }
                    >
                      <option value="contractor">Contractor</option>
                      <option value="manager">Manager</option>
                      {isAdmin ? <option value="admin">Admin</option> : null}
                    </select>
                    {!canChangeRole ? <div className="peopleHint">Locked</div> : null}
                  </div>

                  <div className="peopleCol">
                    {canAssignManager ? (
                      <select
                        className="peopleSelect"
                        value={r.manager_id ?? ""}
                        onChange={(e) =>
                          setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, manager_id: e.target.value || null } : x)))
                        }
                      >
                        <option value="">—</option>
                        {managers.map((m) => (
                          <option key={m.id} value={m.id}>
                            {(m.full_name || m.id).slice(0, 40)}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="peopleRead">{managerName}</div>
                    )}
                    {!canAssignManager ? <div className="peopleHint">Admin only</div> : null}
                  </div>

                  <div className="peopleCol" style={{ textAlign: "right" }}>
                    <input
                      className="peopleInput"
                      type="number"
                      step="0.01"
                      min="0"
                      value={Number(r.hourly_rate ?? 0)}
                      disabled={!canEditHourlyRate}
                      onChange={(e) =>
                        setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, hourly_rate: Number(e.target.value) } : x)))
                      }
                    />
                    {!canEditHourlyRate ? <div className="peopleHint">{isManager ? "Direct reports" : "Locked"}</div> : null}
                  </div>

                  <div className="peopleCol">
                    {isAdmin ? (
                      <select
                        className="peopleSelect"
                        value={r.is_active === false ? "inactive" : "active"}
                        onChange={(e) =>
                          setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, is_active: e.target.value === "active" } : x)))
                        }
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    ) : (
                      <span className={`tag ${r.is_active === false ? "tagWarn" : "tagOk"}`}>
                        {r.is_active === false ? "Inactive" : "Active"}
                      </span>
                    )}
                    {!isAdmin ? <div className="peopleHint">Admin only</div> : null}
                  </div>

                  <div className="peopleCol">
                    <div className="peopleRead">{fmtDate(r.created_at)}</div>
                  </div>

                  <div className="peopleCol peopleColActions">
                    <div className="peopleActions">
                      {canEditRow ? (
                        isDirtyRow(r) ? (
                          <button
                            className="btnPrimary"
                            disabled={saving}
                            onClick={() =>
                              saveRow(r.id, {
                                full_name: (r.full_name || "").trim() || null,
                                role: r.role,
                                manager_id: r.manager_id,
                                hourly_rate: Number(r.hourly_rate ?? 0),
                                is_active: r.is_active !== false,
                              })
                            }
                            title="Save changes"
                          >
                            {saving ? "Saving…" : "Save"}
                          </button>
                        ) : (
                          <span className="muted" style={{ fontSize: 12, fontWeight: 800 }}>Saved</span>
                        )
                      ) : (
                        <span className="muted" style={{ fontSize: 12, fontWeight: 800 }}>Read-only</span>
                      )}

                      <div className="peopleMenuWrap" data-people-menu-root>
                        <button
                          className="iconBtn"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenuId((cur) => (cur === r.id ? null : r.id));
                          }}
                          title="Row actions"
                        >
                          <MoreHorizontal size={16} />
                        </button>

                        {openMenuId === r.id ? (
                        <div className="peopleMenu">
                          <button className="peopleMenuItem" onClick={() => {
                            copyToClipboard(r.id);
                            setOpenMenuId(null);
                          }}>
                            Copy user ID
                          </button>
                          {isAdmin ? (
                            <button
                              className="peopleMenuItem"
                              onClick={() => {
                                setOpenMenuId(null);
                                saveRow(r.id, { is_active: r.is_active === false ? true : false });
                              }}
                            >
                              {r.is_active === false ? "Activate user" : "Deactivate user"}
                            </button>
                          ) : null}

                          {canManageProjects ? (
                            <button
                              className="peopleMenuItem"
                              onClick={() => {
                                setOpenMenuId(null);
                                router.push(`/projects?user=${encodeURIComponent(r.id)}`);
                              }}
                            >
                              Manage project access
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </AppShell>
  );
}

export default function ProfilesPage() {
  return (
    <RequireOnboarding>
      <ProfilesInner />
    </RequireOnboarding>
  );
}
