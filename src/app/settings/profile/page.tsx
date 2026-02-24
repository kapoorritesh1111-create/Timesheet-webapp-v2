// src/app/settings/profile/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import RequireOnboarding from "../../../components/auth/RequireOnboarding";
import AppShell from "../../../components/layout/AppShell";
import { useProfile } from "../../../lib/useProfile";
import { supabase } from "../../../lib/supabaseBrowser";

// Icons (install if needed: npm i lucide-react)
import {
  User,
  Activity,
  Bell,
  Globe,
  KeyRound,
  History,
  Mail,
  Phone as PhoneIcon,
  MapPin,
  Upload,
  X,
} from "lucide-react";

type Section =
  | "personal"
  | "status"
  | "notifications"
  | "language"
  | "password"
  | "sessions";

function initialsFromName(name?: string) {
  const n = (name || "").trim();
  if (!n) return "U";
  const parts = n.split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] || "U";
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] : "";
  return (first + last).toUpperCase();
}

async function uploadAvatar(file: File, userId: string) {
  const ext = (file.name.split(".").pop() || "png").toLowerCase();
  const path = `${userId}/${Date.now()}.${ext}`;

  const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, {
    cacheControl: "3600",
    upsert: true,
  });
  if (upErr) throw upErr;

  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  return data.publicUrl;
}

