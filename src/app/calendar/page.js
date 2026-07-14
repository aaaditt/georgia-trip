"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/context/UserContext";
import { REGIONS } from "@/lib/data";
import {
  useExperiences,
  useRatings,
  useVotes,
  getAverageRating,
  getVoteCounts,
} from "@/lib/hooks";
import {
  useItinerary,
  TRIP_DAYS,
  TRANSPORT_MODES,
  SLOT_MIN,
  formatDay,
  formatTime,
  parseDefaultDuration,
} from "@/lib/itinerary";
import { useCalendarAccess, hasCompletedVoting } from "@/lib/access";
import Navbar from "@/components/Navbar";
import RouteStrip from "@/components/RouteStrip";
import Link from "next/link";

// Grid geometry (keep in sync with the .cal-* styles in globals.css)
const SLOT_PX = 22; // one 30-min slot
const HEADER_H = 48; // sticky day header height
const COL_W = 160; // fixed day column width
const REGION_COLORS = {
  tbilisi: "#4A7C8F",
  mtskheta: "#C4704B",
  kakheti: "#8B2252",
  "gudauri-kazbegi": "#3A6170",
  borjomi: "#6B8E23",
  "kutaisi-imereti": "#3B82F6",
  uplistsikhe: "#8B7355",
  svaneti: "#6C63FF",
};
const TRANSPORT_COLOR = "#4A4A4A";
const CUSTOM_COLOR = "#A87E2F";

const snapSlot = (min) => Math.round(min / SLOT_MIN) * SLOT_MIN;
const clamp = (n, lo, hi) => Math.min(Math.max(n, lo), hi);

function itemColor(item) {
  if (item.kind === "transport") return TRANSPORT_COLOR;
  if (item.kind === "custom") return CUSTOM_COLOR;
  return REGION_COLORS[item.regionId] || "#8B7355";
}

// Pack overlapping blocks of one day into side-by-side lanes
function layoutDay(dayItems) {
  const sorted = [...dayItems].sort(
    (a, b) => a.startMin - b.startMin || b.durationMin - a.durationMin
  );
  const result = {};
  let cluster = [];
  let laneEnds = [];
  let clusterEnd = -1;
  const flush = () => {
    for (const c of cluster) result[c.id] = { lane: c.lane, lanes: laneEnds.length };
    cluster = [];
    laneEnds = [];
  };
  for (const it of sorted) {
    if (cluster.length && it.startMin >= clusterEnd) flush();
    let lane = laneEnds.findIndex((end) => end <= it.startMin);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(0);
    }
    laneEnds[lane] = it.startMin + it.durationMin;
    cluster.push({ id: it.id, lane });
    clusterEnd = Math.max(clusterEnd, it.startMin + it.durationMin);
  }
  flush();
  return result;
}

// Which block ids does a selection rectangle (in the same content-relative
// px space as `resolveDrop`/`paintPreview` below — i.e. relative to
// daysRef's own top-left, not the viewport) overlap?
function blocksInRect(blocks, rect) {
  return blocks
    .filter((b) => {
      const dayIdx = TRIP_DAYS.indexOf(b.day);
      if (dayIdx === -1) return false;
      const left = dayIdx * COL_W;
      const right = left + COL_W;
      const top = HEADER_H + (b.startMin / SLOT_MIN) * SLOT_PX;
      const bottom = top + (b.durationMin / SLOT_MIN) * SLOT_PX;
      return left < rect.right && right > rect.left && top < rect.bottom && bottom > rect.top;
    })
    .map((b) => b.id);
}

const DURATION_OPTIONS = Array.from({ length: 16 }, (_, i) => (i + 1) * 30);
const START_OPTIONS = Array.from({ length: 48 }, (_, i) => i * 30);

function durationLabel(min) {
  if (min < 60) return `${min} min`;
  const h = min / 60;
  return `${h % 1 === 0 ? h : h.toFixed(1)} hr`;
}

