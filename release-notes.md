# Release Notes

## v0.2.7

### Backend / Infra
- Postgres 17 → 18
- Traefik v2.11 → v3.7 (rule syntax updated: `Host()`/`PathPrefix()` multi-arg lists → `||`-chained, removed in v3)
- Adminer 4.8.1 → 5.4.2
- nginx 1.30.1 → 1.30.3 (frontend image)
- Backend: Python 3.12 → 3.13, Poetry 1.8.5 → 2.4.1 (`poetry lock --check` → `poetry check --lock`)

## v0.2.6

### API Keys & MCP Server (AI Agent Integration)
- API Keys management UI (sidebar) — mint read-write/read-only keys, auto-provisioned hidden service-account user, one-time key display
- New `mcp_server/` — exposes REST API as [MCP](https://modelcontextprotocol.io) tools (Claude Desktop, Claude Code, Gemini CLI, etc.) for querying/operating switches, interfaces, MAC/ARP, credentials, groups
- Project-level `.mcp.json` committed for Claude Code

### Switch Auth
- Detect and surface wrong credentials/auth errors from switches instead of a generic failure
- App version now shown on login page

### Arista EOS
- Fixed Netmiko prompt-detection timeout on cEOS — tuned `global_delay_factor` and `fast_cli`

### Backend / Infra
- Upgraded backend to Python 3.12; base image `tiangolo` → `python:3.12-slim`
- Poetry install/build fixes (pin then upgrade to `>=2.0.0`, pip-based install to dodge apt-get network failures, auto-regenerate stale lockfile)
- `prestart.sh` now runs automatically on container start (auto-migrate)
- Vite 6 upgrade, TanStack route tree regenerated
- Dependency bumps: cryptography, pydantic-settings, starlette, pyjwt, python-multipart, joserfc, js-yaml, tar, form-data, esbuild

### Docs
- Vietnamese README (`README.vi.md`) + language switcher
- New lab guide (`lab-guide.md`, `lab-guide-vi.md`) for Multipass/Docker deployment, updated for Ubuntu 26.04

### Fixes / Chores
- mypy/ruff lint fixes, test mock corrections, `timezone.utc` → `datetime.UTC` refactor

## v0.2.5 — UI redesign & interface config fixes

### Bug Fixes
- **Interface mode parsing** — mode was always stored as `access` during sync; now correctly derived from device output (`trunk`, `routed`, `access`)
- **Trunk VLAN sync** — `allowed_vlan` in DB now updates after configuring trunk port (no longer requires a full metadata sync to see changes)
- **Edit Interface loading state** — Save button now shows spinner for the full duration of the request
- **Audit log ordering** — log entry now written after device operation succeeds (not before)
- **Interface update** — fixed `__dict__` → `model_dump()` causing stale field values on update

### UI Improvements
- Redesigned Interfaces, ARP, MAC Addresses, IP Interfaces, Group Config pages
- Redesigned Edit Interface modal — Current State card, mode-aware VLAN/Allowed column
- Switches page: card/list view toggle with localStorage persistence
- Dashboard stat cards smaller; timestamp format consistent (`MM/DD/YYYY, HH:MM:SS`) across all pages

### Arista EOS
- EOS platform and device_type options added to Add/Edit Switch dropdowns
- README updated with EOS switch config requirements

## v0.2.4

### Switch Health Check
- TCP connect health check (UP/DOWN) per switch — no credentials needed
- Batch **Check Health** button checks all switches in parallel (~5s)
- Periodic background health check every 5 min (configurable via `HEALTH_CHECK_INTERVAL_MINUTES`)
- Status displayed as colored badge (green UP / red DOWN / gray Unknown)

### Switches Page Redesign
- **Card view**: shows vendor, model, serial number, OS version, description, groups as tags, last sync time
- **List view**: dense table with all key fields visible
- Toggle between views with grid/list icon buttons — preference saved to localStorage
- Per-switch **Sync** button replaces the old wide "Update Metadata" button

### IP Interface Sync Fix
- Fixed stale records persisting after interfaces are removed from device
- Fixed duplicate records created when IP address changes on same interface
- Sync now matches by interface name, deletes removed interfaces, deduplicates existing records

### Other
- Frontend minor dependency updates (TanStack Router, Emotion, TypeScript 5.9)
- Alembic migration: `health_status` column on `switch` table

## v0.2.3

### Dependency Upgrades
- Upgraded 91 Python packages (fastapi 0.109→0.136, sqlmodel 0.0.16→0.0.38, alembic 1.13→1.18, sentry-sdk 1.41→2.60, cryptography 42→48, ruff 0.2→0.15, pytest 7→8, mypy 1.9→1.20, and more)
- Upgraded 15 npm packages (TanStack Query/Router, react-hook-form, react-icons, axios, @simplewebauthn/browser)
- Docker: node 22→24, nginx 1.28→1.30.1-alpine
- Pre-commit: ruff v0.15.13, pre-commit-hooks v5.0.0
- Fixed critical CVE in `form-data` (4.0.0→4.0.5, CVE-2025-7312)

### Configurable Timezone
- New `TIMEZONE` env var (IANA format, e.g. `Asia/Ho_Chi_Minh`)
- Server time displayed in Admin page
- Audit log timestamps converted to configured timezone

### Bug Fixes
- Fixed duplicate route handler `update_switch_metadata` (F811)
- Fixed `crud/__init__.py` missing re-exports breaking test helpers
- Fixed test teardown FK violation on `webauthncredential` table
- Fixed mypy strict mode compliance with updated type checker

### CI / Infrastructure
- Fixed CI `.env` generation with all required variables
- Added `gibberish-detector` to security scan dependencies
- Added `CLAUDE.md` with project architecture documentation

## v0.2.2

### Full Audit Logging
- DB-backed audit log table (replaces fragile file-based parsing)
- All significant write operations now logged: login, OAuth, passkey, user CRUD, switch/interface/credential/group changes
- Logs page: action column, severity badges (INFO/WARNING/ERROR), search by username/message, severity filter, pagination

## v0.2.1

### Authentication
- Social login: Google OAuth2, Microsoft Azure AD, Keycloak OIDC (Authorization Code + PKCE)
- Passkey / WebAuthn registration and authentication
- Passkey management in user settings (add, delete credentials)

### Admin
- Disable password login per user (`password_login_enabled` flag)
- User table shows authentication methods (password, OAuth providers, passkey) as badges

### Database
- New migration: `oauthaccount` and `webauthncredential` tables
- New migration: `password_login_enabled` column on `user` table

## v0.2.0

### Security
- **Credential encryption** — device passwords encrypted at rest using Fernet (AES-128-CBC). Never stored or returned in plaintext.
- **Command injection fix** — all user input (port name, description, VLAN) validated before building device CLI commands
- **Group config restricted to superusers** — only admin accounts can push bulk config to devices
- **JWT token lifetime** reduced from 8 days to 1 day
- **`.env` removed from git tracking** — use `.env.example` as template

### Bug Fixes
- Interface delete endpoint now actually deletes (was returning `True`)
- Fixed `switch.model` null guard on Juniper platform detection
- Removed dead code `switches2.py` (was never imported)

### CI / Review Process
- Added `detect-secrets` and `bandit` pre-commit hooks
- Added `security` job to GitHub Actions (bandit SAST + secrets scan)
- Added dependency review on PRs
- Added `mypy` type-check step to test job
- Added PR template with security checklist

### Infrastructure
- PostgreSQL 12 → 17
- Traefik v2.3 → v2.11
- Backend base image Python 3.10 → 3.11
- Node.js 20 → 22 LTS, nginx 1 → 1.28-alpine
- `adminer` pinned to 4.8.1
- Added `docker compose watch` support for live development

### Developer Experience
- App version `v0.2.0` displayed in sidebar
- `docker compose watch` — backend syncs instantly, frontend rebuilds on change
- Updated README with full local and production deployment guide

### Upgrade Notes

> **Breaking:** `CREDENTIAL_ENCRYPTION_KEY` is now required in `.env`.
> Generate with:
> ```bash
> python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
> ```

> **Breaking:** PostgreSQL 12 → 17 requires dropping the existing data volume:
> ```bash
> docker compose down -v
> docker compose up -d
> ```
