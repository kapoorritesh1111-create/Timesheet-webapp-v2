"use client";

import { useMemo } from "react";
import { Search, X } from "lucide-react";

type Role = "admin" | "manager" | "contractor";
type ManagerRow = { id: string; full_name: string | null; role: Role };
type ProjectRow = { id: string; name: string; is_active: boolean };

function normalize(s: string | null | undefined) {
  return (s ?? "").toLowerCase().trim();
}

export default function InviteDrawer(props: {
  open: boolean;
  onClose: () => void;

  email: string;
  setEmail: (v: string) => void;

  fullName: string;
  setFullName: (v: string) => void;

  inviteRole: Exclude<Role, "admin">;
  setInviteRole: (v: Exclude<Role, "admin">) => void;

  hourlyRate: number;
  setHourlyRate: (v: number) => void;

  managers: ManagerRow[];
  managerId: string;
  setManagerId: (v: string) => void;

  projects: ProjectRow[];
  projectQuery: string;
  setProjectQuery: (v: string) => void;

  projectIds: string[];
  toggleProject: (id: string) => void;
  clearProjects: () => void;

  canSend: boolean;
  busy: boolean;
  onSend: (e: React.FormEvent) => void;
}) {
  const filteredProjects = useMemo(() => {
    const needle = normalize(props.projectQuery);
    if (!needle) return props.projects;
    return props.projects.filter((p) => normalize(p.name).includes(needle));
  }, [props.projects, props.projectQuery]);

  const selectedCount = props.projectIds.length;

  if (!props.open) return null;

  return (
    <>
      {/* Overlay */}
      <div
        onClick={props.onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.45)",
          zIndex: 50,
        }}
      />

      {/* Drawer */}
      <div
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          height: "100vh",
          width: "min(560px, 92vw)",
          zIndex: 51,
          background: "rgba(12,16,24,0.98)",
          borderLeft: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 20px 80px rgba(0,0,0,0.55)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: 16,
            borderBottom: "1px solid rgba(255,255,255,0.08)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div>
            <div style={{ fontWeight: 950, fontSize: 16 }}>New invite</div>
            <div className="muted" style={{ marginTop: 4, fontSize: 12 }}>
              Add teammate + assign access
            </div>
          </div>
          <button className="iconBtn" onClick={props.onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <form
          onSubmit={props.onSend}
          style={{ padding: 16, overflow: "auto", flex: 1 }}
        >
          {/* User section */}
          <div className="card" style={{ padding: 14 }}>
            <div style={{ fontWeight: 900 }}>User details</div>

            <div style={{ marginTop: 12 }}>
              <div className="label">Email</div>
              <input
                className="input"
                value={props.email}
                onChange={(e) => props.setEmail(e.target.value)}
                placeholder="name@company.com"
              />
            </div>

            <div style={{ marginTop: 12 }}>
              <div className="label">Full name</div>
              <input
                className="input"
                value={props.fullName}
                onChange={(e) => props.setFullName(e.target.value)}
                placeholder="Jane Contractor"
              />
            </div>

            <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <div className="label">Role</div>
                <select
                  className="select"
                  value={props.inviteRole}
                  onChange={(e) => props.setInviteRole(e.target.value as any)}
                >
                  <option value="contractor">Contractor</option>
                  <option value="manager">Manager</option>
                </select>
              </div>

              <div>
                <div className="label">Hourly rate</div>
                <input
                  className="input"
                  type="number"
                  disabled={props.inviteRole !== "contractor"}
                  value={props.inviteRole === "contractor" ? props.hourlyRate : 0}
                  onChange={(e) => props.setHourlyRate(Number(e.target.value))}
                  min={0}
                />
              </div>
            </div>

            {props.inviteRole === "contractor" ? (
              <div style={{ marginTop: 12 }}>
                <div className="label">Assign manager</div>
                <select
                  className="select"
                  value={props.managerId}
                  onChange={(e) => props.setManagerId(e.target.value)}
                >
                  {props.managers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.full_name ?? m.id} ({m.role})
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
          </div>

          {/* Access section */}
          <div className="card" style={{ padding: 14, marginTop: 12 }}>
            <div className="row" style={{ justifyContent: "space-between", gap: 10 }}>
              <div>
                <div style={{ fontWeight: 900 }}>Project access</div>
                <div className="muted" style={{ marginTop: 4, fontSize: 12 }}>
                  Select projects to assign immediately
                </div>
              </div>
              {selectedCount > 0 ? (
                <span className="tag tagOk">{selectedCount} selected</span>
              ) : (
                <span className="tag tagMuted">None</span>
              )}
            </div>

            <div className="peopleSearch" style={{ marginTop: 12 }}>
              <Search size={16} />
              <input
                value={props.projectQuery}
                onChange={(e) => props.setProjectQuery(e.target.value)}
                placeholder="Search projects…"
              />
            </div>

            {selectedCount > 0 ? (
              <div className="row" style={{ gap: 8, flexWrap: "wrap", marginTop: 10, alignItems: "center" }}>
                <button type="button" className="pill" onClick={props.clearProjects}>
                  Clear selection
                </button>
              </div>
            ) : null}

            {/* List */}
            <div
              style={{
                marginTop: 12,
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 14,
                overflow: "hidden",
              }}
            >
              <div style={{ maxHeight: 320, overflow: "auto" }}>
                {filteredProjects.length === 0 ? (
                  <div className="muted" style={{ padding: 12 }}>
                    No projects match your search.
                  </div>
                ) : (
                  filteredProjects.map((p) => {
                    const checked = props.projectIds.includes(p.id);
                    return (
                      <label
                        key={p.id}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "18px 1fr auto",
                          gap: 12,
                          alignItems: "center",
                          padding: "12px 12px",
                          borderTop: "1px solid rgba(255,255,255,0.06)",
                          cursor: "pointer",
                          userSelect: "none",
                        }}
                      >
                        {/* ✅ checkbox alignment fixed by grid + alignItems */}
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => props.toggleProject(p.id)}
                          style={{ margin: 0 }}
                        />

                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 850, lineHeight: 1.2, whiteSpace: "normal" }}>
                            {p.name}
                          </div>
                          <div className="muted mono" style={{ fontSize: 11, marginTop: 6, overflow: "hidden", textOverflow: "ellipsis" }}>
                            {p.id}
                          </div>
                        </div>

                        <span className={`tag ${p.is_active ? "tagOk" : "tagMuted"}`}>
                          {p.is_active ? "Active" : "Inactive"}
                        </span>
                      </label>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          <div style={{ height: 14 }} />
        </form>

        {/* Footer */}
        <div
          style={{
            padding: 16,
            borderTop: "1px solid rgba(255,255,255,0.08)",
            display: "flex",
            gap: 10,
            justifyContent: "flex-end",
          }}
        >
          <button className="pill" onClick={props.onClose} type="button">
            Cancel
          </button>
          <button className="btn" disabled={!props.canSend || props.busy} onClick={props.onSend as any}>
            {props.busy ? "Sending…" : "Send invite"}
          </button>
        </div>
      </div>
    </>
  );
}
