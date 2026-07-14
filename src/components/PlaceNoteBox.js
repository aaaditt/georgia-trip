"use client";

import { useState } from "react";
import { useUser } from "@/context/UserContext";
import { upsertPlaceNote } from "@/lib/notes";

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

export default function PlaceNoteBox({ note, experienceId }) {
  const { currentUser } = useUser();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(note?.text || "");
  const [saving, setSaving] = useState(false);

  const startEditing = () => {
    setText(note?.text || "");
    setEditing(true);
  };

  const save = async () => {
    if (!currentUser) return;
    setSaving(true);
    await upsertPlaceNote(currentUser.id, experienceId, text.trim());
    setSaving(false);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="note-box note-box-editing">
        <textarea
          className="note-textarea"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="A practical tip for the family — bring cash, no beef option, meet at the lobby…"
          maxLength={500}
          autoFocus
        />
        <div className="note-box-actions">
          <button className="note-save-btn" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            className="note-cancel-btn"
            onClick={() => setEditing(false)}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (!note?.text) {
    return (
      <button
        type="button"
        className="note-box note-box-empty"
        onClick={startEditing}
      >
        📝 No notes yet — add a tip for the family
      </button>
    );
  }

  return (
    <div className="note-box">
      <div className="note-box-header">
        <span className="note-box-label">📝 Notes</span>
        <button type="button" className="note-edit-btn" onClick={startEditing}>
          ✏️ Edit
        </button>
      </div>
      <p className="note-text">{note.text}</p>
      <span className="note-meta">
        — {note.users?.emoji} {note.users?.name}, {relativeTime(note.updated_at)}
      </span>
    </div>
  );
}
