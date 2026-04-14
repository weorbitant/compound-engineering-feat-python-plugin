#!/bin/bash
# Check optional external dependencies and warn if missing

missing=()

# Check agent-browser (required for browser automation features)
if ! command -v agent-browser &> /dev/null; then
  missing+=("agent-browser")
fi

# Check rclone (required for cloud file uploads)
if ! command -v rclone &> /dev/null; then
  missing+=("rclone")
fi

# If nothing is missing, exit silently
if [ ${#missing[@]} -eq 0 ]; then
  exit 0
fi

# Build warning message
warning="[compound-engineering] Optional dependencies not found:"

if [[ " ${missing[*]} " =~ " agent-browser " ]]; then
  warning="$warning
  - agent-browser (browser automation, /test-browser, /feature-video, design agents)
    Install: npm install -g agent-browser && agent-browser install"
fi

if [[ " ${missing[*]} " =~ " rclone " ]]; then
  warning="$warning
  - rclone (cloud file uploads for /feature-video)
    Install: https://rclone.org/install/"
fi

warning="$warning
Run the install commands above to enable these features."

echo "$warning" >&2
exit 0
