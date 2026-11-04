#!/usr/bin/env bash
# Create a throwaway copy of examples/monorepo as its own git repo, for trying the
# plugin locally without touching this repository's history.
#
# Usage: ./scripts/sandbox.sh [target-dir] [--install]
#   target-dir  where to create the sandbox (default: a new temp dir)
#   --install   run `poetry install` in every service (needed by /workflows:work)
set -euo pipefail

plugin_root="$(cd "$(dirname "$0")/.." && pwd)"
template="$plugin_root/examples/monorepo"
target=""
install=0

for arg in "$@"; do
  case "$arg" in
    --install) install=1 ;;
    -h|--help) sed -n '2,8p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) target="$arg" ;;
  esac
done

if [ -z "$target" ]; then
  target="$(mktemp -d "${TMPDIR:-/tmp}/pms-sandbox.XXXXXX")"
elif [ -e "$target" ] && [ -n "$(ls -A "$target" 2>/dev/null)" ]; then
  echo "error: $target exists and is not empty" >&2
  exit 1
fi

mkdir -p "$target"
cp -R "$template/." "$target/"
find "$target" \( -name .venv -o -name __pycache__ -o -name '.*_cache' \) -prune -exec rm -rf {} +

cd "$target"
git init -q -b main
git add -A
git -c user.name="sandbox" -c user.email="sandbox@localhost" commit -q -m "chore: initial demo monorepo"

if [ "$install" -eq 1 ]; then
  for svc in lib-common orders payments; do
    echo "poetry install: $svc"
    (cd "$svc" && poetry install -q)
  done
fi

if ! command -v pre-commit >/dev/null 2>&1; then
  echo "note: pre-commit is not installed; /workflows:work's quality gate runs it." >&2
  echo "      Install with: uv tool install pre-commit   (or pipx install pre-commit)" >&2
fi

cat <<MSG
Sandbox ready: $target

Start Claude Code there with this checkout of the plugin loaded:
  cd "$target" && claude --plugin-dir "$plugin_root"

Requires the superpowers plugin (>= 7.0.0) installed at user scope.
Walkthrough: $template/README.md
MSG
