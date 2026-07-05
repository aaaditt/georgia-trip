"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/context/UserContext";
import { LOCKED_PLAN } from "@/lib/data";
import Navbar from "@/components/Navbar";
import Link from "next/link";

export default function PlanPage() {
  const { currentUser, isLoaded } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (isLoaded && !currentUser) {
      router.push("/");
    }
  }, [isLoaded, currentUser, router]);

  if (!isLoaded || !currentUser) {
    return (
      <div className="loading-spinner">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <>
      <Navbar />
      <main className="page-container">
        <div className="page-header">
          <span className="flag">📋</span>
          <h1>{LOCKED_PLAN.title}</h1>
          <p className="subtitle">{LOCKED_PLAN.subtitle}</p>
        </div>

        <div
          className="group-pick animate-in"
          style={{ marginBottom: "var(--space-xl)", textAlign: "center" }}
        >
          <div className="gp-label" style={{ justifyContent: "center" }}>
            🔒 Read-only
          </div>
          <p>{LOCKED_PLAN.note}</p>
        </div>

        <div className="animate-in animate-in-delay-1">
          {LOCKED_PLAN.days.map((day, i) => (
            <div
              key={i}
              className="plan-day"
              style={{
                animationDelay: `${i * 0.05}s`,
              }}
            >
              <div className="plan-day-label">{day.day}</div>
              <h3 className="plan-day-title">{day.title}</h3>
              <ul className="plan-items">
                {day.items.map((item, j) => (
                  <li key={j} className="plan-item">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div
          style={{
            textAlign: "center",
            marginTop: "var(--space-2xl)",
            padding: "var(--space-lg)",
          }}
        >
          <p style={{ color: "var(--charcoal-light)", marginBottom: "var(--space-md)" }}>
            Days 8–10 depend on the group vote!
          </p>
          <Link href="/consensus" className="quick-link" style={{ display: "inline-flex" }}>
            📊 See what everyone wants
          </Link>
        </div>
      </main>
    </>
  );
}
