"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";

// Lucide paths, 24px viewBox rendered at 18px, stroke 1.75.
const ICONS = {
  students: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  enroll: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <line x1="19" x2="19" y1="8" y2="14" />
      <line x1="22" x2="16" y1="11" y2="11" />
    </>
  ),
  programs: (
    <>
      <path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z" />
      <path d="M22 10v6" />
      <path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5" />
    </>
  ),
  menu: (
    <>
      <line x1="3" x2="21" y1="6" y2="6" />
      <line x1="3" x2="21" y1="12" y2="12" />
      <line x1="3" x2="21" y1="18" y2="18" />
    </>
  ),
  logout: (
    <>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" x2="9" y1="12" y2="12" />
    </>
  ),
};

export function Icon({ name }: { name: keyof typeof ICONS | "plus" | "external" }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {name === "plus" ? (
        <>
          <path d="M5 12h14" />
          <path d="M12 5v14" />
        </>
      ) : name === "external" ? (
        <>
          <path d="M15 3h6v6" />
          <path d="M10 14 21 3" />
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
        </>
      ) : (
        ICONS[name]
      )}
    </svg>
  );
}

const NAV = [
  { href: "/", label: "Students", icon: "students" },
  { href: "/enroll", label: "Enroll", icon: "enroll" },
  { href: "/programs", label: "Programs", icon: "programs" },
] as const;

export function Shell({ title, username, children }: { title: string; username: string; children: ReactNode }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  async function signOut() {
    await fetch("/api/logout", { method: "POST" });
    window.location.assign("/login");
  }

  return (
    <div className="frame">
      {menuOpen && <div className="backdrop" onClick={() => setMenuOpen(false)} />}
      <aside className={`sidebar${menuOpen ? " open" : ""}`}>
        <div className="logo">
          <span className="logo-mark" />
          <div>
            <div className="logo-name">CampusPass</div>
            <div className="logo-sub">Student affairs</div>
          </div>
        </div>
        <nav className="nav">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-item${pathname === item.href ? " active" : ""}`}
              onClick={() => setMenuOpen(false)}
            >
              <Icon name={item.icon} />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="sidebar-user">
          <span className="avatar">{(username[0] ?? "?").toUpperCase()}</span>
          <div>
            <div className="sidebar-user-name">{username || "Registrar"}</div>
            <div className="logo-sub">Registrar</div>
          </div>
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <div className="topbar-left">
            <button
              type="button"
              className="menu-toggle"
              aria-label="Toggle navigation"
              onClick={() => setMenuOpen((open) => !open)}
            >
              <Icon name="menu" />
            </button>
            <h1 className="page-title">{title}</h1>
          </div>
          <div className="topbar-right">
            {username && <span className="topbar-user">{username}</span>}
            <button type="button" className="btn btn-outline btn-sm" onClick={signOut}>
              <Icon name="logout" />
              Sign out
            </button>
          </div>
        </header>
        <div className="content">{children}</div>
      </div>
    </div>
  );
}
