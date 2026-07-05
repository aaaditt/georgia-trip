"use client";

export default function UserAvatar({ user, size = 40, onClick, selected }) {
  return (
    <div
      className={`user-avatar ${selected ? "selected" : ""}`}
      style={{ width: size, height: size, fontSize: size * 0.55 }}
      onClick={onClick}
      title={user.name}
    >
      {user.emoji}
    </div>
  );
}
