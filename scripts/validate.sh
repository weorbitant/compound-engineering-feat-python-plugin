#!/usr/bin/env bash
# Structural validation for the plugin: frontmatter, links, stale refs, scripts.
# Run from the repo root: ./scripts/validate.sh
set -uo pipefail

cd "$(dirname "$0")/.."
fail=0
err() { echo "FAIL: $*" >&2; fail=1; }
warn() { echo "warn: $*" >&2; }

# 1. Skill frontmatter: name matches directory, description present
for dir in skills/*/; do
  skill="${dir%/}"
  base="$(basename "$skill")"
  md="$skill/SKILL.md"
  [ -f "$md" ] || { err "$skill has no SKILL.md"; continue; }
  name=$(grep -m1 '^name:' "$md" | sed 's/^name:[[:space:]]*//')
  [ "$name" = "$base" ] || err "$md: name '$name' != directory '$base'"
  grep -q '^description:.' "$md" || err "$md: missing description"
done

# 2. Agent frontmatter: name matches filename, description present
for f in agents/*/*.md; do
  base="$(basename "$f" .md)"
  name=$(grep -m1 '^name:' "$f" | sed 's/^name:[[:space:]]*//')
  [ "$name" = "$base" ] || err "$f: name '$name' != filename '$base'"
  grep -q '^description:.' "$f" || err "$f: missing description"
done

# 3. No bare backtick refs to bundled files in SKILL.md (must be markdown links)
if grep -lE '`(references|assets|scripts)/[^`]+`' skills/*/SKILL.md >/dev/null 2>&1; then
  grep -lE '`(references|assets|scripts)/[^`]+`' skills/*/SKILL.md | while read -r f; do
    err "$f: bare backtick reference — use a markdown link"
  done
  fail=1
fi

# 4. Markdown links to bundled files must resolve; bundled files should be linked
for dir in skills/*/; do
  md="${dir}SKILL.md"
  [ -f "$md" ] || continue
  # links -> disk
  while read -r target; do
    [ -n "$target" ] || continue
    [ -e "$dir$target" ] || err "$md: broken link to $target"
  done < <(grep -oE '\]\((\./)?(references|assets|scripts)/[^)]+\)' "$md" | sed -E 's/^\]\(//; s/\)$//; s/^\.\///')
  # disk -> links (warning only; some assets are loaded by scripts, not prose)
  for sub in references scripts assets; do
    [ -d "$dir$sub" ] || continue
    while read -r f; do
      rel="${f#"$dir"}"
      grep -qF "$rel" "$md" || warn "$f not linked from $md"
    done < <(find "$dir$sub" -type f ! -name "*.pyc")
  done
done

# 5. Python scripts must compile
while read -r py; do
  python3 -m py_compile "$py" 2>/dev/null || err "$py does not compile"
done < <(find skills -path '*/scripts/*.py' -not -path '*__pycache__*')

# 6. Stale references that must never reappear
stale='holafly|orchestrating-swarms|learnings-researcher|kieran-claude'
if grep -rInE "$stale" --include='*.md' --include='*.sh' --include='*.py' --include='*.json' \
    agents commands skills scripts .claude-plugin CLAUDE.md README.md 2>/dev/null | grep -v 'scripts/validate.sh'; then
  err "stale references found (see above)"
fi

# 7. Component counts in plugin.json description must match the filesystem
agents_n=$(find agents -name '*.md' | wc -l | tr -d ' ')
commands_n=$(find commands -name '*.md' | wc -l | tr -d ' ')
skills_n=$(find skills -maxdepth 1 -mindepth 1 -type d | wc -l | tr -d ' ')
desc=$(grep -o '"description": "[^"]*"' .claude-plugin/plugin.json | head -1)
for pair in "$agents_n agents" "$commands_n commands" "$skills_n skills"; do
  echo "$desc" | grep -q "${pair}" || err "plugin.json description does not say '${pair}' (filesystem truth)"
done

if [ "$fail" -ne 0 ]; then
  echo; echo "Validation FAILED." >&2; exit 1
fi
echo "Validation passed: $agents_n agents, $commands_n commands, $skills_n skills."
