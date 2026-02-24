// src/app/profiles/page.tsx
"use client";

import RequireOnboarding from "../../components/auth/RequireOnboarding";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "../../components/layout/AppShell";
import { supabase } from "../../lib/supabaseBrowser";
import { useProfile } from "../../lib/useProfile";
import {
  Copy,
  Filter,
  MoreHorizontal,
  Search,
  UserPlus,
} from "lucide-react";

type Role = "admin" | "manager" | "contractor";

type ProfileRow = {
  id: string;
  org_id: string;
  full_name: string | null;
  role: Role;
  hourly_rate: number | null;
  is_active: boolean;
  manager_id: string | null;
  created_at: string | null;
};

type ActiveFilter = "all" | "active" | "inactive";
type ScopeFilter = "visible" | "all";

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
}

function normalize(s: string | null | undefined) {
  return (s ?? "").toLowerCase().trim();
}

function isUuidLike(s: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    s.trim()
  );
}

export default function ProfilesPage() {
  const router = useRouter();
  const { profile, userId, loading, refresh } = useProfile();
  const isAdmin = profile?.role === "admin";
  const isManager = profile?.role === "manager";

  const [rows, setRows] = useState<ProfileRow[]>([]);
  const [msg, setMsg] = useState("");
  const [busyId, setBusyId] = useState<string>("");

  // Selection + row menu (click-to-open)
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const baselineRef = useRef<Record<string, string>>({});

  // Filters
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState<Role | "all">("all");
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("all");
  const [scope, setScope] = useState<ScopeFilter>("visible");

  const visibleRows = useMemo(() => {
    // "Visible" respects RLS reality:
    // - admin can see org
    // - manager can see assigned reports + self
    // - contractor sees self
    if (!profile || !userId) return [];
    if (scope === "all" && isAdmin) return rows;

    if (isAdmin) return rows;

    if (isManager) {
      return rows.filter((r) => r.id === userId || r.manager_id === userId);
    }

    return rows.filter((r) => r.id === userId);
  }, [rows, profile, userId, scope, isAdmin, isManager]);

  const managers = useMemo(() => {
    return rows
      .filter((r) => r.role === "manager" && r.is_active)
      .sort((a, b) => normalize(a.full_name).localeCompare(normalize(b.full_name)));
  }, [rows]);

  const filtered = useMemo(() => {
    const needle = normalize(q);
    const qIsUuid = isUuidLike(needle);

    return visibleRows.filter((r) => {
      if (roleFilter !== "all" && r.role !== roleFilter) return false;
      if (activeFilter === "active" && !r.is_active) return false;
      if (activeFilter === "inactive" && r.is_active) return false;

      if (!needle) return true;

      const name = normalize(r.full_name);
      const role = normalize(r.role);
      const id = normalize(r.id);

      if (qIsUuid) return id.includes(needle);
      return (
        name.includes(needle) ||
        role.includes(needle) ||
        id.includes(needle)
      );
    });
  }, [visibleRows, q, roleFilter, activeFilter]);

  const counts = useMemo(() => {
    const total = visibleRows.length;
    const active = visibleRows.filter((r) => r.is_active).length;
    const inactive = total - active;
    const showing = filtered.length;
    const admins = visibleRows.filter((r) => r.role === "admin").length;
    const managersCount = visibleRows.filter((r) => r.role === "manager").length;
    const contractors = visibleRows.filter((r) => r.role === "contractor").length;
    return { total, active, inactive, showing, admins, managersCount, contractors };
  }, [visibleRows, filtered]);

  // IMPORTANT: DO NOT use hooks after conditional returns.
  // Derived values must be computed without hooks.
  const selectedIds = Object.keys(selected).filter((k) => selected[k]);
  const anySelected = selectedIds.length > 0;
  const allSelected = filtered.length > 0 && filtered.every((r) => selected[r.id]);

  // Close menu on click outside
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      // if click is within a menu button or menu container, ignore
      if (target.closest?.("[data-row-menu]")) return;
      setOpenMenuId(null);
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  useEffect(() => {
    if (!profile?.org_id) return;

    (async () => {
      setMsg("");
      const { data, error } = await supabase
        .from("profiles")
        .select(
          "id, org_id, full_name, role, hourly_rate, is_active, manager_id, created_at"
        )
        .eq("org_id", profile.org_id)
        .order("created_at", { ascending: true });

      if (error) {
        setMsg(error.message);
        setRows([]);
        return;
      }

      const list = (data ?? []) as ProfileRow[];
      setRows(list);

      // baseline for dirty detection
      const base: Record<string, string> = {};
      for (const r of list) {
        base[r.id] = JSON.stringify({
          full_name: r.full_name ?? "",
          role: r.role,
          hourly_rate: r.hourly_rate ?? 0,
          is_active: r.is_active,
          manager_id: r.manager_id ?? "",
        });
      }
      baselineRef.current = base;
    })();
  }, [profile?.org_id]);

  // Keep selection consistent when filtered set changes (remove hidden)
  useEffect(() => {
    const allowed = new Set(filtered.map((r) => r.id));
    setSelected((prev) => {
      const next: Record<string, boolean> = {};
      for (const k of Object.keys(prev)) {
        if (allowed.has(k) && prev[k]) next[k] = true;
      }
      return next;
    });
  }, [filtered]);

  async function saveRow(id: string, patch: Partial<ProfileRow>) {
    if (!profile?.org_id) return;

    setBusyId(id);
    setMsg("");
    const { error } = await supabase
      .from("profiles")
      .update(patch)
      .eq("id", id)
      .eq("org_id", profile.org_id);

    setBusyId("");
    if (error) {
      setMsg(error.message);
      return;
    }

    // refresh local state
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));

    // update baseline
    const row = rows.find((r) => r.id === id);
    const merged = { ...(row ?? ({} as any)), ...patch } as ProfileRow;
    baselineRef.current[id] = JSON.stringify({
      full_name: merged.full_name ?? "",
      role: merged.role,
      hourly_rate: merged.hourly_rate ?? 0,
      is_active: merged.is_active,
      manager_id: merged.manager_id ?? "",
    });

    // if user saved self, refresh session/profile cache
    if (id === userId) refresh?.();
  }

  function isDirty(r: ProfileRow) {
    const base = baselineRef.current[r.id] ?? "";
    const cur = JSON.stringify({
      full_name: r.full_name ?? "",
      role: r.role,
      hourly_rate: r.hourly_rate ?? 0,
      is_active: r.is_active,
      manager_id: r.manager_id ?? "",
    });
    return base !== cur;
  }

  async function bulkSetActive(isActive: boolean) {
    if (!profile?.org_id) return;
    if (!isAdmin) {
      setMsg("Only Admin can bulk update status.");
      return;
    }
    if (selectedIds.length === 0) return;

    setMsg("");
    setBusyId("bulk");
    const { error } = await supabase
      .from("profiles")
      .update({ is_active: isActive })
      .in("id", selectedIds)
      .eq("org_id", profile.org_id);

    setBusyId("");
    if (error) {
      setMsg(error.message);
      return;
    }

    setRows((prev) =>
      prev.map((r) =>
        selectedIds.includes(r.id) ? { ...r, is_active: isActive } : r
      )
    );

    // baseline update for those rows
    for (const id of selectedIds) {
      const r = rows.find((x) => x.id === id);
      if (!r) continue;
      baselineRef.current[id] = JSON.stringify({
        full_name: r.full_name ?? "",
        role: r.role,
        hourly_rate: r.hourly_rate ?? 0,
        is_active: isActive,
        manager_id: r.manager_id ?? "",
      });
    }

    setSelected({});
  }

  async function copySelectedIds() {
    if (!anySelected) return;
    const text = selectedIds.join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setMsg(`Copied ${selectedIds.length} ID(s) to clipboard.`);
    } catch {
      setMsg("Could not copy to clipboard (browser blocked).");
    }
  }

  function toggleAll() {
    setSelected((prev) => {
      if (allSelected) return {};
      const next: Record<string, boolean> = {};
      for (const r of filtered) next[r.id] = true;
      return next;
    });
  }

  function toggleOne(id: string) {
    setSelected((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function clearFilters() {
    setQ("");
    setRoleFilter("all");
    setActiveFilter("all");
    setScope("visible");
  }

  if (loading) {
    return (
      <AppShell title="People" subtitle="User directory">
        <div className="card" style={{ padding: 16 }}>Loading…</div>
      </AppShell>
    );
  }

  if (!profile || !userId) {
    return (
      <AppShell title="People" subtitle="User directory">
        <div className="card" style={{ padding: 16 }}>
          Please sign in to view People.
        </div>
      </AppShell>
    );
  }

  return (
    <RequireOnboarding>
      <AppShell
        title="People"
        subtitle={isAdmin ? "Admin view (org users)" : isManager ? "Manager view" : "My profile"}
        actions={
          <div className="row" style={{ gap: 8 }}>
            {isAdmin && (
              <button
                className="pill"
                onClick={() => router.push("/admin")}
                title="Invite users"
              >
                <UserPlus size={16} style={{ marginRight: 8 }} />
                Invite
              </button>
            )}
          </div>
        }
      >
        <div className="peopleWrap">
          {/* Toolbar */}
          <div className="peopleToolbar card">
            <div className="peopleToolbarLeft">
              <div className="peopleSearch">
                <Search size={16} />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search name, role, or ID…"
                />
              </div>

              <div className="peopleFilters">
                <div className="peopleFilter">
                  <Filter size={16} />
                  <select
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value as any)}
                    aria-label="Role filter"
                  >
                    <option value="all">All roles</option>
                    <option value="admin">Admins</option>
                    <option value="manager">Managers</option>
                    <option value="contractor">Contractors</option>
                  </select>
                </div>

                <div className="peopleFilter">
                  <select
                    value={activeFilter}
                    onChange={(e) => setActiveFilter(e.target.value as any)}
                    aria-label="Status filter"
                  >
                    <option value="all">All status</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>

                <div className="peopleFilter">
                  <select
                    value={scope}
                    onChange={(e) => setScope(e.target.value as any)}
                    aria-label="Scope filter"
                    disabled={!isAdmin}
                    title={!isAdmin ? "Admin only" : ""}
                  >
                    <option value="visible">Visible</option>
                    <option value="all">All org (admin)</option>
                  </select>
                </div>

                <button className="pill" onClick={clearFilters}>
                  Clear
                </button>
              </div>
            </div>

            <div className="peopleToolbarRight">
              <div className="peopleStatsInline">
                <span className="tag tagMuted">Users: {counts.total}</span>
                <span className="tag tagOk">Active: {counts.active}</span>
                <span className="tag tagWarn">Inactive: {counts.inactive}</span>
                <span className="tag tagMuted">Showing: {counts.showing}</span>
              </div>
            </div>
          </div>

          {/* Bulk bar */}
          {anySelected && (
            <div className="peopleBulk card">
              <div className="row" style={{ gap: 10, alignItems: "center" }}>
                <span className="tag tagMuted">
                  {selectedIds.length} selected
                </span>

                <button className="pill" onClick={copySelectedIds}>
                  <Copy size={16} style={{ marginRight: 8 }} />
                  Copy IDs
                </button>

                {isAdmin && (
                  <>
                    <button
                      className="pill"
                      disabled={busyId === "bulk"}
                      onClick={() => bulkSetActive(true)}
                    >
                      Activate
                    </button>
                    <button
                      className="pill"
                      disabled={busyId === "bulk"}
                      onClick={() => bulkSetActive(false)}
                    >
                      Deactivate
                    </button>
                  </>
                )}

                <button className="pill" onClick={() => setSelected({})}>
                  Clear selection
                </button>
              </div>

              {busyId === "bulk" && (
                <div className="muted" style={{ marginTop: 8 }}>
                  Applying bulk update…
                </div>
              )}
            </div>
          )}

          {/* Messages */}
          {msg && <div className="peopleMsg">{msg}</div>}

          {/* Table */}
          <div className="peopleTable card">
            <div className="peopleTableHeader">
              <div className="colCheck">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  aria-label="Select all"
                />
              </div>
              <div className="colName">Name</div>
              <div className="colRole">Role</div>
              <div className="colMgr">Manager</div>
              <div className="colRate">Rate</div>
              <div className="colStatus">Status</div>
              <div className="colJoined">Joined</div>
              <div className="colActions"></div>
            </div>

            {filtered.map((r) => {
              const dirty = isDirty(r);
              const canEditSelfName = r.id === userId;
              const canAdminEdit = isAdmin;
              const canManagerEditReport =
                isManager && r.manager_id === userId;

              const canEditName = canAdminEdit || canEditSelfName || canManagerEditReport;
              const canEditRole = isAdmin;
              const canEditManager = isAdmin;
              const canEditRate = isAdmin || canManagerEditReport;
              const canEditStatus = isAdmin;

              const statusTag = r.is_active ? "tagOk" : "tagWarn";

              return (
                <div className="peopleRow" key={r.id}>
                  <div className="colCheck">
                    <input
                      type="checkbox"
                      checked={!!selected[r.id]}
                      onChange={() => toggleOne(r.id)}
                      aria-label={`Select ${r.full_name ?? r.id}`}
                    />
                  </div>

                  {/* Name (inline editable) */}
                  <div className="colName">
                    {canEditName ? (
                      <input
                        className="peopleCellInput"
                        value={r.full_name ?? ""}
                        placeholder="Full name"
                        onChange={(e) =>
                          setRows((prev) =>
                            prev.map((x) =>
                              x.id === r.id
                                ? { ...x, full_name: e.target.value }
                                : x
                            )
                          )
                        }
                        onBlur={() => {
                          if (!dirty) return;
                          saveRow(r.id, { full_name: r.full_name ?? "" });
                        }}
                      />
                    ) : (
                      <div className="peopleNameText">
                        {r.full_name ?? "—"}
                        <div className="muted mono">{r.id}</div>
                      </div>
                    )}
                    {canEditName && (
                      <div className="muted mono">{r.id}</div>
                    )}
                  </div>

                  {/* Role */}
                  <div className="colRole">
                    <select
                      className="peopleCellSelect"
                      value={r.role}
                      disabled={!canEditRole}
                      title={!canEditRole ? "Admin only" : ""}
                      onChange={(e) => {
                        const role = e.target.value as Role;
                        setRows((prev) =>
                          prev.map((x) => (x.id === r.id ? { ...x, role } : x))
                        );
                      }}
                      onBlur={() => {
                        if (!dirty) return;
                        if (canEditRole) saveRow(r.id, { role: r.role });
                      }}
                    >
                      <option value="admin">admin</option>
                      <option value="manager">manager</option>
                      <option value="contractor">contractor</option>
                    </select>
                  </div>

                  {/* Manager */}
                  <div className="colMgr">
                    <select
                      className="peopleCellSelect"
                      value={r.manager_id ?? ""}
                      disabled={!canEditManager}
                      title={!canEditManager ? "Admin only" : ""}
                      onChange={(e) => {
                        const manager_id = e.target.value || null;
                        setRows((prev) =>
                          prev.map((x) =>
                            x.id === r.id ? { ...x, manager_id } : x
                          )
                        );
                      }}
                      onBlur={() => {
                        if (!dirty) return;
                        if (canEditManager)
                          saveRow(r.id, { manager_id: r.manager_id });
                      }}
                    >
                      <option value="">—</option>
                      {managers.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.full_name ?? m.id}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Rate */}
                  <div className="colRate">
                    <input
                      className="peopleCellInput right"
                      type="number"
                      value={r.hourly_rate ?? 0}
                      disabled={!canEditRate}
                      title={!canEditRate ? "Admin only / your direct report" : ""}
                      onChange={(e) => {
                        const hourly_rate = Number(e.target.value);
                        setRows((prev) =>
                          prev.map((x) =>
                            x.id === r.id ? { ...x, hourly_rate } : x
                          )
                        );
                      }}
                      onBlur={() => {
                        if (!dirty) return;
                        if (canEditRate)
                          saveRow(r.id, { hourly_rate: r.hourly_rate ?? 0 });
                      }}
                    />
                  </div>

                  {/* Status */}
                  <div className="colStatus">
                    {canEditStatus ? (
                      <select
                        className="peopleCellSelect"
                        value={r.is_active ? "active" : "inactive"}
                        onChange={(e) => {
                          const is_active = e.target.value === "active";
                          setRows((prev) =>
                            prev.map((x) =>
                              x.id === r.id ? { ...x, is_active } : x
                            )
                          );
                        }}
                        onBlur={() => {
                          if (!dirty) return;
                          saveRow(r.id, { is_active: r.is_active });
                        }}
                      >
                        <option value="active">active</option>
                        <option value="inactive">inactive</option>
                      </select>
                    ) : (
                      <span className={`tag ${statusTag}`}>
                        {r.is_active ? "Active" : "Inactive"}
                      </span>
                    )}
                  </div>

                  {/* Joined */}
                  <div className="colJoined">{fmtDate(r.created_at)}</div>

                  {/* Actions */}
                  <div className="colActions">
                    <div className="row" style={{ gap: 8, justifyContent: "flex-end" }}>
                      {dirty ? (
                        <button
                          className="pill"
                          disabled={busyId === r.id}
                          onClick={() => {
                            // Save a minimal patch; triggers/RLS will validate
                            saveRow(r.id, {
                              full_name: r.full_name ?? "",
                              role: r.role,
                              hourly_rate: r.hourly_rate ?? 0,
                              is_active: r.is_active,
                              manager_id: r.manager_id,
                            });
                          }}
                        >
                          {busyId === r.id ? "Saving…" : "Save"}
                        </button>
                      ) : (
                        <span className="muted">Saved</span>
                      )}

                      <div data-row-menu className="peopleMenuWrap">
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
                          <div className="peopleMenu">
                            <button
                              onClick={async () => {
                                try {
                                  await navigator.clipboard.writeText(r.id);
                                  setMsg("Copied user ID.");
                                } catch {
                                  setMsg("Could not copy user ID.");
                                }
                                setOpenMenuId(null);
                              }}
                            >
                              Copy user ID
                            </button>

                            {isAdmin && (
                              <button
                                onClick={() => {
                                  setOpenMenuId(null);
                                  router.push(`/projects?user=${encodeURIComponent(r.id)}`);
                                }}
                              >
                                Manage project access
                              </button>
                            )}

                            {!isAdmin && (
                              <div className="peopleMenuHint">Admin-only actions hidden</div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {filtered.length === 0 && (
              <div className="peopleEmpty">
                <div className="title">No users found</div>
                <div className="muted">
                  Try adjusting search or filters.
                </div>
              </div>
            )}
          </div>
        </div>
      </AppShell>
    </RequireOnboarding>
  );
}
