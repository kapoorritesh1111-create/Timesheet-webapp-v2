"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AppShell from "../../components/layout/AppShell";
import { supabase } from "../../lib/supabaseBrowser";
import { useProfile } from "../../lib/useProfile";

type WeekStart = "sunday" | "monday";
type ActiveFilter = "all" | "active" | "inactive";

type Project = {
  id: string;
  name: string;
  is_active: boolean;
  org_id: string;
  week_start?: WeekStart | null;
};

type MemberRow = {
  id: string;
  project_id: string;
  is_active: boolean;
};

type SimpleProfile = {
  id: string;
  full_name: string | null;
  role: string | null;
};

type DrawerMember = {
  profile_id: string;
  full_name: string | null;
  role: string | null;
};

function normalize(s: string) {
  return s.trim().toLowerCase();
}

function weekStartLabel(ws?: WeekStart | null) {
  const v = ws || "sunday";
  return v === "monday" ? "Week starts Monday" : "Week starts Sunday";
}

function copyToClipboard(text: string) {
  try {
    navigator.clipboard.writeText(text);
  } catch {
    // ignore
  }
}

export default function ProjectsClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { loading, userId, profile, error: profErr } = useProfile();

  const selectedProjectId = useMemo(() => searchParams.get("project") || "", [searchParams]);
  const manageUserId = useMemo(() => searchParams.get("user") || "", [searchParams]);

  const [projects, setProjects] = useState<Project[]>([]);
  const [fetchErr, setFetchErr] = useState<string>("");

  // Assignment mode (Admin only): /projects?user=<profile_id>
  const [manageUser, setManageUser] = useState<SimpleProfile | null>(null);
  const [memberMap, setMemberMap] = useState<Record<string, MemberRow>>({});

  // Busy states
  const [busyProjectId, setBusyProjectId] = useState<string>("");
  const [savingWeekStartId, setSavingWeekStartId] = useState<string>("");

  // Admin create project
  const [newName, setNewName] = useState("");
  const [newWeekStart, setNewWeekStart] = useState<WeekStart>("sunday");
  const [createBusy, setCreateBusy] = useState(false);

  // Filters
  const [q, setQ] = useState("");
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("all");

  // Drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerProjectId, setDrawerProjectId] = useState<string>("");
  const [drawerMembers, setDrawerMembers] = useState<DrawerMember[]>([]);
  const [drawerBusy, setDrawerBusy] = useState(false);
  const [drawerMsg, setDrawerMsg] = useState<string>("");

  // Admin member management inside drawer
  const [orgPeople, setOrgPeople] = useState<Array<{ id: string; full_name: string | null; role: string | null }>>(
    []
  );
  const [memberPickId, setMemberPickId] = useState<string>("");
  const [memberActionBusy, setMemberActionBusy] = useState(false);

  const isAdmin = profile?.role === "admin";
  const isManagerOrAdmin = profile?.role === "admin" || profile?.role === "manager";

  function tag(text: string, kind?: "ok" | "warn") {
    const cls = kind === "ok" ? "tag tagOk" : kind === "warn" ? "tag tagWarn" : "tag";
    return <span className={cls}>{text}</span>;
  }

  function setProjectInUrl(projectId: string) {
    const params = new URLSearchParams();
    if (manageUserId) params.set("user", manageUserId);
    if (projectId) params.set("project", projectId);
    const qs = params.toString();
    router.replace(qs ? `/projects?${qs}` : "/projects");
  }

  async function reloadProjects() {
    if (!profile) return;
    setFetchErr("");

    if (isManagerOrAdmin) {
      const { data, error } = await supabase
        .from("projects")
        .select("id, name, is_active, org_id, week_start")
        .eq("org_id", profile.org_id)
        .order("name", { ascending: true });

      if (error) {
        setFetchErr(error.message);
        return;
      }
      setProjects((data || []) as Project[]);
    } else {
      // contractor: only assigned projects
      const { data, error } = await supabase
        .from("project_members")
        .select("project_id, projects:project_id (id, name, is_active, org_id, week_start)")
        .eq("profile_id", profile.id)
        .eq("is_active", true);

      if (error) {
        setFetchErr(error.message);
        return;
      }

      const flattened = (data || []).map((row: any) => row.projects).filter(Boolean) as Project[];
      const uniq = Array.from(new Map(flattened.map((p) => [p.id, p])).values());
      uniq.sort((a, b) => a.name.localeCompare(b.name));
      setProjects(uniq);
    }
  }

  // Initial load
  useEffect(() => {
    if (loading) return;

    if (!userId) {
      router.replace("/login");
      return;
    }

    if (!profile) {
      setFetchErr(profErr || "Profile could not be loaded.");
      return;
    }

    reloadProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, userId, profile?.id]);

  // Load org people for drawer (Admin only)
  useEffect(() => {
    if (!profile) return;
    if (!isAdmin) return;

    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, role, is_active")
        .eq("org_id", profile.org_id)
        .order("full_name", { ascending: true });

      if (cancelled) return;
      if (error) return;

      const list = (data || [])
        .filter((p: any) => p.is_active !== false)
        .map((p: any) => ({ id: p.id, full_name: p.full_name ?? null, role: p.role ?? null }));

      setOrgPeople(list);
    })();

    return () => {
      cancelled = true;
    };
  }, [profile?.org_id, isAdmin]);

  // Load user being managed + membership map (Admin only)
  useEffect(() => {
    if (loading) return;
    if (!profile) return;

    if (!manageUserId) {
      setManageUser(null);
      setMemberMap({});
      return;
    }

    if (!isAdmin) {
      setFetchErr("Only Admin can manage project access.");
      return;
    }

    let cancelled = false;
    (async () => {
      setFetchErr("");

      const { data: u, error: uErr } = await supabase
        .from("profiles")
        .select("id, full_name, role")
        .eq("id", manageUserId)
        .maybeSingle();

      if (cancelled) return;

      if (uErr) {
        setFetchErr(uErr.message);
        return;
      }
      if (!u) {
        setFetchErr("User not found.");
        return;
      }

      setManageUser(u as SimpleProfile);

      const { data: mem, error: memErr } = await supabase
        .from("project_members")
        .select("id, project_id, is_active")
        .eq("org_id", profile.org_id)
        .eq("profile_id", manageUserId);

      if (cancelled) return;

      if (memErr) {
        setFetchErr(memErr.message);
        return;
      }

      const map: Record<string, MemberRow> = {};
      for (const r of (mem as any) ?? []) map[r.project_id] = r;
      setMemberMap(map);
    })();

    return () => {
      cancelled = true;
    };
  }, [loading, profile?.org_id, manageUserId, isAdmin]);

  const assignedProjectIds = useMemo(() => {
    return new Set(
      Object.entries(memberMap)
        .filter(([, v]) => v.is_active)
        .map(([k]) => k)
    );
  }, [memberMap]);

  const filteredProjects = useMemo(() => {
    const query = normalize(q);
    return projects.filter((p) => {
      if (activeFilter === "active" && !p.is_active) return false;
      if (activeFilter === "inactive" && p.is_active) return false;
      if (!query) return true;
      return `${p.name} ${p.id}`.toLowerCase().includes(query);
    });
  }, [projects, q, activeFilter]);

  const counts = useMemo(() => {
    let total = projects.length;
    let active = 0;
    let inactive = 0;
    for (const p of projects) {
      if (p.is_active) active++;
      else inactive++;
    }
    return { total, active, inactive };
  }, [projects]);

  async function toggleAssignment(projectId: string, nextAssigned: boolean) {
    if (!profile) return;
    if (!isAdmin) return;
    if (!manageUserId) return;

    setBusyProjectId(projectId);
    setFetchErr("");

    try {
      const existing = memberMap[projectId];

      if (existing) {
        const { error } = await supabase.from("project_members").update({ is_active: nextAssigned }).eq("id", existing.id);
        if (error) {
          setFetchErr(error.message);
          return;
        }

        setMemberMap((prev) => ({
          ...prev,
          [projectId]: { ...existing, is_active: nextAssigned },
        }));
      } else {
        const payload: any = {
          org_id: profile.org_id,
          project_id: projectId,
          profile_id: manageUserId,
          user_id: manageUserId,
          is_active: true,
        };

        const { data, error } = await supabase
          .from("project_members")
          .insert(payload)
          .select("id, project_id, is_active")
          .single();

        if (error) {
          setFetchErr(error.message);
          return;
        }

        setMemberMap((prev) => ({
          ...prev,
          [projectId]: data as MemberRow,
        }));
      }
    } finally {
      setBusyProjectId("");
    }
  }

  async function createProject() {
    if (!profile) return;
    if (!isAdmin) return;

    const name = newName.trim();
    if (name.length < 2) {
      setFetchErr("Project name must be at least 2 characters.");
      return;
    }

    setCreateBusy(true);
    setFetchErr("");

    try {
      const { error } = await supabase.from("projects").insert({
        org_id: profile.org_id,
        name,
        is_active: true,
        week_start: newWeekStart,
      });

      if (error) {
        setFetchErr(error.message);
        return;
      }

      setNewName("");
      setNewWeekStart("sunday");
      await reloadProjects();
    } finally {
      setCreateBusy(false);
    }
  }

  async function toggleProjectActive(projectId: string, nextActive: boolean) {
    if (!profile) return;
    if (!isAdmin) return;

    setBusyProjectId(projectId);
    setFetchErr("");

    try {
      const { error } = await supabase
        .from("projects")
        .update({ is_active: nextActive })
        .eq("id", projectId)
        .eq("org_id", profile.org_id);

      if (error) {
        setFetchErr(error.message);
        return;
      }

      setProjects((prev) => prev.map((p) => (p.id === projectId ? { ...p, is_active: nextActive } : p)));
    } finally {
      setBusyProjectId("");
    }
  }

  async function updateProjectWeekStart(projectId: string, weekStart: WeekStart) {
    if (!profile) return;
    if (!isAdmin) return;

    try {
      setSavingWeekStartId(projectId);

      const { error } = await supabase
        .from("projects")
        .update({ week_start: weekStart })
        .eq("id", projectId)
        .eq("org_id", profile.org_id);

      if (error) {
        setFetchErr(error.message);
        return;
      }

      setProjects((prev) => prev.map((p) => (p.id === projectId ? { ...p, week_start: weekStart } : p)));
    } finally {
      setSavingWeekStartId("");
    }
  }

  const drawerProject = useMemo(() => {
    if (!drawerProjectId) return null;
    return projects.find((p) => p.id === drawerProjectId) || null;
  }, [drawerProjectId, projects]);

  async function openDrawer(projectId: string) {
    if (!profile) return;

    setDrawerOpen(true);
    setDrawerProjectId(projectId);
    setDrawerMembers([]);
    setDrawerMsg("");
    setMemberPickId("");
    setDrawerBusy(true);

    try {
      const { data, error } = await supabase
        .from("project_members")
        .select("profile_id, is_active, profiles:profile_id(full_name, role)")
        .eq("org_id", profile.org_id)
        .eq("project_id", projectId)
        .eq("is_active", true);

      if (error) {
        setDrawerMsg(error.message);
        return;
      }

      const list: DrawerMember[] = (data || []).map((r: any) => ({
        profile_id: r.profile_id,
        full_name: r.profiles?.full_name ?? null,
        role: r.profiles?.role ?? null,
      }));

      list.sort((a, b) => (a.full_name || "").localeCompare(b.full_name || ""));
      setDrawerMembers(list);
    } finally {
      setDrawerBusy(false);
    }
  }

  function closeDrawer() {
    setDrawerOpen(false);
    setDrawerProjectId("");
    setDrawerMembers([]);
    setDrawerMsg("");
    setMemberPickId("");
  }

  const drawerMemberIds = useMemo(() => new Set(drawerMembers.map((m) => m.profile_id)), [drawerMembers]);

  const availablePeopleToAdd = useMemo(() => {
    if (!isAdmin) return [];
    return orgPeople.filter((p) => !drawerMemberIds.has(p.id));
  }, [orgPeople, drawerMemberIds, isAdmin]);

  async function addDrawerMember() {
    if (!profile) return;
    if (!isAdmin) return;
    if (!drawerProjectId) return;
    if (!memberPickId) return;

    setMemberActionBusy(true);
    setDrawerMsg("");

    try {
      const { data: existing, error: exErr } = await supabase
        .from("project_members")
        .select("id")
        .eq("org_id", profile.org_id)
        .eq("project_id", drawerProjectId)
        .eq("profile_id", memberPickId)
        .maybeSingle();

      if (exErr) {
        setDrawerMsg(exErr.message);
        return;
      }

      if (existing?.id) {
        const { error } = await supabase.from("project_members").update({ is_active: true }).eq("id", existing.id);
        if (error) {
          setDrawerMsg(error.message);
          return;
        }
      } else {
        const payload: any = {
          org_id: profile.org_id,
          project_id: drawerProjectId,
          profile_id: memberPickId,
          user_id: memberPickId,
          is_active: true,
        };

        const { error } = await supabase.from("project_members").insert(payload);
        if (error) {
          setDrawerMsg(error.message);
          return;
        }
      }

      setMemberPickId("");
      await openDrawer(drawerProjectId);
    } finally {
      setMemberActionBusy(false);
    }
  }

  async function removeDrawerMember(profileId: string) {
    if (!profile) return;
    if (!isAdmin) return;
    if (!drawerProjectId) return;

    setMemberActionBusy(true);
    setDrawerMsg("");

    try {
      const { error } = await supabase
        .from("project_members")
        .update({ is_active: false })
        .eq("org_id", profile.org_id)
        .eq("project_id", drawerProjectId)
        .eq("profile_id", profileId);

      if (error) {
        setDrawerMsg(error.message);
        return;
      }

      await openDrawer(drawerProjectId);
    } finally {
      setMemberActionBusy(false);
    }
  }

  function onProjectRowClick(projectId: string) {
    // ✅ “Select” is now clicking the row
    setProjectInUrl(projectId);

    // ✅ Admin: open drawer on click
    if (isAdmin) openDrawer(projectId);
  }

  // ---- AppShell early returns (must include children!) ----
  if (loading) {
    return (
      <AppShell title="Projects" subtitle="Loading…">
        <div className="card cardPad prShell">
          <div className="muted">Loading…</div>
        </div>
      </AppShell>
    );
  }

  if (!userId) {
    return (
      <AppShell title="Projects" subtitle="Please log in.">
        <div className="card cardPad prShell">
          <div className="muted" style={{ marginBottom: 10 }}>
            You need to log in to view projects.
          </div>
          <button className="btnPrimary" onClick={() => router.push("/login")}>
            Go to Login
          </button>
        </div>
      </AppShell>
    );
  }

  const subtitle = manageUser
    ? `Managing project access for ${manageUser.full_name || manageUser.id}`
    : isAdmin
      ? "Admin view (org projects)"
      : isManagerOrAdmin
        ? "Manager view (org projects)"
        : "Your assigned projects";

  const headerRight = (
    <div className="prHeaderRight">
      <span className="badge">{counts.active} active</span>
      <span className="badge">{counts.inactive} inactive</span>
      <span className="badge">{counts.total} total</span>
    </div>
  );

  return (
    <AppShell title="Projects" subtitle={subtitle} right={headerRight}>
      {fetchErr ? (
        <div className="alert alertWarn">
          <b>Notice</b>
          <div style={{ marginTop: 6 }}>{fetchErr}</div>
        </div>
      ) : null}

      {/* Admin: create project */}
      {isAdmin ? (
        <div className="card cardPad" style={{ marginTop: 12 }}>
          <div className="prLabel">Create project</div>
          <div className="prCreateGrid">
            <div>
              <div className="prLabel">Project name</div>
              <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g., Store remodel" />
            </div>

            <div>
              <div className="prLabel">Week start</div>
              <select value={newWeekStart} onChange={(e) => setNewWeekStart(e.target.value as WeekStart)}>
                <option value="sunday">Sunday</option>
                <option value="monday">Monday</option>
              </select>
            </div>

            <div className="prCreateBtnWrap">
              <button className="btnPrimary" disabled={createBusy} onClick={createProject}>
                {createBusy ? "Creating…" : "Create"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Filters */}
      <div className="card cardPad" style={{ marginTop: 12 }}>
        <div className="prFilters">
          <div className="prFiltersLeft">
            <div className="prField">
              <div className="prLabel">Filter</div>
              <select value={activeFilter} onChange={(e) => setActiveFilter(e.target.value as ActiveFilter)}>
                <option value="all">All</option>
                <option value="active">Active only</option>
                <option value="inactive">Inactive only</option>
              </select>
            </div>

            <div className="prSearch">
              <div className="prLabel">Search</div>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or ID" />
            </div>
          </div>

          <div className="prFiltersRight">
            {manageUser ? tag("Assignment mode", "ok") : null}
            {selectedProjectId ? tag("Selected", "ok") : tag("No project selected", "warn")}
          </div>
        </div>
      </div>

      {/* Project list */}
      <div className="prList" style={{ marginTop: 12 }}>
        {filteredProjects.map((p) => {
          const assigned = assignedProjectIds.has(p.id);
          const selected = selectedProjectId === p.id;

          return (
            <div
              key={p.id}
              className={`prRow ${!p.is_active ? "prRowInactive" : ""}`}
              onClick={() => onProjectRowClick(p.id)}
              role="button"
              tabIndex={0}
              title="Click to select (Admin also opens details)"
            >
              <div className="prRowLeft">
                <span className="prDot" />
                <div>
                  <div className="prRowTitle">
                    {p.name} {p.is_active ? tag("Active", "ok") : tag("Inactive", "warn")}{" "}
                    {selected ? tag("Selected", "ok") : null}
                  </div>
                  <div className="prRowMeta muted">
                    {weekStartLabel(p.week_start)} • ID:{" "}
                    <span
                      className="mono"
                      style={{ cursor: "copy" }}
                      onClick={(e) => {
                        e.stopPropagation();
                        copyToClipboard(p.id);
                      }}
                      title="Click to copy"
                    >
                      {p.id}
                    </span>
                  </div>
                </div>
              </div>

              <div
                className="prRowActions"
                onClick={(e) => {
                  // prevent row click when using controls
                  e.stopPropagation();
                }}
              >
                {/* Admin-only assignment UI when /projects?user=... */}
                {manageUser && isAdmin ? (
                  <div className="prInline">
                    <span className="prInlineLabel">{assigned ? "Assigned" : "Not assigned"}</span>
                    <input
                      type="checkbox"
                      checked={assigned}
                      disabled={busyProjectId === p.id}
                      onChange={(e) => toggleAssignment(p.id, e.target.checked)}
                      title="Toggle assignment"
                    />
                    <span className="prInlineSaving muted">{busyProjectId === p.id ? "Saving…" : ""}</span>
                  </div>
                ) : null}

                {/* Admin-only project controls */}
                {isAdmin ? (
                  <div className="prInline">
                    <select
                      value={(p.week_start || "sunday") as WeekStart}
                      disabled={savingWeekStartId === p.id}
                      onChange={(e) => updateProjectWeekStart(p.id, e.target.value as WeekStart)}
                      title="Week start"
                    >
                      <option value="sunday">Sunday</option>
                      <option value="monday">Monday</option>
                    </select>

                    <button
                      className={p.is_active ? "" : "btnPrimary"}
                      disabled={busyProjectId === p.id}
                      onClick={() => toggleProjectActive(p.id, !p.is_active)}
                      title="Toggle active"
                    >
                      {busyProjectId === p.id ? "Saving…" : p.is_active ? "Deactivate" : "Activate"}
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {/* Drawer */}
      {drawerOpen && drawerProject ? (
        <div className="prDrawerOverlay" onClick={closeDrawer}>
          <div className="prDrawer" onClick={(e) => e.stopPropagation()}>
            <div className="prDrawerHeader">
              <div>
                <div className="prDrawerTitle">{drawerProject.name}</div>
                <div className="prDrawerTags">
                  {drawerProject.is_active ? tag("Active", "ok") : tag("Inactive", "warn")}
                  {tag(weekStartLabel(drawerProject.week_start))}
                </div>
              </div>

              <div className="prDrawerActions">
                <button onClick={closeDrawer}>Close</button>
              </div>
            </div>

            <div className="card cardPad" style={{ boxShadow: "none" }}>
              <div className="prLabel">Project ID</div>
              <div className="prIdRow">
                <span className="mono">{drawerProject.id}</span>
                <button onClick={() => copyToClipboard(drawerProject.id)}>Copy</button>
              </div>
            </div>

            {drawerMsg ? (
              <div className="alert alertWarn">
                <b>Notice</b>
                <div style={{ marginTop: 6 }}>{drawerMsg}</div>
              </div>
            ) : null}

            <div className="prDrawerMembers">
              <div className="prLabel">Members</div>

              {drawerBusy ? <div className="muted">Loading members…</div> : null}

              {!drawerBusy && drawerMembers.length === 0 ? (
                <div className="muted">No members assigned yet.</div>
              ) : null}

              <div className="prMemberList">
                {drawerMembers.map((m) => (
                  <div key={m.profile_id} className="prMemberRow">
                    <div className="prMemberTop">
                      <div>
                        <div className="prMemberName">{m.full_name || "(no name)"}</div>
                        <div className="prMemberId muted">
                          {m.role || "user"} • <span className="mono">{m.profile_id}</span>
                        </div>
                      </div>

                      {isAdmin ? (
                        <button
                          className="btnDanger"
                          disabled={memberActionBusy}
                          onClick={() => removeDrawerMember(m.profile_id)}
                          title="Remove from project"
                        >
                          Remove
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>

              {/* Admin manage members */}
              {isAdmin ? (
                <div className="card cardPad" style={{ marginTop: 12, boxShadow: "none" }}>
                  <div className="prLabel">Add member</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, alignItems: "end" }}>
                    <div>
                      <select value={memberPickId} onChange={(e) => setMemberPickId(e.target.value)}>
                        <option value="">Select a person…</option>
                        {availablePeopleToAdd.map((p) => (
                          <option key={p.id} value={p.id}>
                            {(p.full_name || "(no name)") + (p.role ? ` • ${p.role}` : "")}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div style={{ display: "flex", justifyContent: "flex-end" }}>
                      <button className="btnPrimary" disabled={!memberPickId || memberActionBusy} onClick={addDrawerMember}>
                        {memberActionBusy ? "Saving…" : "Add"}
                      </button>
                    </div>
                  </div>

                  <div className="muted" style={{ marginTop: 8, fontSize: 12 }}>
                    Tip: People → “Manage projects” enables bulk assignment mode.
                  </div>
                </div>
              ) : null}
            </div>

            <div className="prDrawerFooter muted">Keep projects active/inactive instead of deleting for cleaner history.</div>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}