export default function MyProfilePage() {
  const { profile, refresh, loading, error } = useProfile() as any;

  const userId = profile?.id as string | undefined;

  const [section, setSection] = useState<Section>("personal");

  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");

  // Upload state
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string>("");
  const [uploading, setUploading] = useState(false);

  const [saving, setSaving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const fullName = profile?.full_name || "User";
  const role = profile?.role || "user";
  const email = profile?.email || profile?.user_email || ""; // depends on how you're storing it

  const initials = useMemo(() => initialsFromName(fullName), [fullName]);

  useEffect(() => {
    setPhone(profile?.phone || "");
    setAddress(profile?.address || "");
    setAvatarUrl(profile?.avatar_url || "");
    // clear local upload draft when profile changes
    setAvatarFile(null);
    setAvatarPreview("");
  }, [profile?.id]);

  // Cleanup object URL
  useEffect(() => {
    return () => {
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onPickAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] || null;
    setAvatarFile(f);
    if (!f) {
      setAvatarPreview("");
      return;
    }
    try {
      const url = URL.createObjectURL(f);
      setAvatarPreview(url);
    } catch {
      setAvatarPreview("");
    }
  }

  async function onUploadAvatar() {
    if (!avatarFile || !userId) return;

    setUploading(true);
    try {
      const url = await uploadAvatar(avatarFile, userId);
      setAvatarUrl(url);
      setAvatarFile(null);

      // clear preview + input
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
      setAvatarPreview("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (e: any) {
      alert(e?.message || "Upload failed. Check Storage bucket + policies.");
    } finally {
      setUploading(false);
    }
  }

  function cancelAvatarDraft() {
    setAvatarFile(null);
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    setAvatarPreview("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function save() {
    if (!userId) return;
    setSaving(true);

    const { error: upErr } = await supabase
      .from("profiles")
      .update({
        phone: phone || null,
        address: address || null,
        avatar_url: avatarUrl || null,
      })
      .eq("id", userId);

    setSaving(false);

    if (upErr) {
      alert(upErr.message);
      return;
    }

    await refresh?.();
    alert("Saved.");
  }

  const leftItems: Array<{
    id: Section;
    label: string;
    icon: any;
    enabled: boolean;
  }> = [
    { id: "personal", label: "Personal info", icon: User, enabled: true },
    { id: "status", label: "Working status", icon: Activity, enabled: false },
    { id: "notifications", label: "Notifications", icon: Bell, enabled: false },
    { id: "language", label: "Language & region", icon: Globe, enabled: false },
    { id: "password", label: "Password", icon: KeyRound, enabled: false },
    { id: "sessions", label: "Session history", icon: History, enabled: false },
  ];

  return (
    <RequireOnboarding>
      <AppShell title="My profile" subtitle="Update your personal details">
        <div className="card" style={{ maxWidth: 1100, overflow: "hidden" }}>
          {loading ? <div className="alert alertInfo">Loading…</div> : null}
          {error ? (
            <div className="alert" style={{ borderColor: "rgba(220,38,38,0.35)" }}>
              {String(error)}
            </div>
          ) : null}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "240px 1fr",
              minHeight: 520,
            }}
          >
            {/* Left menu */}
            <div
              style={{
                borderRight: "1px solid var(--border)",
                background: "rgba(255,255,255,0.65)",
                padding: 12,
              }}
            >
              <div className="muted" style={{ fontSize: 11, fontWeight: 950, letterSpacing: "0.08em" }}>
                PROFILE
              </div>

              <div style={{ marginTop: 10, display: "grid", gap: 6 }}>
                {leftItems.map((it) => {
                  const Icon = it.icon;
                  const active = section === it.id;
                  return (
                    <button
                      key={it.id}
                      type="button"
                      onClick={() => it.enabled && setSection(it.id)}
                      className={active ? "mwSideItem mwSideItemActive" : "mwSideItem"}
                      style={{
                        display: "flex",
                        gap: 10,
                        alignItems: "center",
                        justifyContent: "flex-start",
                        opacity: it.enabled ? 1 : 0.55,
                        cursor: it.enabled ? "pointer" : "not-allowed",
                      }}
                      disabled={!it.enabled}
                      title={!it.enabled ? "Coming soon" : undefined}
                    >
                      <Icon size={16} />
                      <span>{it.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right panel */}
            <div style={{ padding: 16 }}>
              {/* Header card */}
              <div className="card cardPad">
                <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
                  <div
                    className="mwAvatar"
                    style={{
                      width: 84,
                      height: 84,
                      overflow: "hidden",
                      background: "var(--primary-soft)",
                      borderColor: "rgba(37,99,235,0.22)",
                    }}
                  >
                    {avatarPreview || avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={avatarPreview || avatarUrl}
                        alt="avatar"
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    ) : (
                      <span style={{ fontSize: 26, fontWeight: 950 }}>{initials}</span>
                    )}
                  </div>

                  <div style={{ flex: "1 1 360px" }}>
                    <div style={{ fontSize: 28, fontWeight: 950, letterSpacing: "-0.02em" }}>{fullName}</div>
                    <div style={{ marginTop: 6, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <span
                        className={
                          role === "admin"
                            ? "badge badgeAdmin"
                            : role === "manager"
                              ? "badge badgeManager"
                              : "badge badgeContractor"
                        }
                      >
                        {String(role)}
                      </span>
                      <span className="muted" style={{ fontSize: 12 }}>
                        You can update your phone, address, and photo.
                      </span>
                    </div>

                    {/* Upload controls */}
                    <div style={{ marginTop: 12, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                      <input ref={fileInputRef} type="file" accept="image/*" onChange={onPickAvatar} />
                      <button onClick={onUploadAvatar} disabled={!avatarFile || uploading}>
                        <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
                          <Upload size={16} />
                          {uploading ? "Uploading..." : "Upload photo"}
                        </span>
                      </button>
                      {avatarPreview ? (
                        <button onClick={cancelAvatarDraft} disabled={uploading}>
                          <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
                            <X size={16} />
                            Cancel
                          </span>
                        </button>
                      ) : null}
                      <span className="muted" style={{ fontSize: 12 }}>
                        JPG/PNG recommended. Square looks best.
                      </span>
                    </div>
                  </div>

                  {/* Contact summary (right) */}
                  <div style={{ flex: "0 0 280px", display: "grid", gap: 10 }}>
                    <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                      <Mail size={16} style={{ marginTop: 2 }} />
                      <div>
                        <div style={{ fontWeight: 900, fontSize: 12 }}>Email</div>
                        <div className="muted" style={{ fontSize: 12 }}>
                          {email || "—"}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                      <PhoneIcon size={16} style={{ marginTop: 2 }} />
                      <div>
                        <div style={{ fontWeight: 900, fontSize: 12 }}>Phone</div>
                        <div className="muted" style={{ fontSize: 12 }}>
                          {phone || "Add a phone"}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                      <MapPin size={16} style={{ marginTop: 2 }} />
                      <div>
                        <div style={{ fontWeight: 900, fontSize: 12 }}>Location</div>
                        <div className="muted" style={{ fontSize: 12 }}>
                          {address ? "Saved" : "Add a location"}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Personal Info section */}
              {section === "personal" ? (
                <div style={{ marginTop: 14 }} className="grid2">
                  <div className="card cardPad">
                    <div className="muted" style={{ fontSize: 11, fontWeight: 950, letterSpacing: "0.08em" }}>
                      CONTACT
                    </div>

                    <div style={{ marginTop: 12 }}>
                      <div className="muted" style={{ fontSize: 12, fontWeight: 900, marginBottom: 6 }}>
                        Phone
                      </div>
                      <input
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="(555) 555-5555"
                      />
                    </div>

                    <div style={{ marginTop: 12 }}>
                      <div className="muted" style={{ fontSize: 12, fontWeight: 900, marginBottom: 6 }}>
                        Address / Location
                      </div>
                      <textarea
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        rows={5}
                        placeholder="Street, City, State, Zip"
                      />
                    </div>

                    <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <button className="btn btnPrimary" onClick={save} disabled={saving || loading}>
                        {saving ? "Saving…" : "Save changes"}
                      </button>
                      <span className="muted" style={{ fontSize: 12, alignSelf: "center" }}>
                        Saves to your profile and will reflect across the app.
                      </span>
                    </div>
                  </div>

                  <div className="card cardPad">
                    <div className="muted" style={{ fontSize: 11, fontWeight: 950, letterSpacing: "0.08em" }}>
                      ABOUT
                    </div>

                    <div style={{ marginTop: 12 }} className="muted">
                      <div style={{ fontWeight: 950, color: "var(--text)" }}>Coming next</div>
                      <div style={{ marginTop: 8, fontSize: 13, lineHeight: 1.5 }}>
                        We’ll expand this page to match the Monday-style profile experience:
                        <ul style={{ marginTop: 8 }}>
                          <li>Working status</li>
                          <li>Notifications</li>
                          <li>Language & region</li>
                          <li>Password + session history</li>
                        </ul>
                      </div>

                      <div className="alert alertInfo" style={{ marginTop: 12 }}>
                        If avatar upload fails: confirm Storage bucket <b>avatars</b> exists and policies allow uploads
                        to <code>{`avatars/${userId || "userId"}/...`}</code>.
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ marginTop: 14 }} className="card cardPad">
                  <div className="muted">
                    This section is coming soon. We’ll keep the layout consistent with your Monday-like shell.
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </AppShell>
    </RequireOnboarding>
  );
}
