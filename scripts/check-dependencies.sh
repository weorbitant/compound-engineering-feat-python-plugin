#!/bin/bash
# Check external dependencies (some required, some optional) and warn if missing

missing=()

# Check agent-browser (required for browser automation features)
if ! command -v agent-browser &> /dev/null; then
  missing+=("agent-browser")
fi

# Check rclone (required for cloud file uploads)
if ! command -v rclone &> /dev/null; then
  missing+=("rclone")
fi

# Check superpowers plugin (REQUIRED — provides workflow primitives)
MIN_SUPERPOWERS="7.0.0"
plugins_dir="${CLAUDE_CONFIG_DIR:-$HOME/.claude}/plugins"
outdated_superpowers=""
if ! find "$plugins_dir/" -type d -name "superpowers" 2>/dev/null | grep -q .; then
  missing+=("superpowers")
else
  # Newest installed version = highest semver-named dir under cache/*/superpowers/
  sp_version=$(find "$plugins_dir"/cache/*/superpowers -mindepth 1 -maxdepth 1 -type d 2>/dev/null \
    | sed 's#.*/##' | grep -E '^[0-9]+\.[0-9]+\.[0-9]+$' | sort -V | tail -n1)
  if [ -n "$sp_version" ] && \
     [ "$(printf '%s\n%s\n' "$MIN_SUPERPOWERS" "$sp_version" | sort -V | head -n1)" != "$MIN_SUPERPOWERS" ]; then
    outdated_superpowers="$sp_version"
  fi
fi

# If nothing is missing or outdated, exit silently
if [ ${#missing[@]} -eq 0 ] && [ -z "$outdated_superpowers" ]; then
  exit 0
fi

if [ ${#missing[@]} -eq 0 ]; then
  echo "[py-micro-superpowers] superpowers $outdated_superpowers is installed, but the workflow commands assume $MIN_SUPERPOWERS+ behavior.
  Update with: /plugin update superpowers" >&2
  exit 0
fi

# Build warning message
warning="[py-micro-superpowers] Dependencies not found:"

if [[ " ${missing[*]} " =~ " agent-browser " ]]; then
  warning="$warning
  - [OPTIONAL] agent-browser — browser automation, /test-browser, /feature-video, design agents
    Install: npm install -g agent-browser && agent-browser install"
fi

if [[ " ${missing[*]} " =~ " rclone " ]]; then
  warning="$warning
  - [OPTIONAL] rclone — cloud file uploads for /feature-video
    Install: https://rclone.org/install/"
fi

if [[ " ${missing[*]} " =~ " superpowers " ]]; then
  warning="$warning
  - [REQUIRED] superpowers — provides brainstorming, planning, execution, review primitives
    Install: /plugin marketplace add anthropics/claude-plugins-official
             /plugin install superpowers@claude-plugins-official"
fi

if [ -n "$outdated_superpowers" ]; then
  warning="$warning
  - [REQUIRED] superpowers $outdated_superpowers is older than $MIN_SUPERPOWERS — update with: /plugin update superpowers"
fi

warning="$warning
Run the install commands above. [REQUIRED] dependencies must be installed for the workflow commands to work."

echo "$warning" >&2
exit 0
