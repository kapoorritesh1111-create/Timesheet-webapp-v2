"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseBrowser";
import { X } from "lucide-react";

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
  const [tab, setTab] = useState<"profile" | "access">("profile");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<Role>("contractor");
  const [managerId, setManagerId] = useState<string>("");
  const [rate, setRate] = useState<number>(0);
  const [active, setActive] = useState<boolean>(true);

  const [projects, setProjects] = useState<Project[]>([]);
  const [memberIds, setMemberIds] = useState<Set<string>>(new Set());
  const [loadingAccess, setLoadingAccess] = useState(false);

  useEffect(() => {
    if (!open || !user) return;
    setTab("profile");
    setMsg("");
    setFullName(user.full_name || "");
    setRole(user.role);
    setManagerId(user.manager_id || "");
    setRate(Number(user.hourly_rate || 0));
    setActive(!!user.is_active);
  }, [open, user]);

  useEffect(() => {
    if (!open || !user) return;
    if (tab !== "access") return;

    let cancelled = false;

    (async () => {
      setLoadingAccess(true);
      setMsg("");

      try {
        const { data: prof } = await supabase.from("profiles").select("org_id").eq("id", user.id).maybeSingle();
        const org_id = (prof as any)?.org_id;
        if (!org_id) throw new Error("Missing org_id");

        const { data: projs, error: pErr } = await supabase
          .from("projects")
          .select("id, name, is_active")
          .eq("org_id", org_id)
          .order("name", { ascending: true });

        if (pErr) throw pErr;

        const { data: members, error: mErr } = await supabase
          .from("project_members")
          .select("project_id")
          .eq("org_id", org_id)
          .eq("user_id", user.id);

        if (mErr) throw mErr;

        if (cancelled) return;

        setProjects((projs as any) ?? []);
        setMemberIds(new Set(((members as any) ?? []).map((r: any) => r.project_id)));
      } catch (e: any) {
        if (!cancelled) setMsg(e?.message || "Failed to load access");
      } finally {
        if (!cancelled) setLoadingAccess(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, tab, user]);

  const title = useMemo(() => {
    if (!user) return "";
    return user.full_name || user.email || user.id;
  }, [user]);

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
    try {
      const { data: prof } = await supabase.from("profiles").select("org_id").eq("id", user.id).maybeSingle();
      const org_id = (prof as any)?.org_id;
      if (!org_id) throw new Error("Missing org_id");

      if (checked) {
        const { error } = await supabase
          .from("project_members")
          .upsert([{ org_id, project_id, user_id: user.id, profile_id: user.id, is_active: true }] as any, {
            onConflict: "project_id,user_id",
          });
        if (error) throw error;

        setMemberIds((prev) => new Set(prev).add(project_id));
      } else {
        const { error } = await supabase
          .from("project_members")
          .delete()
          .eq("org_id", org_id)
          .eq("project_id", project_id)
          .eq("user_id", user.id);
        if (error) throw error;

        setMemberIds((prev) => {
          const n = new Set(prev);
          n.delete(project_id);
          return n;
        });
      }

      onSaved();
    } catch (e: any) {
      setMsg(e?.message || "Update access failed");
    }
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

        <div style={tabs}>
          <button className={`pill ${tab === "profile" ? "pillActive" : ""}`} onClick={() => setTab("profile")}>
            Profile
          </button>
          <button className={`pill ${tab === "access" ? "pillActive" : ""}`} onClick={() => setTab("access")}>
            Project access
          </button>
        </div>

        {msg ? (
          <div style={{ margin: "10px 16px" }} className="muted">
            {msg}
          </div>
        ) : null}

        <div style={content}>
          {tab === "profile" ? (
            <div className="card cardPad">
              <div style={{ fontWeight: 950, marginBottom: 10 }}>User details</div>

              <label className="label">Full name</label>
              <input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} />

              <div className="row" style={{ gap: 12, marginTop: 12 }}>
                <div style={{ flex: 1 }}>
                  <label className="label">Role</label>
                  <select className="input" value={role} onChange={(e) => setRole(e.target.value as Role)}>
                    <option value="contractor">Contractor</option>
                    <option value="manager">Manager</option>
                  </select>
                </div>

                <div style={{ width: 160 }}>
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

              <div className="row" style={{ justifyContent: "space-between", marginTop: 12 }}>
                <label className="row" style={{ gap: 8 }}>
                  <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
                  <span>Active</span>
                </label>

                <button className="btn" onClick={saveProfile} disabled={saving}>
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          ) : (
            <div className="card cardPad">
              <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
                <div>
                  <div style={{ fontWeight: 950 }}>Project access</div>
                  <div className="muted" style={{ marginTop: 6 }}>
                    Toggle project membership for this user
                  </div>
                </div>
                <span className="tag tagMuted">{memberIds.size} selected</span>
              </div>

              {loadingAccess ? (
                <div className="muted" style={{ marginTop: 12 }}>
                  Loading…
                </div>
              ) : (
                <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                  {projects.map((p) => {
                    const checked = memberIds.has(p.id);
                    return (
                      <label key={p.id} className="dirCheck">
                        <input type="checkbox" checked={checked} onChange={(e) => toggleProject(p.id, e.target.checked)} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 900 }}>{p.name || "Untitled project"}</div>
                          <div className="muted mono" style={{ fontSize: 11, marginTop: 4 }}>
                            {p.id}
                          </div>
                        </div>
                        <span className={`tag ${p.is_active ? "tagOk" : "tagWarn"}`}>{p.is_active ? "Active" : "Inactive"}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        <div style={footer}>
          <button className="pill" onClick={onClose}>
            Close
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
  width: "min(520px, 92vw)",
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

const tabs: React.CSSProperties = {
  padding: "0 16px 12px",
  display: "flex",
  gap: 8,
};

const content: React.CSSProperties = {
  padding: "0 16px 16px",
  overflow: "auto",
  flex: 1,
};

const footer: React.CSSProperties = {
  padding: 16,
  borderTop: "1px solid rgba(255,255,255,0.08)",
  display: "flex",
  justifyContent: "flex-end",
};
