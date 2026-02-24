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

export default function AdminPage() {
  return (
    <RequireOnboarding>
      <AdminInner />
    </RequireOnboarding>
  );
}

function AdminInner() {
  const { profile } = useProfile();

  const isAdmin = profile?.role === "admin";

  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [hourlyRate, setHourlyRate] = useState(0);
  const [inviteRole, setInviteRole] =
    useState<Exclude<Role, "admin">>("contractor");

  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [projectQuery, setProjectQuery] = useState("");
  const [projectIds, setProjectIds] = useState<string[]>([]);

  useEffect(() => {
    if (!profile?.org_id || !isAdmin) return;

    supabase
      .from("projects")
      .select("id, name, is_active")
      .eq("org_id", profile.org_id)
      .order("name")
      .then(({ data }) => setProjects((data as any) || []));
  }, [profile?.org_id, isAdmin]);

  const filteredProjects = useMemo(() => {
    if (!projectQuery) return projects;
    return projects.filter((p) =>
      p.name.toLowerCase().includes(projectQuery.toLowerCase())
    );
  }, [projects, projectQuery]);

  function toggleProject(id: string) {
    setProjectIds((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : [...prev, id]
    );
  }

  async function sendInvite(e: React.FormEvent) {
    e.preventDefault();
    alert("Invite logic already wired — this is layout refinement step.");
  }

  if (!isAdmin) {
    return (
      <AppShell title="Admin" subtitle="Admin only">
        <div className="card cardPad">Admin only</div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Admin" subtitle="Invite and manage access">
      <AdminTabs active="invite" />

      {/* Layout Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.2fr 1fr",
          gap: 24,
          alignItems: "start",
        }}
      >
        {/* LEFT — User Info */}
        <div className="card cardPad">
          <div style={{ fontWeight: 900, fontSize: 16 }}>
            User details
          </div>

          <div style={{ marginTop: 16 }}>
            <div className="label">Email</div>
            <input
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
            />
          </div>

          <div style={{ marginTop: 14 }}>
            <div className="label">Full name</div>
            <input
              className="input"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Jane Contractor"
            />
          </div>

          <div style={{ marginTop: 14 }}>
            <div className="label">Role</div>
            <select
              className="select"
              value={inviteRole}
              onChange={(e) =>
                setInviteRole(e.target.value as any)
              }
            >
              <option value="contractor">Contractor</option>
              <option value="manager">Manager</option>
            </select>
          </div>

          {inviteRole === "contractor" && (
            <div style={{ marginTop: 14 }}>
              <div className="label">Hourly rate</div>
              <input
                className="input"
                type="number"
                value={hourlyRate}
                onChange={(e) =>
                  setHourlyRate(Number(e.target.value))
                }
              />
            </div>
          )}

          <button
            onClick={sendInvite}
            className="btn"
            style={{ marginTop: 24, width: "100%" }}
          >
            Send invite
          </button>
        </div>

        {/* RIGHT — Project Access */}
        <div className="card cardPad">
          <div style={{ fontWeight: 900, fontSize: 16 }}>
            Project access
          </div>

          <div className="peopleSearch" style={{ marginTop: 16 }}>
            <Search size={16} />
            <input
              value={projectQuery}
              onChange={(e) =>
                setProjectQuery(e.target.value)
              }
              placeholder="Search projects..."
            />
          </div>

          {projectIds.length > 0 && (
            <div
              style={{
                marginTop: 12,
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              {projectIds.length} selected
            </div>
          )}

          <div
            style={{
              marginTop: 12,
              maxHeight: 260,
              overflowY: "auto",
            }}
          >
            {filteredProjects.map((p) => (
              <label
                key={p.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: 8,
                  borderRadius: 8,
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={projectIds.includes(p.id)}
                  onChange={() => toggleProject(p.id)}
                />
                <div style={{ fontWeight: 700 }}>
                  {p.name}
                </div>
              </label>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
