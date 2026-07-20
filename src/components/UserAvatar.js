"use client";

/**
 * Circular emoji avatar for a trip member.
 * @param {{ user: { name: string, emoji: string }, size?: number, onClick?: () => void, selected?: boolean }} props
 */
export default function UserAvatar({ user, size = 40, onClick, selected }) {
  return (
    <div
      className={`user-avatar ${selected ? "selected" : ""}`}
      style={{ width: size, height: size, fontSize: size * 0.55 }}
      onClick={onClick}
      title={user.name}
      aria-label={user.name}
    >
      {user.emoji}
    </div>
  );
}