function AddEventModal({ onClose, onAdd }) {
  const [name, setName] = useState("");
  const [day, setDay] = useState(TRIP_DAYS[0]);
  const [startMin, setStartMin] = useState(600);
  const [durationMin, setDurationMin] = useState(60);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    await onAdd({ title: name.trim(), day, startMin, durationMin });
    onClose();
  };

  return (
    <div className="admin-gate-backdrop" onClick={onClose}>
      <div
        className="admin-gate-card cal-modal-card"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ marginBottom: "var(--space-xs)" }}>📌 Add checkpoint / event</h3>
        <p style={{ fontSize: "0.8rem", color: "var(--charcoal-light)", marginBottom: "var(--space-md)" }}>
          Anything that isn&apos;t a place — hotel check-in, flight, lunch stop,
          &quot;meet at the car&quot;… It lands on the calendar and you can drag it
          around like everything else.
        </p>
        <form onSubmit={submit} className="cal-modal-form">
          <input
            type="text"
            className="comment-input"
            placeholder="Event name (required)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            autoFocus
            required
          />
          <div className="cal-modal-row">
            <label>
              Day
              <select className="comment-input" value={day} onChange={(e) => setDay(e.target.value)}>
                {TRIP_DAYS.map((d) => {
                  const f = formatDay(d);
                  return (
                    <option key={d} value={d}>
                      {f.weekday} {f.date} {f.month}
                    </option>
                  );
                })}
              </select>
            </label>
            <label>
              Starts
              <select
                className="comment-input"
                value={startMin}
                onChange={(e) => setStartMin(Number(e.target.value))}
              >
                {START_OPTIONS.map((m) => (
                  <option key={m} value={m}>{formatTime(m)}</option>
                ))}
              </select>
            </label>
            <label>
              Length
              <select
                className="comment-input"
                value={durationMin}
                onChange={(e) => setDurationMin(Number(e.target.value))}
              >
                {DURATION_OPTIONS.map((m) => (
                  <option key={m} value={m}>{durationLabel(m)}</option>
                ))}
              </select>
            </label>
          </div>
          <div style={{ display: "flex", gap: "var(--space-sm)" }}>
            <button type="submit" className="comment-submit" disabled={!name.trim() || submitting}>
              {submitting ? "Adding…" : "Add to calendar"}
            </button>
            <button type="button" className="comment-submit add-place-cancel" onClick={onClose}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function CalendarPage() {
  const { currentUser, isLoaded } = useUser();
  const router = useRouter();
  const { experiences, loading: expLoading } = useExperiences();
  const { ratings } = useRatings();
  const { votes, loading: votesLoading } = useVotes();
  const { grantedIds, loading: accessLoading } = useCalendarAccess();
  const { items, loading, fetchError, addItem, updateItem, removeItem } =
    useItinerary();

  const [activeTab, setActiveTab] = useState(REGIONS[0].id);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showAddEvent, setShowAddEvent] = useState(false);
  // The calendar always opens locked (view-only) so nobody reorganises
  // the family's plan by accident — editing is an explicit unlock away.
  const [unlocked, setUnlocked] = useState(false);

  const scrollerRef = useRef(null);
  const daysRef = useRef(null);
  const ghostRef = useRef(null);
  const previewRef = useRef(null);
  const selectBoxRef = useRef(null);
  const dragRef = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    if (isLoaded && !currentUser) router.push("/");
  }, [isLoaded, currentUser, router]);

  // Open the grid at 8am rather than midnight
  useEffect(() => {
    if (scrollerRef.current) scrollerRef.current.scrollTop = 8 * 2 * SLOT_PX - 8;
  }, [loading]);

  const expById = useMemo(() => {
    const map = new Map();
    for (const e of experiences) map.set(e.id, e);
    return map;
  }, [experiences]);

  // Every block enriched with what the grid needs to draw it
  const blocks = useMemo(() => {
    return items
      .filter((it) => TRIP_DAYS.includes(it.day))
      .map((it) => {
        if (it.kind === "place") {
          const exp = expById.get(it.experienceId);
          return {
            ...it,
            name: exp ? exp.name : "(removed place)",
            regionId: exp?.regionId,
            emoji: "📍",
          };
        }
        if (it.kind === "transport") {
          const mode = TRANSPORT_MODES.find((m) => m.id === it.transportMode);
          return {
            ...it,
            name: it.title || mode?.label || "Transport",
            emoji: mode?.emoji || "🚗",
          };
        }
        return { ...it, name: it.title || "Event", emoji: "📌" };
      });
  }, [items, expById]);

  const layoutByDay = useMemo(() => {
    const map = {};
    for (const day of TRIP_DAYS) {
      map[day] = layoutDay(blocks.filter((b) => b.day === day));
    }
    return map;
  }, [blocks]);

  const scheduledIds = useMemo(
    () => new Set(items.filter((i) => i.kind === "place").map((i) => i.experienceId)),
    [items]
  );

  const paletteChips = useMemo(() => {
    if (activeTab === "transport") {
      return TRANSPORT_MODES.map((m) => ({
        key: m.id,
        label: m.label,
        emoji: m.emoji,
        color: TRANSPORT_COLOR,
        payload: {
          kind: "transport",
          transportMode: m.id,
          name: m.label,
          durationMin: 60,
          color: TRANSPORT_COLOR,
        },
      }));
    }
    const regionPlaces = experiences.filter((e) => e.regionId === activeTab);
    return regionPlaces
      .map((e) => {
        const avg = getAverageRating(ratings, e.id);
        const counts = getVoteCounts(votes, e.id);
        // go = 2 pts, maybe = 1 pt, skip = 0 pts
        const voteScore = counts.go * 2 + counts.maybe;
        return {
          key: e.id,
          label: e.name,
          emoji: null,
          color: REGION_COLORS[activeTab] || "#8B7355",
          avg,
          voteScore,
          scheduled: scheduledIds.has(e.id),
          payload: {
            kind: "place",
            experienceId: e.id,
            name: e.name,
            durationMin: parseDefaultDuration(e.time),
            color: REGION_COLORS[activeTab] || "#8B7355",
          },
        };
      })
      .sort(
        (a, b) =>
          b.voteScore - a.voteScore || b.avg - a.avg || a.label.localeCompare(b.label)
      );
  }, [activeTab, experiences, ratings, votes, scheduledIds]);

  const selectedItem = blocks.find((b) => b.id === selectedId) || null;

  // Editing unlocks once you've voted on every place, or when the admin
  // granted an override from the admin panel. Everyone can always view.
  const gateLoading = expLoading || votesLoading || accessLoading;
  const votedCount = currentUser
    ? experiences.filter((e) =>
        votes.some((v) => v.user_id === currentUser.id && v.experience_id === e.id)
      ).length
    : 0;
  const canEdit =
    !gateLoading &&
    currentUser &&
    (hasCompletedVoting(votes, experiences, currentUser.id) ||
      grantedIds.has(currentUser.id));
  // Actually editable right now = allowed to edit AND deliberately unlocked
  const editing = canEdit && unlocked;

  // Bulk-delete every rubber-band-selected block with Delete/Backspace,
  // but never while the user is typing in an input/textarea, and never
  // outside edit mode.
  useEffect(() => {
    function handleKeyDown(e) {
      if (!editing || selectedIds.size === 0) return;
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      e.preventDefault();
      selectedIds.forEach((id) => removeItem(id));
      setSelectedIds(new Set());
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [editing, selectedIds, removeItem]);

  // ---- drag mechanics (direct DOM updates, React state only on drop) ----

  function resolveDrop(clientX, clientY, durationMin) {
    const rect = daysRef.current.getBoundingClientRect();
    if (
      clientX < rect.left ||
      clientX > rect.right ||
      clientY < rect.top + HEADER_H ||
      clientY > rect.bottom
    ) {
      return null;
    }
    const dayIdx = clamp(Math.floor((clientX - rect.left) / COL_W), 0, TRIP_DAYS.length - 1);
    const rawMin = ((clientY - rect.top - HEADER_H) / SLOT_PX) * SLOT_MIN;
    const startMin = clamp(snapSlot(rawMin), 0, 1440 - durationMin);
    return { dayIdx, startMin };
  }

  function paintPreview(drop, durationMin, color) {
    const el = previewRef.current;
    if (!el) return;
    if (!drop) {
      el.style.display = "none";
      return;
    }
    el.style.display = "block";
    el.style.left = `${drop.dayIdx * COL_W + 2}px`;
    el.style.top = `${HEADER_H + (drop.startMin / SLOT_MIN) * SLOT_PX}px`;
    el.style.width = `${COL_W - 5}px`;
    el.style.height = `${(durationMin / SLOT_MIN) * SLOT_PX - 2}px`;
    el.style.borderColor = color;
  }

  function updateDragVisuals() {
    const d = dragRef.current;
    if (!d || !d.active) return;

    if (d.type === "resize") {
      const rect = daysRef.current.getBoundingClientRect();
      const topMin = d.item.startMin;
      const rawEnd = ((d.y - rect.top - HEADER_H) / SLOT_PX) * SLOT_MIN;
      const duration = clamp(
        Math.round((rawEnd - topMin) / SLOT_MIN) * SLOT_MIN,
        SLOT_MIN,
        1440 - topMin
      );
      d.result = { durationMin: duration };
      paintPreview(
        { dayIdx: TRIP_DAYS.indexOf(d.item.day), startMin: topMin },
        duration,
        d.color
      );
      return;
    }

    if (d.type === "select") {
      const rect = daysRef.current.getBoundingClientRect();
      const x0 = clamp(d.startX - rect.left, 0, rect.width);
      const x1 = clamp(d.x - rect.left, 0, rect.width);
      const y0 = clamp(d.startY - rect.top, HEADER_H, rect.height);
      const y1 = clamp(d.y - rect.top, HEADER_H, rect.height);
      const box = {
        left: Math.min(x0, x1),
        right: Math.max(x0, x1),
        top: Math.min(y0, y1),
        bottom: Math.max(y0, y1),
      };
      if (selectBoxRef.current) {
        const el = selectBoxRef.current;
        el.style.display = "block";
        el.style.left = `${box.left}px`;
        el.style.top = `${box.top}px`;
        el.style.width = `${box.right - box.left}px`;
        el.style.height = `${box.bottom - box.top}px`;
      }
      d.result = blocksInRect(blocks, box);
      return;
    }

    if (ghostRef.current) {
      ghostRef.current.style.display = "block";
      ghostRef.current.style.transform = `translate(${d.x + 10}px, ${d.y + 12}px)`;
    }
    const duration = d.type === "move" ? d.item.durationMin : d.payload.durationMin;
    const pointerDrop = resolveDrop(d.x, d.y, duration);
    let drop = pointerDrop;
    if (drop && d.type === "move") {
      const startMin = clamp(
        snapSlot(
          ((d.y - daysRef.current.getBoundingClientRect().top - HEADER_H) / SLOT_PX) *
            SLOT_MIN -
            d.grabOffsetMin
        ),
        0,
        1440 - duration
      );
      drop = { ...drop, startMin };
    }
    d.result = drop;
    paintPreview(drop, duration, d.color);
  }

  function autoScrollLoop() {
    const d = dragRef.current;
    if (!d) return;
    if (d.active && scrollerRef.current) {
      const rect = scrollerRef.current.getBoundingClientRect();
      const EDGE = 44;
      const SPEED = 14;
      let scrolled = false;
      if (d.x > rect.right - EDGE) { scrollerRef.current.scrollLeft += SPEED; scrolled = true; }
      else if (d.x < rect.left + EDGE + 52) { scrollerRef.current.scrollLeft -= SPEED; scrolled = true; }
      if (d.y > rect.bottom - EDGE) { scrollerRef.current.scrollTop += SPEED; scrolled = true; }
      else if (d.y < rect.top + EDGE + HEADER_H) { scrollerRef.current.scrollTop -= SPEED; scrolled = true; }
      if (scrolled) updateDragVisuals();
    }
    rafRef.current = requestAnimationFrame(autoScrollLoop);
  }

  function endDrag(commit) {
    const d = dragRef.current;
    dragRef.current = null;
    cancelAnimationFrame(rafRef.current);
    if (ghostRef.current) ghostRef.current.style.display = "none";
    if (previewRef.current) previewRef.current.style.display = "none";
    if (selectBoxRef.current) selectBoxRef.current.style.display = "none";
    if (d?.dimEl) d.dimEl.style.opacity = "";
    if (!d || !d.active || !commit || !d.result) return d;

    if (d.type === "new") {
      addItem({
        kind: d.payload.kind,
        experienceId: d.payload.experienceId ?? null,
        transportMode: d.payload.transportMode ?? null,
        title: null,
        day: TRIP_DAYS[d.result.dayIdx],
        startMin: d.result.startMin,
        durationMin: d.payload.durationMin,
        createdBy: currentUser?.id ?? null,
      });
    } else if (d.type === "move") {
      updateItem(d.item.id, {
        day: TRIP_DAYS[d.result.dayIdx],
        startMin: d.result.startMin,
      });
    } else if (d.type === "resize") {
      updateItem(d.item.id, { durationMin: d.result.durationMin });
    } else if (d.type === "select") {
      setSelectedId(null);
      setSelectedIds(new Set(d.result));
    }
    return d;
  }

  function startDrag(e, drag) {
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // capture can fail for already-released pointers; drag still works
    }
    dragRef.current = {
      ...drag,
      startX: e.clientX,
      startY: e.clientY,
      x: e.clientX,
      y: e.clientY,
      active: false,
      result: null,
    };
  }

  function onDragMove(e) {
    const d = dragRef.current;
    if (!d) return;
    d.x = e.clientX;
    d.y = e.clientY;
    if (!d.active) {
      if (Math.hypot(d.x - d.startX, d.y - d.startY) < 6) return;
      d.active = true;
      if (ghostRef.current && d.type !== "resize") {
        ghostRef.current.textContent = d.ghostLabel || "";
        ghostRef.current.style.borderColor = d.color;
      }
      if (d.dimEl) d.dimEl.style.opacity = "0.35";
      rafRef.current = requestAnimationFrame(autoScrollLoop);
    }
    updateDragVisuals();
  }

  const chipHandlers = (chip) => ({
    onPointerDown: (e) =>
      startDrag(e, {
        type: "new",
        payload: chip.payload,
        color: chip.color,
        ghostLabel: `${chip.emoji ? chip.emoji + " " : ""}${chip.label}`,
      }),
    onPointerMove: onDragMove,
    onPointerUp: () => endDrag(true),
    onPointerCancel: () => endDrag(false),
  });

  const blockHandlers = (block) => {
    if (!editing) return { onClick: () => setSelectedId(block.id) };
    return blockEditHandlers(block);
  };

  const blockEditHandlers = (block) => ({
    onPointerDown: (e) =>
      startDrag(e, {
        type: "move",
        item: block,
        color: itemColor(block),
        ghostLabel: `${block.emoji} ${block.name}`,
        grabOffsetMin: (() => {
          const rect = daysRef.current.getBoundingClientRect();
          return (
            ((e.clientY - rect.top - HEADER_H) / SLOT_PX) * SLOT_MIN - block.startMin
          );
        })(),
        dimEl: e.currentTarget,
      }),
    onPointerMove: onDragMove,
    onPointerUp: () => {
      const d = endDrag(true);
      // a press without movement = tap → open the detail panel
      if (d && !d.active) {
        setSelectedIds(new Set());
        setSelectedId(d.item.id);
      }
    },
    onPointerCancel: () => endDrag(false),
  });

  const resizeHandlers = (block) => ({
    onPointerDown: (e) => {
      e.stopPropagation();
      startDrag(e, { type: "resize", item: block, color: itemColor(block) });
    },
    onPointerMove: onDragMove,
    onPointerUp: () => {
      const d = endDrag(true);
      // short blocks are mostly handle — let a still tap open the panel too
      if (d && !d.active) {
        setSelectedIds(new Set());
        setSelectedId(d.item.id);
      }
    },
    onPointerCancel: () => endDrag(false),
  });

  const dayBodyHandlers = (day) => {
    if (!editing) return {};
    return {
      onPointerDown: (e) => {
        // Only start a rubber-band when the pointerdown lands on the empty
        // day surface itself — if it bubbled up from a block or its
        // resize handle, their own handlers already took it (and the
        // resize handle calls stopPropagation()), so bail out here.
        if (e.target !== e.currentTarget) return;
        startDrag(e, { type: "select", day });
      },
      onPointerMove: onDragMove,
      onPointerUp: () => {
        const d = endDrag(true);
        if (d && !d.active) setSelectedIds(new Set());
      },
      onPointerCancel: () => endDrag(false),
    };
  };

  // ---- render ----

  if (!isLoaded || !currentUser) {
    return (
      <div className="loading-spinner">
        <div className="spinner" />
      </div>
    );
  }

  const tabs = [
    ...REGIONS.map((r) => ({ id: r.id, icon: r.icon, label: r.name.split(" ")[0].replace("&", "") })),
    { id: "transport", icon: "🚕", label: "Transport" },
  ];

  return (
    <>
      <Navbar />
      <main className="page-container" style={{ maxWidth: 1500 }}>
        <div className="page-header">
          <h1>🗓️ Trip Calendar</h1>
          <p className="page-subtitle">
            Drag places onto the days (3–16 Aug), stretch them to set how long,
            and slot in the car / taxi legs. It saves live for the whole family.
          </p>
        </div>

        <RouteStrip items={items} experiences={experiences} />

        {fetchError && (
          <div className="cal-warning">
            ⚠️ The calendar table isn&apos;t set up yet — run{" "}
            <code>supabase/migration-03-itinerary.sql</code> in the Supabase SQL
            Editor, then reload.
          </div>
        )}

        {/* Palette — or the lock card while editing is locked */}
        {!canEdit && (
          <div className="cal-locked card">
            {gateLoading ? (
              <p>Checking your voting progress…</p>
            ) : (
              <>
                <div className="cal-locked-title">🔒 Calendar editing is locked</div>
                <p>
                  Vote on every place first — you&apos;re at{" "}
                  <strong>
                    {votedCount}/{experiences.length}
                  </strong>
                  . You can still look around the calendar below.
                </p>
                <div className="cal-locked-actions">
                  <Link href="/dashboard" className="quick-link">
                    🗳️ Continue voting
                  </Link>
                </div>
                <p className="cal-locked-small">
                  (Aadit can also unlock you early from the admin panel.)
                </p>
              </>
            )}
          </div>
        )}
        {/* Lock bar — view mode by default, deliberate unlock to edit */}
        {canEdit && (
          <div className={`cal-lockbar ${unlocked ? "editing" : ""}`}>
            <span className="cal-lockbar-text">
              {unlocked
                ? "🔓 Edit mode — drags and deletes are live for the whole family."
                : "🔒 View mode — the calendar is safe to browse, nothing can be moved by accident."}
            </span>
            <button
              className="cal-lockbar-btn"
              onClick={() => setUnlocked((u) => !u)}
            >
              {unlocked ? "🔒 Lock" : "🔓 Unlock to edit"}
            </button>
          </div>
        )}

        {editing && (
        <div className="cal-palette">
          <div className="cal-tabs">
            {tabs.map((t) => (
              <button
                key={t.id}
                className={`cal-tab ${activeTab === t.id ? "active" : ""}`}
                onClick={() => setActiveTab(t.id)}
              >
                {t.icon} <span>{t.label}</span>
              </button>
            ))}
            <button
              className="cal-add-event"
              onClick={() => {
                setSelectedIds(new Set());
                setShowAddEvent(true);
              }}
            >
              ➕ Checkpoint / event
            </button>
          </div>
          <div className="cal-chips">
            {paletteChips.map((chip) => (
              <div
                key={chip.key}
                className="cal-chip"
                style={{ "--chip-color": chip.color }}
                {...chipHandlers(chip)}
              >
                {chip.emoji ? (
                  <span className="cal-chip-emoji">{chip.emoji}</span>
                ) : (
                  <span className="cal-chip-dot" />
                )}
                <span className="cal-chip-name">{chip.label}</span>
                {chip.voteScore > 0 && (
                  <span className="cal-chip-rating">{chip.voteScore} pts</span>
                )}
                {chip.scheduled && <span className="cal-chip-check">✓</span>}
              </div>
            ))}
            {paletteChips.length === 0 && (
              <span className="cal-chips-empty">No places in this region yet.</span>
            )}
          </div>
          <p className="cal-hint">
            Hold a card and drag it down onto a day · drag a block to move it ·
            pull its bottom edge to stretch · tap a block for details.
          </p>
        </div>
        )}

        {/* Grid */}
        <div className="cal-scroller" ref={scrollerRef}>
          <div className="cal-inner">
            <div className="cal-gutter">
              <div className="cal-gutter-head" />
              <div className="cal-gutter-body">
                {Array.from({ length: 24 }, (_, h) => (
                  <span key={h} className="cal-hour-label" style={{ top: h * 2 * SLOT_PX }}>
                    {formatTime(h * 60)}
                  </span>
                ))}
              </div>
            </div>
            <div className="cal-days" ref={daysRef}>
              {TRIP_DAYS.map((day) => {
                const f = formatDay(day);
                const dayBlocks = blocks.filter((b) => b.day === day);
                const lanes = layoutByDay[day];
                return (
                  <div key={day} className="cal-day">
                    <div className="cal-day-head">
                      <span className="cal-day-weekday">{f.weekday}</span>
                      <span className="cal-day-date">
                        {f.date} {f.month}
                      </span>
                    </div>
                    <div
                      className={`cal-day-body ${editing ? "editing" : ""}`}
                      {...dayBodyHandlers(day)}
                    >
                      {dayBlocks.map((b) => {
                        const lane = lanes[b.id] || { lane: 0, lanes: 1 };
                        const color = itemColor(b);
                        const h = (b.durationMin / SLOT_MIN) * SLOT_PX;
                        return (
                          <div
                            key={b.id}
                            className={`cal-block ${selectedId === b.id ? "selected" : ""} ${selectedIds.has(b.id) ? "multi-selected" : ""} ${editing ? "" : "readonly"}`}
                            style={{
                              top: (b.startMin / SLOT_MIN) * SLOT_PX,
                              height: h - 2,
                              left: `calc(${(lane.lane / lane.lanes) * 100}% + 2px)`,
                              width: `calc(${100 / lane.lanes}% - 5px)`,
                              "--block-color": color,
                            }}
                            {...blockHandlers(b)}
                          >
                            <span className="cal-block-name">
                              {b.emoji} {b.name}
                            </span>
                            {h >= 44 && (
                              <span className="cal-block-time">
                                {formatTime(b.startMin)}–{formatTime(b.startMin + b.durationMin)}
                              </span>
                            )}
                            {editing && (
                              <div className="cal-block-resize" {...resizeHandlers(b)} />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              <div className="cal-drop-preview" ref={previewRef} />
              <div className="cal-select-box" ref={selectBoxRef} />
            </div>
          </div>
        </div>
      </main>

      {/* drag ghost follows the pointer */}
      <div className="cal-ghost" ref={ghostRef} />

      {/* tapped-block detail panel */}
      {selectedItem && (
        <div className="cal-panel">
          <div className="cal-panel-info">
            <strong>
              {selectedItem.emoji} {selectedItem.name}
            </strong>
            <span>
              {(() => {
                const f = formatDay(selectedItem.day);
                return `${f.weekday} ${f.date} ${f.month} · ${formatTime(selectedItem.startMin)}–${formatTime(selectedItem.startMin + selectedItem.durationMin)}`;
              })()}
            </span>
          </div>
          {editing && selectedItem.kind !== "place" && (
            <input
              key={`title-${selectedItem.id}`}
              type="text"
              className="comment-input cal-panel-note"
              placeholder={
                selectedItem.kind === "transport"
                  ? "Note, e.g. Tbilisi → Kazbegi"
                  : "Rename this event"
              }
              defaultValue={selectedItem.title || ""}
              maxLength={80}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v !== (selectedItem.title || "")) {
                  updateItem(selectedItem.id, { title: v || null });
                }
              }}
            />
          )}
          {editing ? (
            <textarea
              key={`notes-${selectedItem.id}`}
              className="cal-panel-note-textarea"
              placeholder="Notes — meet driver at the lobby, bring cash…"
              defaultValue={selectedItem.notes || ""}
              maxLength={300}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v !== (selectedItem.notes || "")) {
                  updateItem(selectedItem.id, { notes: v || null });
                }
              }}
            />
          ) : (
            selectedItem.notes && (
              <p className="cal-panel-note-readonly">📝 {selectedItem.notes}</p>
            )
          )}
          <div className="cal-panel-actions">
            {editing && (
              <button
                className="cal-panel-delete"
                onClick={() => {
                  removeItem(selectedItem.id);
                  setSelectedId(null);
                }}
              >
                🗑 Remove
              </button>
            )}
            <button className="cal-panel-close" onClick={() => setSelectedId(null)}>
              Close
            </button>
          </div>
        </div>
      )}

      {editing && selectedIds.size > 0 && (
        <div className="cal-bulk-bar">
          <span className="cal-bulk-bar-text">{selectedIds.size} selected</span>
          <div className="cal-bulk-bar-actions">
            <button
              className="cal-bulk-bar-delete"
              onClick={() => {
                selectedIds.forEach((id) => removeItem(id));
                setSelectedIds(new Set());
              }}
            >
              🗑 Delete
            </button>
            <button
              className="cal-bulk-bar-clear"
              onClick={() => setSelectedIds(new Set())}
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {showAddEvent && (
        <AddEventModal
          onClose={() => setShowAddEvent(false)}
          onAdd={({ title, day, startMin, durationMin }) =>
            addItem({
              kind: "custom",
              experienceId: null,
              transportMode: null,
              title,
              day,
              startMin,
              durationMin,
              createdBy: currentUser.id,
            })
          }
        />
      )}
    </>
  );
}
