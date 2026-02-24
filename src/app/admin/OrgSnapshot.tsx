"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseBrowser";
import { useProfile } from "../../lib/useProfile";

type Snapshot = {
  users_total: number;
  users_active: number;
  contractors_active: number;
  projects_total: number;
  projects_active: number;
  hours_month: number; // total hours current month
  pending_invites: number;
};

function startOfMonthISO(d = new Date()) {
  const x = new Date(d.getFullYear(), d.getMonth(), 1);
  return x.toISOString();
}
function startOfNextMonthISO(d = new Date()) {
  const x = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  return x.toISOString();
}

export default function OrgSnapshot() {
  const { profile } = useProfile();
  const isAdmin = profile?.role === "admin";

  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [msg, setMsg] = useState("");

  const monthLabel = useMemo(() => {
    const d = new Date();
    return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  }, []);

  useEffect(() => {
    if (!profile?.org_id || !isAdmin) return;

    let cancelled = false;

    (async () => {
      setMsg("");
      try {
        // 1) Users (profiles)
        const { data: profs, error: profErr } = await supabase
          .from("profiles")
          .select("id, role, is_active")
          .eq("org_id", profile.org_id);

        if (profErr) throw profErr;

        const users_total = (profs ?? []).length;
        const users_active = (profs ?? []).filter((p: any) => p.is_active).length;
        const contractors_active = (profs ?? []).filter(
          (p: any) => p.is_active && p.role === "contractor"
        ).length;

        // 2) Projects
        const { data: projs, error: projErr } = await supabase
          .from("projects")
          .select("id, is_active")
          .eq("org_id", profile.org_id);

        if (projErr) throw projErr;

        const projects_total = (projs ?? []).length;
        const projects_active = (projs ?? []).filter((p: any) => p.is_active).length;

        // 3) Hours this month (time_entries)
        // NOTE: uses created_at OR work_date depending on schema; we use created_at as safest default.
        // If your table has "work_date" or "date", we can switch.
        const from = startOfMonthISO();
        const to = startOfNextMonthISO();

        const { data: entries, error: teErr } = await supabase
          .from("time_entries")
          .select("hours, created_at")
          .eq("org_id", profile.org_id)
          .gte("created_at", from)
          .lt("created_at", to);

        if (teErr) throw teErr;

        const hours_month = (entries ?? []).reduce(
          (acc: number, r: any) => acc + Number(r.hours || 0),
          0
        );

        // 4) Pending invites via admin API (Auth)
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;

        let pending_invites = 0;
        if (token) {
          const res = await fetch("/api/admin/invitations", {
            headers: { authorization: `Bearer ${token}` },
          });
          const json = await res.json().catch(() => ({}));
          if (res.ok && json.ok) {
            pending_invites = (json.users ?? []).filter((u: any) => u.status === "pending").length;
          }
        }

        if (cancelled) return;

        setSnap({
          users_total,
          users_active,
          contractors_active,
          projects_total,
          projects_active,
          hours_month,
          pending_invites,
        });
      } catch (e: any) {
        if (cancelled) return;
        setMsg(e?.message || "Failed to load snapshot");
        setSnap(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [profile?.org_id, isAdmin]);

  if (!isAdmin) return null;

  return (
    <div className="card cardPad" style={{ maxWidth: 980, marginBottom: 12 }}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontWeight: 950, fontSize: 16 }}>Org snapshot</div>
          <div className="muted" style={{ marginTop: 6 }}>
            Quick health metrics • {monthLabel}
          </div>
        </div>
        {snap ? <span className="tag tagOk">Live</span> : <span className="tag tagMuted">—</span>}
      </div>

      {msg ? (
        <div
          style={{
            marginTop: 12,
            padding: 10,
            borderRadius: 12,
            border: "1px solid rgba(239,68,68,0.35)",
            background: "rgba(239,68,68,0.06)",
            fontSize: 13,
            whiteSpace: "pre-wrap",
          }}
        >
          {msg}
        </div>
      ) : null}

      <div
        style={{
          marginTop: 14,
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: 12,
        }}
      >
        <Kpi title="Users" value={snap?.users_total ?? "—"} sub={`${snap?.users_active ?? "—"} active`} />
        <Kpi title="Contractors" value={snap?.contractors_active ?? "—"} sub="active" />
        <Kpi title="Projects" value={snap?.projects_total ?? "—"} sub={`${snap?.projects_active ?? "—"} active`} />
        <Kpi title="Pending invites" value={snap?.pending_invites ?? "—"} sub="Auth invites" />
      </div>

      <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
        <KpiWide title="Hours this month" value={snap ? snap.hours_month.toFixed(2) : "—"} sub="Sum of time entries created this month" />
      </div>
    </div>
  );
}

function Kpi({ title, value, sub }: { title: string; value: any; sub: string }) {
  return (
    <div
      style={{
        padding: 12,
        borderRadius: 14,
        border: "1px solid rgba(255,255,255,0.08)",
        background: "rgba(255,255,255,0.02)",
      }}
    >
      <div className="muted" style={{ fontSize: 12 }}>{title}</div>
      <div style={{ fontWeight: 950, fontSize: 22, marginTop: 6 }}>{value}</div>
      <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>{sub}</div>
    </div>
  );
}

function KpiWide({ title, value, sub }: { title: string; value: any; sub: string }) {
  return (
    <div
      style={{
        padding: 12,
        borderRadius: 14,
        border: "1px solid rgba(255,255,255,0.08)",
        background: "rgba(255,255,255,0.02)",
      }}
    >
      <div className="row" style={{ justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
        <div>
          <div className="muted" style={{ fontSize: 12 }}>{title}</div>
          <div style={{ fontWeight: 950, fontSize: 26, marginTop: 6 }}>{value}</div>
        </div>
        <span className="tag tagMuted">This month</span>
      </div>
      <div className="muted" style={{ fontSize: 12, marginTop: 10 }}>{sub}</div>
    </div>
  );
}
