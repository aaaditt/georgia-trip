"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/context/UserContext";
import { useTripNote, upsertTripNote } from "@/lib/notes";
import Navbar from "@/components/Navbar";

function relativeTime(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMin = Math.floor((now - date) / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

export default function NotesPage() {
  const { currentUser, isLoaded } = useUser();
  const router = useRouter();
  const { note, loading } = useTripNote();
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (isLoaded && !currentUser) router.push("/");
  }, [isLoaded, currentUser, router]);

  // Only reflect remote changes while the user isn't mid-edit, so an
  // incoming realtime update never clobbers what they're typing — derived
  // at render time rather than synced via an effect.
  const displayText = dirty ? text : note?.text || "";

  const save = async () => {
    if (!currentUser) return;
    setSaving(true);
    await upsertTripNote(currentUser.id, displayText.trim());
    setSaving(false);
    setDirty(false);
  };

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
          <h1>📝 Trip Notes</h1>
          <p className="page-subtitle">
            A shared scratchpad for anything that doesn&apos;t belong to one
            place — packing list, flight details, reminders, whatever the
            family needs to remember.
          </p>
        </div>

        <div className="trip-notes-card">
          <textarea
            className="trip-notes-textarea"
            value={displayText}
            onChange={(e) => {
              setText(e.target.value);
              setDirty(true);
            }}
            onBlur={save}
            placeholder="Start typing…"
            disabled={loading}
          />
          <div className="trip-notes-footer">
            {saving
              ? "Saving…"
              : note?.updated_at
              ? `Last edited by ${note.users?.emoji || ""} ${note.users?.name || "someone"}, ${relativeTime(note.updated_at)}`
              : "Nobody has written anything yet."}
          </div>
        </div>
      </main>
    </>
  );
}
