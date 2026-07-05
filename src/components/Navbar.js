"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUser } from "@/context/UserContext";

export default function Navbar() {
  const { currentUser, logout } = useUser();
  const pathname = usePathname();

  if (!currentUser) return null;

  const links = [
    { href: "/dashboard", label: "Regions", icon: "🗺️" },
    { href: "/consensus", label: "Consensus", icon: "📊" },
    { href: "/plan", label: "Day Plan", icon: "📋" },
  ];

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <Link href="/dashboard" className="navbar-brand">
          <span className="brand-flag">🇬🇪</span>
          Georgia 2026
        </Link>

        <div className="navbar-links">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={pathname === link.href || pathname.startsWith(link.href + "/") ? "active" : ""}
            >
              {link.icon} {link.label}
            </Link>
          ))}
        </div>

        <div className="navbar-user">
          <span className="user-emoji">{currentUser.emoji}</span>
          <span>{currentUser.name}</span>
          <button
            onClick={logout}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: "0.75rem",
              color: "var(--charcoal-light)",
              padding: "2px 6px",
              borderRadius: "var(--radius-full)",
            }}
            title="Switch user"
          >
            ↩
          </button>
        </div>
      </div>
    </nav>
  );
}
