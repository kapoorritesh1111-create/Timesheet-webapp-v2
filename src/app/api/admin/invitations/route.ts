// src/app/api/admin/invitations/route.ts
import { NextResponse } from "next/server";
import { supabaseService } from "../../../../lib/supabaseServer";

/**
 * Admin Invitations
 *
 * GET  /api/admin/invitations
 *   -> list auth users, mark pending invites
 *
 * POST /api/admin/invitations
 *   body: { email: string }
 *   -> generate invite link (copy/paste)
 *
 * DELETE /api/admin/invitations
 *   body: { user_id: string }
 *   -> cancel invite (delete auth user + cleanup)
 */

async function requireAdmin(req: Request) {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  if (!token) {
    return { ok: false as const, status: 401, error: "Missing auth token" };
  }

  const supa = supabaseService();

  // Verify caller token
  const { data: caller, error: callerErr } = await supa.auth.getUser(token);
  if (callerErr || !caller?.user) {
    return { ok: false as const, status: 401, error: callerErr?.message || "Unauthorized" };
  }

  // Caller must be admin (via profiles)
  const { data: callerProf, error: callerProfErr } = await supa
    .from("profiles")
    .select("id, org_id, role")
    .eq("id", caller.user.id)
    .maybeSingle();

  if (callerProfErr) {
    return { ok: false as const, status: 400, error: callerProfErr.message || "Profile lookup failed" };
  }

  if (!callerProf?.org_id || callerProf.role !== "admin") {
    return { ok: false as const, status: 403, error: "Admin only" };
  }

  return { ok: true as const, supa, org_id: callerProf.org_id };
}

export async function GET(req: Request) {
  try {
    const gate = await requireAdmin(req);
    if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: gate.status });

    const { supa } = gate;

    // List auth users (Supabase Auth Admin API)
    // NOTE: signature varies by supabase-js versions; this is the common v2 signature.
    const { data, error } = await supa.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

    const users = (data?.users ?? []).map((u: any) => {
      const email = u.email || "";
      const invited_at = u.invited_at || null;
      const created_at = u.created_at || null;
      const last_sign_in_at = u.last_sign_in_at || null;

      // Some projects use email_confirmed_at; some use confirmed_at. Handle both.
      const email_confirmed_at = u.email_confirmed_at || u.confirmed_at || null;

      const status =
        last_sign_in_at || email_confirmed_at ? "active" : invited_at ? "pending" : "unknown";

      return {
        id: u.id,
        email,
        status,
        invited_at,
        created_at,
        last_sign_in_at,
        email_confirmed_at,
      };
    });

    // Sort: pending first, then newest
    users.sort((a: any, b: any) => {
      if (a.status !== b.status) {
        const rank = (s: string) => (s === "pending" ? 0 : s === "active" ? 1 : 2);
        return rank(a.status) - rank(b.status);
      }
      const ta = new Date(a.invited_at || a.created_at || 0).getTime();
      const tb = new Date(b.invited_at || b.created_at || 0).getTime();
      return tb - ta;
    });

    return NextResponse.json({ ok: true, users });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const gate = await requireAdmin(req);
    if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: gate.status });

    const { supa } = gate;

    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });

    const email = String(body.email || "").trim().toLowerCase();
    if (!email) return NextResponse.json({ ok: false, error: "Email required" }, { status: 400 });

    const redirectTo = (`${process.env.NEXT_PUBLIC_SITE_URL || ""}/auth/callback`).trim() || undefined;

    // Generate an invite link (admin can copy/paste this to the teammate)
    const { data, error } = await supa.auth.admin.generateLink({
      type: "invite",
      email,
      options: redirectTo ? { redirectTo } : undefined,
    } as any);

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

    const action_link = (data as any)?.properties?.action_link || (data as any)?.action_link || null;
    if (!action_link) {
      return NextResponse.json({ ok: false, error: "Invite link not available" }, { status: 400 });
    }

    return NextResponse.json({ ok: true, action_link });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Server error" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const gate = await requireAdmin(req);
    if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: gate.status });

    const { supa, org_id } = gate;

    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });

    const user_id = String(body.user_id || "").trim();
    if (!user_id) return NextResponse.json({ ok: false, error: "user_id required" }, { status: 400 });

    // Cleanup app rows first (safe with service role)
    await supa.from("project_members").delete().eq("org_id", org_id).eq("user_id", user_id);
    await supa.from("time_entries").delete().eq("org_id", org_id).eq("user_id", user_id); // optional; ok if none
    await supa.from("profiles").delete().eq("org_id", org_id).eq("id", user_id);

    // Delete auth user (cancels invite)
    const { error } = await supa.auth.admin.deleteUser(user_id);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Server error" }, { status: 500 });
  }
}
