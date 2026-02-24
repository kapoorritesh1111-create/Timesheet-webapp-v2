"use client";

import RequireOnboarding from "../../../components/auth/RequireOnboarding";
import AppShell from "../../../components/layout/AppShell";
import PeopleDirectory from "../../../components/people/PeopleDirectory";
import AdminTabs from "../../../components/admin/AdminTabs";
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
        <AdminTabs active="users" />
        <PeopleDirectory mode="admin" />
      </AppShell>
    </RequireOnboarding>
  );
}
