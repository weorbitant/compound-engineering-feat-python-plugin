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
if ! find ~/.claude/plugins -type d -name "superpowers" 2>/dev/null | grep -q .; then
  missing+=("superpowers")
fi

# If nothing is missing, exit silently
if [ ${#missing[@]} -eq 0 ]; then
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

warning="$warning
Run the install commands above. [REQUIRED] dependencies must be installed for the workflow commands to work."

echo "$warning" >&2
exit 0
