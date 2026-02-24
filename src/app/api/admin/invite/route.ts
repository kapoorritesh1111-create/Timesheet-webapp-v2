import { NextRequest, NextResponse } from "next/server";
import { supabaseService } from "../../../../lib/supabaseServer";

type Role = "admin" | "manager" | "contractor";

function isValidEmail(s: string) {
  const v = (s || "").trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

export async function POST(req: NextRequest) {
  try {
    // ✅ Require caller token (admin session from browser)
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) {
      return NextResponse.json({ ok: false, error: "Missing auth token" }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });

    const email = String(body.email || "").trim().toLowerCase();
    const full_name = String(body.full_name || "").trim();
    const hourly_rate = Number(body.hourly_rate ?? 0);
    const role = String(body.role || "contractor") as Role;
    const manager_id = body.manager_id ? String(body.manager_id) : null;

    const project_ids_raw = Array.isArray(body.project_ids) ? body.project_ids : [];
    const project_ids = project_ids_raw
      .map((x: any) => String(x || "").trim())
      .filter((x: string) => x.length > 0);

    if (!email || !isValidEmail(email)) {
      return NextResponse.json({ ok: false, error: "Valid email required" }, { status: 400 });
    }
    if (!["manager", "contractor"].includes(role)) {
      return NextResponse.json({ ok: false, error: "Role must be manager or contractor" }, { status: 400 });
    }
    if (Number.isNaN(hourly_rate) || hourly_rate < 0) {
      return NextResponse.json({ ok: false, error: "Hourly rate invalid" }, { status: 400 });
    }

    const supa = supabaseService();

    // ✅ Verify caller token and admin role
    const { data: caller, error: callerErr } = await supa.auth.getUser(token);
    if (callerErr || !caller?.user) {
      return NextResponse.json({ ok: false, error: callerErr?.message || "Unauthorized" }, { status: 401 });
    }

    const { data: callerProf, error: callerProfErr } = await supa
      .from("profiles")
      .select("id, org_id, role")
      .eq("id", caller.user.id)
      .maybeSingle();

    if (callerProfErr) {
      return NextResponse.json({ ok: false, error: callerProfErr.message }, { status: 400 });
    }
    if (!callerProf?.org_id || callerProf.role !== "admin") {
      return NextResponse.json({ ok: false, error: "Admin only" }, { status: 403 });
    }

    // ✅ Invite via Supabase Auth (sends email)
    const redirectTo = (`${process.env.NEXT_PUBLIC_SITE_URL || ""}/auth/callback`).trim() || undefined;

    const { data: inviteData, error: inviteErr } = await supa.auth.admin.inviteUserByEmail(email, {
      redirectTo,
    });

    if (inviteErr) {
      return NextResponse.json({ ok: false, error: inviteErr.message }, { status: 400 });
    }

    const invitedUserId = inviteData.user?.id;
    if (!invitedUserId) {
      return NextResponse.json({ ok: false, error: "Invite created but missing user id" }, { status: 400 });
    }

    // ✅ Create/update profile safely (upsert)
    // IMPORTANT: This will be fully stable once you apply the SQL change below
    // so service_role is allowed through guard_profiles_update().
    const payload = {
      id: invitedUserId,
      org_id: callerProf.org_id,
      role,
      full_name: full_name || null,
      hourly_rate,
      is_active: true,
      manager_id: role === "contractor" ? manager_id : null,
    };

    const { error: profUpErr } = await supa
      .from("profiles")
      .upsert(payload as any, { onConflict: "id" });

    if (profUpErr) {
      return NextResponse.json({ ok: false, error: profUpErr.message }, { status: 400 });
    }

    // ✅ Assign projects (optional)
    if (project_ids.length > 0) {
      // Validate projects belong to org
      const { data: validProjects, error: projErr } = await supa
        .from("projects")
        .select("id")
        .eq("org_id", callerProf.org_id)
        .in("id", project_ids);

      if (projErr) return NextResponse.json({ ok: false, error: projErr.message }, { status: 400 });

      const validIds = new Set(((validProjects as any) ?? []).map((p: any) => p.id));
      const invalid = project_ids.filter((id: string) => !validIds.has(id));
      if (invalid.length) {
        return NextResponse.json(
          { ok: false, error: `Invalid project(s) for this org: ${invalid.join(", ")}` },
          { status: 400 }
        );
      }

      const memberRows = project_ids.map((pid: string) => ({
        org_id: callerProf.org_id,
        project_id: pid,
        user_id: invitedUserId,
        profile_id: invitedUserId,
        is_active: true,
      }));

      const { error: memErr } = await supa
        .from("project_members")
        .upsert(memberRows as any, { onConflict: "project_id,user_id" });

      if (memErr) return NextResponse.json({ ok: false, error: memErr.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Server error" }, { status: 500 });
  }
}
