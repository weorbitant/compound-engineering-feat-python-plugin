# Spawn Backends

A **backend** determines how teammate Claude instances run. Auto-detected.

| Backend | How | Visibility | Persistence | Speed |
|---------|-----|------------|-------------|-------|
| **in-process** | Same Node.js process as leader | Hidden | Dies with leader | Fastest |
| **tmux** | Separate tmux pane | Visible in tmux | Survives leader exit | Medium |
| **iterm2** | Split panes in iTerm2 | Visible side-by-side | Dies with window | Medium |

## Auto-detection

1. `$TMUX` set → `tmux` (native)
2. `$TERM_PROGRAM === "iTerm.app"` + `which it2` → `iterm2`
3. `which tmux` → `tmux` (external session `claude-swarm`)
4. Fallback → `in-process`

## Forcing a backend

```bash
export CLAUDE_CODE_SPAWN_BACKEND=in-process   # Fastest, no visibility
export CLAUDE_CODE_SPAWN_BACKEND=tmux         # Visible, persistent
unset CLAUDE_CODE_SPAWN_BACKEND               # Auto-detect (default)
```

## in-process

Pros: fastest startup, lowest overhead, works everywhere.
Cons: can't see teammate output live, all die if leader dies, harder to debug.

```
┌─────────────────────────────────────────┐
│           Node.js Process               │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐ │
│  │ Leader  │  │Worker 1 │  │Worker 2 │ │
│  └─────────┘  └─────────┘  └─────────┘ │
└─────────────────────────────────────────┘
```

## tmux

Inside tmux → splits current window. Outside → creates `claude-swarm` session.

Pros: real-time visibility, survives leader exit, CI-friendly.
Cons: slower startup, requires tmux.

Useful commands:
```bash
tmux list-panes
tmux select-pane -t 1
tmux kill-pane -t %5
tmux attach -t claude-swarm
tmux select-layout tiled
```

## iterm2 (macOS only)

Uses `it2` CLI via iTerm2 Python API.

Setup:
```bash
uv tool install it2   # or pipx install it2
# Enable: iTerm2 → Settings → General → Magic → Enable Python API
# Restart iTerm2
it2 --version
```

On first spawn if setup is incomplete, Claude Code prompts to install, fallback to tmux, or cancel.

## Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| "No pane backend available" | No tmux or iTerm2 | `brew install tmux` |
| "it2 CLI not installed" | In iTerm2 but no it2 | `uv tool install it2` |
| "Python API not enabled" | it2 can't reach iTerm2 | iTerm2 Settings → enable Python API |
| Workers not visible | Using in-process | Start inside tmux or iTerm2 |
| Workers dying unexpectedly | Outside tmux, leader exited | Use tmux for persistence |

## Checking current backend

```bash
cat ~/.claude/teams/{team}/config.json | jq '.members[].backendType'
echo $TMUX
echo $TERM_PROGRAM
which tmux
which it2
```

## Backend in config.json

```json
{
  "members": [
    { "name": "worker-1", "backendType": "in-process", "tmuxPaneId": "in-process" },
    { "name": "worker-2", "backendType": "tmux",       "tmuxPaneId": "%5" }
  ]
}
```
