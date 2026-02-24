"use client";

export default function AdminTabs({
  active,
}: {
  active: "users" | "invite" | "invitations";
}) {
  const linkStyle = (isActive: boolean) => ({
    textDecoration: "none",
    opacity: isActive ? 1 : 0.85,
    borderColor: isActive ? "rgba(255,255,255,0.18)" : undefined,
  });

  return (
    <div className="card cardPad" style={{ maxWidth: 980, marginBottom: 12 }}>
      <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
        <a className="pill" href="/admin/users" style={linkStyle(active === "users")}>
          Users
        </a>
        <a className="pill" href="/admin/invitations" style={linkStyle(active === "invitations")}>
          Invitations
        </a>
        <a className="pill" href="/admin" style={linkStyle(active === "invite")}>
          Invite
        </a>
      </div>

      <div className="muted" style={{ marginTop: 8 }}>
        Users = directory. Invitations = pending invites. Invite = add a new teammate.
      </div>
    </div>
  );
}
