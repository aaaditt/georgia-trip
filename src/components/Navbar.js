"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useUser } from "@/context/UserContext";
import { useAdmin } from "@/context/AdminContext";
import AdminGateModal from "./AdminGateModal";

const TAP_COUNT_TO_UNLOCK = 5;
const TAP_WINDOW_MS = 2000;

export default function Navbar() {
  const { currentUser, logout } = useUser();
  const { isAdmin } = useAdmin();
  const pathname = usePathname();
  const router = useRouter();
  const [gateOpen, setGateOpen] = useState(false);
  const tapCountRef = useRef(0);
  const tapTimerRef = useRef(null);

  if (!currentUser) return null;

  const links = [
    { href: "/dashboard", label: "Regions", icon: "🗺️" },
    { href: "/consensus", label: "Consensus", icon: "📊" },
    { href: "/mockplan", label: "Proposal", icon: "🧭" },
    { href: "/plan", label: "Day Plan", icon: "📋" },
    { href: "/calendar", label: "Calendar", icon: "🗓️" },
    { href: "/notes", label: "Notes", icon: "📝" },
    ...(isAdmin ? [{ href: "/admin", label: "Admin", icon: "🔒" }] : []),
  ];

  const handleBrandClick = (e) => {
    tapCountRef.current += 1;
    clearTimeout(tapTimerRef.current);

    if (tapCountRef.current >= TAP_COUNT_TO_UNLOCK) {
      e.preventDefault();
      tapCountRef.current = 0;
      setGateOpen(true);
      return;
    }

    tapTimerRef.current = setTimeout(() => {
      tapCountRef.current = 0;
    }, TAP_WINDOW_MS);
  };

  return (
    <nav className="navbar" aria-label="Main navigation">
      <div className="navbar-inner">
        <Link href="/dashboard" className="navbar-brand" onClick={handleBrandClick}>
          <span className="brand-flag">🇬🇪</span>
          Georgia 2026
        </Link>

        {gateOpen && (
          <AdminGateModal
            onClose={() => setGateOpen(false)}
            onUnlocked={() => {
              setGateOpen(false);
              router.push("/admin");
            }}
          />
        )}

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
