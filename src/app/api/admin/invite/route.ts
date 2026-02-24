import { NextRequest, NextResponse } from "next/server";
import { supabaseService } from "../../../../lib/supabaseServer";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      email,
      full_name,
      hourly_rate,
      role,
      manager_id,
      project_ids = [],
    } = body;

    if (!email || !role) {
      return NextResponse.json({ ok: false, error: "Missing required fields" }, { status: 400 });
    }

    const supabase = supabaseService();

    // 1️⃣ Create auth user
    const { data: userData, error: userErr } =
      await supabase.auth.admin.createUser({
        email,
        email_confirm: false,
      });

    if (userErr || !userData.user) {
      return NextResponse.json({ ok: false, error: userErr?.message }, { status: 400 });
    }

    const userId = userData.user.id;

    // 2️⃣ Insert profile (BYPASSES RLS because service role)
    const { error: profileErr } = await supabase
      .from("profiles")
      .insert({
        id: userId,
        full_name,
        role,
        hourly_rate: hourly_rate ?? 0,
        manager_id: role === "contractor" ? manager_id : null,
        is_active: true,
      });

    if (profileErr) {
      return NextResponse.json({ ok: false, error: profileErr.message }, { status: 400 });
    }

    // 3️⃣ Assign projects
    if (project_ids.length > 0) {
      const rows = project_ids.map((project_id: string) => ({
        user_id: userId,
        project_id,
      }));

      const { error: projErr } = await supabase
        .from("project_members")
        .insert(rows);

      if (projErr) {
        return NextResponse.json({ ok: false, error: projErr.message }, { status: 400 });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
