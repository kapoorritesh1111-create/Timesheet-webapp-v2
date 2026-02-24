"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseBrowser";
import { Search, X } from "lucide-react";

type Role = "admin" | "manager" | "contractor";

export type UserRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: Role;
  manager_id: string | null;
  hourly_rate: number;
  is_active: boolean;
  last_sign_in_at: string | null;
};

type Project = { id: string; name: string | null; is_active: boolean };

export default function UserDrawer({
  open,
  onClose,
  user,
  managers,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  user: UserRow | null;
  managers: { id: string; full_name: string | null }[];
  onSaved: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  // Profile form state
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<Role>("contractor");
  const [managerId, setManagerId] = useState<string>("");
  const [rate, setRate] = useState<number>(0);
  const [active, setActive] = useState<boolean>(true);

  // Access state
  const [projects, setProjects] = useState<Project[]>([]);
  const [memberIds, setMemberIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  const [projQuery, setProjQuery] = useState("");

  useEffect(() => {
    if (!open || !user) return;

    // reset UI
    setMsg("");
    setSaving(false);

    // profile state
    setFullName(user.full_name || "");
    setRole(user.role);
    setManagerId(user.manager_id || "");
    setRate(Number(user.hourly_rate || 0));
    setActive(!!user.is_active);
  }, [open, user]);

  // Load projects + membership when drawer opens
  useEffect(() => {
    if (!open || !user) return;

    let cancelled = false;

    (async () => {
      setLoading(true);
      setMsg("");

      try {
        const { data: prof, error: profErr } = await supabase
          .from("profiles")
          .select("org_id")
          .eq("id", user.id)
          .maybeSingle();

        if (profErr) throw profErr;

        const org_id = (prof as any)?.org_id;
        if (!org_id) throw new Error("Missing org_id");

        const [{ data: projs, error: pErr }, { data: members, error: mErr }] = await Promise.all([
          supabase.from("projects").select("id, name, is_active").eq("org_id", org_id).order("name", { ascending: true }),
          supabase.from("project_members").select("project_id").eq("org_id", org_id).eq("user_id", user.id),
        ]);

        if (pErr) throw pErr;
        if (mErr) throw mErr;

        if (cancelled) return;

        setProjects((projs as any) ?? []);
        setMemberIds(new Set(((members as any) ?? []).map((r: any) => r.project_id)));
      } catch (e: any) {
        if (!cancelled) setMsg(e?.message || "Failed to load user access");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, user]);

  const title = useMemo(() => {
    if (!user) return "";
    return user.full_name || user.email || user.id;
  }, [user]);

  const filteredProjects = useMemo(() => {
    const q = projQuery.trim().toLowerCase();
    if (!q) return projects;

    return projects.filter((p) => {
      const name = (p.name || "").toLowerCase();
      return name.includes(q) || p.id.toLowerCase().includes(q);
    });
  }, [projects, projQuery]);

  async function saveProfile() {
    if (!user) return;
    setSaving(true);
    setMsg("");

    try {
      const payload: any = {
        full_name: fullName.trim() || null,
        role,
        hourly_rate: Number(rate || 0),
        is_active: !!active,
        manager_id: role === "contractor" ? (managerId || null) : null,
      };

      const { error } = await supabase.from("profiles").update(payload).eq("id", user.id);
      if (error) throw error;

      setMsg("Saved ✅");
      onSaved();
    } catch (e: any) {
      setMsg(e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function toggleProject(project_id: string, checked: boolean) {
    if (!user) return;
    setMsg("");

    // optimistic UI
    setMemberIds((prev) => {
      const n = new Set(prev);
      if (checked) n.add(project_id);
      else n.delete(project_id);
      return n;
    });

    try {
      const { data: prof, error: profErr } = await supabase
        .from("profiles")
        .select("org_id")
        .eq("id", user.id)
        .maybeSingle();
      if (profErr) throw profErr;

      const org_id = (prof as any)?.org_id;
      if (!org_id) throw new Error("Missing org_id");

      if (checked) {
        const { error } = await supabase
          .from("project_members")
          .upsert([{ org_id, project_id, user_id: user.id, profile_id: user.id, is_active: true }] as any, {
            onConflict: "project_id,user_id",
          });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("project_members")
          .delete()
          .eq("org_id", org_id)
          .eq("project_id", project_id)
          .eq("user_id", user.id);
        if (error) throw error;
      }

      onSaved();
    } catch (e: any) {
      // revert on error
      setMemberIds((prev) => {
        const n = new Set(prev);
        if (checked) n.delete(project_id);
        else n.add(project_id);
        return n;
      });
      setMsg(e?.message || "Update access failed");
    }
  }

  function clearSelection() {
    // remove all memberships shown (bulk clear)
    // NOTE: we keep this UI-only for now (safe).
    // If you want real bulk-clear in DB, we’ll add an API route next step.
    setMsg("Tip: Uncheck projects to remove access.");
  }

  if (!open || !user) return null;

  return (
    <div style={overlay}>
      <div style={backdrop} onClick={onClose} />

      <div style={panel}>
        <div style={panelHeader}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 950, fontSize: 16, overflow: "hidden", textOverflow: "ellipsis" }}>{title}</div>
            <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>
              {user.email || "—"} • {user.id.slice(0, 8)}…
            </div>
          </div>

          <button className="iconBtn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div style={scrollArea}>
          {msg ? (
            <div className="card cardPad" style={{ marginBottom: 12 }}>
              <div className="muted">{msg}</div>
            </div>
          ) : null}

          {/* Card 1: User details */}
          <div className="card cardPad" style={{ marginBottom: 12 }}>
            <div style={{ fontWeight: 950 }}>User details</div>
            <div className="muted" style={{ marginTop: 6 }}>
              Edit role, manager, rate, and status.
            </div>

            <div style={{ marginTop: 14 }}>
              <label className="label">Full name</label>
              <input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>

            <div className="row" style={{ gap: 12, marginTop: 12 }}>
              <div style={{ flex: 1 }}>
                <label className="label">Role</label>
                <select className="input" value={role} onChange={(e) => setRole(e.target.value as Role)}>
                  <option value="contractor">Contractor</option>
                  <option value="manager">Manager</option>
                </select>
              </div>

              <div style={{ width: 180 }}>
                <label className="label">Hourly rate</label>
                <input
                  className="input"
                  value={String(rate)}
                  onChange={(e) => setRate(Number(e.target.value))}
                  inputMode="decimal"
                />
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              <label className="label">Assign manager</label>
              <select
                className="input"
                disabled={role !== "contractor"}
                value={managerId}
                onChange={(e) => setManagerId(e.target.value)}
              >
                <option value="">—</option>
                {managers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {(m.full_name || "Manager") + " (" + m.id.slice(0, 6) + "…)"}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginTop: 12 }}>
              <label className="row" style={{ gap: 8 }}>
                <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
                <span>Active</span>
              </label>
            </div>
          </div>

          {/* Card 2: Project access */}
          <div className="card cardPad">
            <div style={{ fontWeight: 950 }}>Project access</div>
            <div className="muted" style={{ marginTop: 6 }}>
              Select projects to assign immediately
            </div>

            <div className="row" style={{ gap: 10, marginTop: 12, alignItems: "center" }}>
              <span className="tag tagMuted">{memberIds.size ? `${memberIds.size} selected` : "None"}</span>

              <div style={{ flex: 1 }} />

              <button className="pill" onClick={clearSelection} type="button">
                Clear selection
              </button>
            </div>

            <div style={{ marginTop: 10 }}>
              <div style={{ position: "relative" }}>
                <Search size={16} style={{ position: "absolute", left: 12, top: 12, opacity: 0.7 }} />
                <input
                  className="input"
                  style={{ paddingLeft: 36 }}
                  placeholder="Search projects…"
                  value={projQuery}
                  onChange={(e) => setProjQuery(e.target.value)}
                />
              </div>
            </div>

            {loading ? (
              <div className="muted" style={{ marginTop: 12 }}>
                Loading…
              </div>
            ) : (
              <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                {filteredProjects.map((p) => {
                  const checked = memberIds.has(p.id);
                  return (
                    <label key={p.id} className="pmRow">
                      <input type="checkbox" checked={checked} onChange={(e) => toggleProject(p.id, e.target.checked)} />
                      <div className="pmMain">
                        <div className="pmTitle">{p.name || "Untitled project"}</div>
                        <div className="pmSub">{p.id}</div>
                      </div>
                      <div className="pmRight">
                        <span className={`tag ${p.is_active ? "tagOk" : "tagWarn"}`}>{p.is_active ? "Active" : "Inactive"}</span>
                      </div>
                    </label>
                  );
                })}

                {filteredProjects.length === 0 ? (
                  <div className="muted" style={{ padding: "10px 2px" }}>
                    No projects match your search.
                  </div>
                ) : null}
              </div>
            )}
          </div>

          <div style={{ height: 16 }} />
        </div>

        {/* Footer: Invite drawer style */}
        <div style={footer}>
          <button className="pill" onClick={onClose}>
            Close
          </button>
          <button className="btn" onClick={saveProfile} disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

const overlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 50,
};

const backdrop: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  background: "rgba(0,0,0,0.42)",
};

const panel: React.CSSProperties = {
  position: "absolute",
  top: 0,
  right: 0,
  height: "100%",
  width: "min(560px, 92vw)",
  background: "rgba(12,16,24,0.98)",
  borderLeft: "1px solid rgba(255,255,255,0.10)",
  boxShadow: "0 20px 80px rgba(0,0,0,0.55)",
  display: "flex",
  flexDirection: "column",
};

const panelHeader: React.CSSProperties = {
  padding: "16px 16px 10px",
  display: "flex",
  gap: 12,
  alignItems: "flex-start",
  justifyContent: "space-between",
};

const scrollArea: React.CSSProperties = {
  flex: 1,
  overflow: "auto",
  padding: "0 16px 0",
};

const footer: React.CSSProperties = {
  padding: 16,
  borderTop: "1px solid rgba(255,255,255,0.08)",
  display: "flex",
  justifyContent: "flex-end",
  gap: 10,
  background: "rgba(12,16,24,0.98)",
};
