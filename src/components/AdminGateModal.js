"use client";

import { useState } from "react";
import { useAdmin } from "@/context/AdminContext";

export default function AdminGateModal({ onClose, onUnlocked }) {
  const { unlock } = useAdmin();
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    const { error: unlockError } = unlock(passcode);
    if (unlockError) {
      setError(unlockError);
      setPasscode("");
      return;
    }
    setError(null);
    onUnlocked?.();
  };

  return (
    <div className="admin-gate-backdrop" onClick={onClose}>
      <div className="admin-gate-card" onClick={(e) => e.stopPropagation()}>
        <span style={{ fontSize: "2rem", display: "block", marginBottom: "var(--space-sm)" }}>
          🔒
        </span>
        <h3 style={{ marginBottom: "var(--space-md)" }}>Admin Access</h3>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
          <input
            type="password"
            inputMode="numeric"
            className="comment-input"
            placeholder="Enter passcode"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            autoFocus
            style={{ textAlign: "center", width: "100%" }}
          />
          {error && (
            <p style={{ fontSize: "0.8rem", color: "var(--skip)" }}>{error}</p>
          )}
          <div style={{ display: "flex", gap: "var(--space-sm)" }}>
            <button type="submit" className="comment-submit" style={{ flex: 1 }}>
              Unlock
            </button>
            <button
              type="button"
              className="comment-submit add-place-cancel"
              style={{ flex: 1 }}
              onClick={onClose}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
