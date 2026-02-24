"use client";

import RequireOnboarding from "../../../components/auth/RequireOnboarding";
import AppShell from "../../../components/layout/AppShell";
import PeopleDirectory from "../../../components/people/PeopleDirectory";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import { useProfile } from "../../../lib/useProfile";

export default function AdminUsersPage() {
  const router = useRouter();
  const { profile } = useProfile();
  const isAdmin = profile?.role === "admin";

  return (
    <RequireOnboarding>
      <AppShell
        title="User management"
        subtitle="Admin directory (Users)"
        right={
          isAdmin ? (
            <button className="pill" onClick={() => router.push("/admin")} title="Invite users">
              <UserPlus size={16} style={{ marginRight: 8 }} />
              Invite
            </button>
          ) : null
        }
      >
        <AdminTabs />
        <PeopleDirectory mode="admin" />
      </AppShell>
    </RequireOnboarding>
  );
}

function AdminTabs() {
  return (
    <div className="card cardPad" style={{ maxWidth: 980, marginBottom: 12 }}>
      <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
        <a className="pill" href="/admin/users" style={{ textDecoration: "none" }}>
          Users
        </a>
        <a className="pill" href="/admin" style={{ textDecoration: "none" }}>
          Invite
        </a>
      </div>
      <div className="muted" style={{ marginTop: 8 }}>
        Users is your Monday-style directory. Invite is where you add new teammates.
      </div>
    </div>
  );
}
