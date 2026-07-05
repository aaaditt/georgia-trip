"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/context/UserContext";
import { USERS, TRIP_INFO } from "@/lib/data";

export default function LoginPage() {
  const { currentUser, login, isLoaded } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (isLoaded && currentUser) {
      router.push("/dashboard");
    }
  }, [isLoaded, currentUser, router]);

  if (!isLoaded) {
    return (
      <div className="loading-spinner">
        <div className="spinner" />
      </div>
    );
  }

  if (currentUser) return null;

  return (
    <div className="login-page">
      <div className="login-card">
        <span className="flag" style={{ fontSize: "3.5rem", display: "block", marginBottom: "var(--space-sm)" }}>🇬🇪</span>
        <h1 style={{
          background: "linear-gradient(135deg, var(--wine), var(--terra))",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
          marginBottom: "var(--space-xs)",
          fontFamily: "var(--font-heading)",
          fontSize: "2rem",
          fontWeight: 700,
        }}>
          {TRIP_INFO.title}
        </h1>

        <div className="trip-dates">{TRIP_INFO.dates}</div>

        <p style={{ color: "var(--charcoal-mid)", marginBottom: "var(--space-xs)", fontSize: "0.9rem" }}>
          {TRIP_INFO.group}
        </p>
        <p style={{ color: "var(--charcoal-light)", marginBottom: "var(--space-xl)", fontSize: "0.82rem" }}>
          {TRIP_INFO.style}
        </p>

        <h2>Who are you?</h2>

        <div className="user-grid">
          {USERS.map((user) => (
            <button
              key={user.id}
              className="user-pick-btn"
              onClick={() => login(user)}
            >
              <span className="pick-emoji">{user.emoji}</span>
              <span className="pick-name">{user.name}</span>
              {!user.is_adult && (
                <span style={{ fontSize: "0.65rem", color: "var(--terra)" }}>
                  (kid)
                </span>
              )}
            </button>
          ))}
        </div>

        <p style={{ fontSize: "0.75rem", color: "var(--charcoal-light)", fontStyle: "italic" }}>
          Pick your name to start voting & commenting
        </p>
      </div>
    </div>
  );
}
