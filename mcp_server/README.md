# netconsole-mcp

MCP (Model Context Protocol) server exposing NetConsole's REST API as tools for
AI agents (Claude Desktop, Claude Code, or any other MCP client). Runs as a
local stdio process; it's a thin HTTP client over the existing
`/api/v1/*` endpoints and never touches NetConsole's Python internals directly.

**Full read/write scope**, including `push_group_config`, which pushes raw
show/config commands to real network devices with no dry-run and no rollback.
See that tool's docstring before wiring this up.

Note: local dev traffic goes through Traefik on `http://localhost` (port 80),
not `localhost:8888` — `docker-compose.override.yml`'s `8888:8888` port mapping
for the `backend` service is dead (the container actually listens on port 80
internally per its Traefik label), a pre-existing issue unrelated to this
feature. Use `http://localhost/api/v1` as shown below.

## Setup

Only this `mcp_server/` directory needs to be present locally (it's launched
as a local stdio process) — the NetConsole backend itself does **not** need
to run on the same machine; point `NETCONSOLE_API_URL` at wherever it's
hosted. A full clone of the repo works too, but isn't required.

```bash
cd mcp_server
uv sync   # or: pip install -e .
cp .env.example .env   # then fill in NETCONSOLE_API_KEY below
```

### 1. Mint an API key for a service account

NetConsole's REST API now accepts `X-API-Key` in addition to JWT bearer
tokens. Easiest path: log into the NetConsole web UI as a superuser, open
**API Keys** in the sidebar, click **Add ApiKey**, give it a name and pick a
role, and copy the key shown (only once).

Roles: `read_write` (default — full access, required for `push_group_config`)
or `read_only` (blocks POST/PUT/DELETE on every endpoint, 403s on write
attempts — use this for a key you only want an agent to query data with).

Equivalently, via curl — creating a key with no `user_id` auto-provisions its
own dedicated, hidden service-account user (superuser-privileged, no password
login) that's cleaned up automatically when the key is revoked:

```bash
# Log in as an existing superuser to get a JWT
TOKEN=$(curl -s -X POST http://localhost/api/v1/login/access-token \
  -d "username=<superuser-email>&password=<superuser-password>" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

# Mint a key — role defaults to "read_write" if omitted
curl -s -X POST http://localhost/api/v1/api-keys/ \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"claude-mcp","role":"read_write"}'
# => {"key": "ncmcp_...", ...}  -- copy this into NETCONSOLE_API_KEY, it is shown only once
```

To attach a key to an existing user instead of auto-provisioning a new one,
pass `"user_id": <id>` in the body (the older two-step flow of creating a
`POST /users/` account first still works unchanged).

### 2. Configure environment

Edit `.env` (or export directly):

```
NETCONSOLE_API_URL=http://localhost/api/v1
NETCONSOLE_API_KEY=ncmcp_...
```

## Running standalone / testing

```bash
uv run mcp dev netconsole_mcp/server.py   # opens MCP Inspector to list/call tools
# or drive it directly over stdio:
uv run python -m netconsole_mcp
```

## Wiring into Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "netconsole": {
      "command": "uv",
      "args": ["--directory", "/absolute/path/to/netconsole/mcp_server", "run", "python", "-m", "netconsole_mcp"],
      "env": {
        "NETCONSOLE_API_URL": "http://localhost/api/v1",
        "NETCONSOLE_API_KEY": "ncmcp_..."
      }
    }
  }
}
```

## Wiring into Claude Code

A project-level `.mcp.json` is already committed at the repo root. It reads
`NETCONSOLE_API_KEY` from your shell environment (no secret is committed) —
before launching Claude Code:

```bash
export NETCONSOLE_API_KEY=ncmcp_...
```

Restart Claude Code; the `netconsole` server and its tools should appear.

## Wiring into Gemini CLI

MCP is an open protocol — Gemini CLI is a compliant client too, same config
shape as Claude. Add to `.gemini/settings.json` (project-level, run from repo
root) or `~/.gemini/settings.json` (global — use an absolute path to
`mcp_server` there instead of the relative one below):

```json
{
  "mcpServers": {
    "netconsole": {
      "command": "uv",
      "args": ["--directory", "mcp_server", "run", "python", "-m", "netconsole_mcp"],
      "env": {
        "NETCONSOLE_API_URL": "http://localhost/api/v1",
        "NETCONSOLE_API_KEY": "ncmcp_..."
      }
    }
  }
}
```

Restart Gemini CLI; the `netconsole` server and its tools should appear.

## Revoking a key

```bash
curl -X DELETE http://localhost/api/v1/api-keys/<id> -H "Authorization: Bearer $TOKEN"
```
