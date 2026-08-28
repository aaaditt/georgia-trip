"""Verify migration-00-bootstrap-all.sql is a faithful concatenation.

Reverses the two transformations and checks the result is byte-identical to
each source file, in order. Then sanity-checks dollar quoting.
"""

import io
import os
import re

SRC = r"C:\Aadit\Personal\code-ide\vs-code\trip\supabase"
OUT = os.path.join(SRC, "migration-00-bootstrap-all.sql")

ORDER = [
    "schema.sql",
    "migration-01-experiences-realtime.sql",
    "migration-02-road-trip-places.sql",
    "migration-03-itinerary.sql",
    "migration-04-calendar-access.sql",
    "migration-05-notes.sql",
    "migration-06-multitenancy.sql",
    "migration-07-phase4.sql",
    "migration-08-rls-workaround-rpcs.sql",
    "migration-09-georgia-catalog.sql",
]

text = io.open(OUT, encoding="utf-8").read()
# strip the appended verification footer before checking faithfulness
SENTINEL = "\n\n\n-- BOOTSTRAP-FOOTER-SENTINEL"
text, _, footer = text.partition(SENTINEL)
assert footer, "footer sentinel missing"
print(f"[ok] footer present ({footer.count(chr(10))} lines), stripped for diff")

# Split the output back into its per-source sections.
chunks = re.split(r"\n\n-- ={76}\n-- SOURCE FILE: (\S+)\n.*?\n-- ={76}\n\n", text)
# chunks[0] = header, then alternating (fname, body)
pairs = list(zip(chunks[1::2], chunks[2::2]))

assert [f for f, _ in pairs] == ORDER, f"section order wrong: {[f for f, _ in pairs]}"
print(f"[ok] {len(pairs)} sections, correct order")

WRAPPED = re.compile(
    r"^DO \$bootstrap\$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE (\w+); "
    r"EXCEPTION WHEN duplicate_object THEN NULL; END \$bootstrap\$;"
    r"  -- bootstrap: guarded$"
)
GUARD_DROP = re.compile(r'^DROP POLICY IF EXISTS "[^"]+" ON \w+;  -- bootstrap: guarded$')

total_t1 = total_t2 = 0
for fname, body in pairs:
    original = io.open(os.path.join(SRC, fname), encoding="utf-8").read()
    restored = []
    for line in body.split("\n"):
        m = WRAPPED.match(line)
        if m:
            total_t1 += 1
            restored.append(f"ALTER PUBLICATION supabase_realtime ADD TABLE {m.group(1)};")
            continue
        if GUARD_DROP.match(line):
            total_t2 += 1
            continue  # injected line, drop it
        restored.append(line)
    restored = "\n".join(restored)
    if restored != original:
        # locate first divergence for a useful message
        for i, (a, b) in enumerate(zip(restored.split("\n"), original.split("\n"))):
            if a != b:
                raise SystemExit(
                    f"[FAIL] {fname} diverges at line {i+1}\n  got: {a!r}\n  want:{b!r}"
                )
        raise SystemExit(f"[FAIL] {fname} length differs")
    print(f"[ok] {fname:<45} restores byte-identical ({len(original.splitlines())} lines)")

print(f"[ok] reversed {total_t1} publication guards, {total_t2} policy guards")

# --- structural checks on the emitted file ---
lines = text.split("\n")

bad = [l for l in lines if l.startswith("ALTER PUBLICATION")]
assert not bad, f"[FAIL] unguarded ALTER PUBLICATION at column 0: {bad}"
print("[ok] no unguarded column-0 ALTER PUBLICATION remains")

# every column-0 CREATE POLICY must be immediately preceded by a matching DROP
policy_re = re.compile(r'^CREATE POLICY "([^"]+)" ON ([\w.]+)\b')
unprotected = []
for i, line in enumerate(lines):
    m = policy_re.match(line)
    if not m:
        continue
    prev = ""
    for j in range(i - 1, -1, -1):
        if lines[j].strip():
            prev = lines[j].strip()
            break
    if not prev.startswith(f'DROP POLICY IF EXISTS "{m.group(1)}" ON {m.group(2)}'):
        unprotected.append((i + 1, line[:80]))
assert not unprotected, f"[FAIL] CREATE POLICY without preceding DROP: {unprotected}"
print("[ok] every CREATE POLICY is preceded by its DROP POLICY IF EXISTS")

# no duplicated DROP POLICY lines back to back
dupes = [
    i + 1
    for i in range(1, len(lines))
    if lines[i].startswith("DROP POLICY IF EXISTS")
    and lines[i].split("  --")[0] == lines[i - 1].split("  --")[0]
]
assert not dupes, f"[FAIL] duplicated DROP POLICY at lines {dupes}"
print("[ok] no duplicated DROP POLICY lines")

# dollar-quote balance
for tag in ["$$", "$bootstrap$", "$guide$"]:
    n = text.count(tag)
    assert n % 2 == 0, f"[FAIL] unbalanced {tag}: {n} occurrences"
    print(f"[ok] {tag} balanced ({n} occurrences)")

# $bootstrap$ must never appear inside a $$...$$ function body
depth = 0
for i, line in enumerate(lines):
    if "$bootstrap$" in line and depth % 2 == 1:
        raise SystemExit(f"[FAIL] $bootstrap$ inside a $$ body at line {i+1}")
    depth += line.count("$$")
print("[ok] $bootstrap$ never nested inside a $$ function body")

print("\nALL CHECKS PASSED")
