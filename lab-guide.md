# NetConsole Lab Guide — Multipass + Ubuntu 24.04

Step-by-step setup for a local NetConsole instance using Multipass.

---

## Prerequisites

Install [Multipass](https://multipass.run) on your host machine:

- **macOS**: `brew install --cask multipass`
- **Windows**: Download installer from https://multipass.run
- **Linux**: `sudo snap install multipass`

Verify:

```bash
multipass version
```

---

## Step 1 — Create Ubuntu 24.04 VM

```bash
multipass launch 24.04 \
  --name netconsole \
  --cpus 2 \
  --memory 4G \
  --disk 20G
```

Wait for the VM to start, then open a shell:

```bash
multipass shell netconsole
```

All remaining commands run **inside the VM**.

---

## Step 2 — Install Docker

```bash
# Update packages
sudo apt-get update
sudo apt-get install -y ca-certificates curl

# Add Docker GPG key
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

# Add Docker repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] \
  https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io \
  docker-buildx-plugin docker-compose-plugin

# Add current user to docker group (no sudo needed)
sudo usermod -aG docker $USER
newgrp docker
```

Verify:

```bash
docker --version
docker compose version
```

---

## Step 3 — Clone NetConsole

```bash
git clone https://github.com/thangphan205/netconsole
cd netconsole
```

---

## Step 4 — Configure Environment

```bash
cp .env.example .env
```

Generate required secrets:

```bash
# SECRET_KEY
python3 -c "import secrets; print(secrets.token_urlsafe(32))"

# POSTGRES_PASSWORD
python3 -c "import secrets; print(secrets.token_urlsafe(32))"

# CREDENTIAL_ENCRYPTION_KEY
python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

Edit `.env`:

```bash
nano .env
```

Minimum required values to change:

```env
SECRET_KEY=<generated above>
FIRST_SUPERUSER_PASSWORD=<your-admin-password>
POSTGRES_PASSWORD=<generated above>
CREDENTIAL_ENCRYPTION_KEY=<generated above>
```

**Option A — Local lab (Multipass / localhost)**

Leave defaults as-is:

```env
DOMAIN=localhost
ENVIRONMENT=local
```

**Option B — Remote server, access by IP address**

Get the server's public or LAN IP:

```bash
ip route get 1 | awk '{print $7; exit}'   # LAN IP
# or
curl -s ifconfig.me                        # public IP
```

Set in `.env`:

```env
DOMAIN=<server-IP>
ENVIRONMENT=local
```

Also update `BACKEND_CORS_ORIGINS` to allow the IP:

```env
BACKEND_CORS_ORIGINS=http://<server-IP>
```

NetConsole will then be reachable at `http://<server-IP>` from any machine that can reach it. No domain or HTTPS required for lab use.

> **Firewall note**: ensure port 80 is open on the server.
> - Ubuntu UFW: `sudo ufw allow 80/tcp`
> - AWS/GCP/Azure: add inbound rule for port 80 in the security group / firewall rules.

---

## Step 5 — Build and Start

```bash
docker compose build
docker compose up -d
```

Check all containers are running:

```bash
docker compose ps
```

Expected — all services show `running`:

```
NAME                        STATUS
netconsole-backend-1        running
netconsole-frontend-1       running
netconsole-db-1             running
netconsole-traefik-1        running
```

> **Database migrations run automatically** when the backend container starts (`prestart.sh`). No manual step needed.

---

## Step 7 — Get VM IP and Access

Back on your **host machine**:

```bash
multipass info netconsole
```

Note the `IPv4` address (e.g. `192.168.64.10`).

Open in browser:

| Service | URL |
|---|---|
| NetConsole | `http://<VM-IP>` |
| API docs | `http://<VM-IP>/docs` |
| DB admin | `http://<VM-IP>:8080` |

Login with:
- **Email**: value of `FIRST_SUPERUSER` in `.env` (default: `admin@example.com`)
- **Password**: value of `FIRST_SUPERUSER_PASSWORD` you set

---

## Step 8 — Add Device Credentials

Before adding a switch, create credentials it will use.

1. Go to **Credentials** → **Add Credential**
2. Fill in username, password
3. For Cisco IOS / Arista EOS with enable mode, also fill **Enable Password**
4. Credentials are encrypted at rest using the Fernet key from `.env`

---

## Step 9 — Add a Switch

1. Go to **Switches** → **Add Switch**
2. Fill in:

| Field | Description |
|---|---|
| Hostname | Name used in Nornir inventory (e.g. `sw01`) — must match device hostname exactly |
| IP Address | Reachable IP from the VM |
| Platform | `ios` / `nxos_ssh` / `junos` / `eos` |
| Device Type | Matching Netmiko driver (e.g. `cisco_ios`, `arista_eos`) |
| Credential | Select credential created in Step 8 |

3. Save, then click **Check Health** to verify TCP reachability.

---

## Step 10 — Sync Data

On the Switches page, select a switch and:

- **Update Metadata** — pulls system info, MACs, ARPs, IP interfaces via NAPALM
- **Check Health** — TCP ping to verify the switch is reachable

On the **Interfaces** page:

- Select the switch from the dropdown
- Click **Sync Interfaces** — pulls interface status table via Netmiko

---

## Minimum Switch Configuration

### Cisco IOS / Arista EOS

```
username netconsole privilege 15 secret <password>
```

For EOS with enable mode:
```
enable secret <enable-password>
```

### Cisco NX-OS

```
role name netconsole
  rule 4 permit read-write feature interface
  rule 3 permit read-write feature copy
  rule 2 permit read
  rule 1 permit command show running-config *

username netconsole password <password> role netconsole
```

### Juniper JunOS

```
set system login class netconsole-class permissions view
set system login class netconsole-class permissions view-configuration
set system login class netconsole-class permissions configure
set system login user netconsole class netconsole-class
set system login user netconsole authentication plaintext-password
```

---

## Useful Commands

```bash
# View backend logs (live)
docker compose logs -f backend

# Restart backend only
docker compose restart backend

# Stop everything (keep data)
docker compose down

# Stop and wipe database
docker compose down -v

# Open a backend shell
docker compose exec backend bash

# Check current DB migration
docker compose exec backend alembic current

# Reapply migrations
docker compose exec backend alembic upgrade head
```

---

## Managing the VM

From your **host machine**:

```bash
# Suspend (saves state, frees RAM)
multipass suspend netconsole

# Resume
multipass start netconsole

# Delete VM permanently
multipass delete netconsole
multipass purge
```

---

## Troubleshooting

**Backend fails to start**

```bash
docker compose logs backend
```

Common cause: invalid `CREDENTIAL_ENCRYPTION_KEY` — must be a valid Fernet key (44 base64 characters ending in `=`). Regenerate with:

```bash
python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

**Cannot reach the UI from host browser**

```bash
multipass info netconsole   # confirm IP
ping <VM-IP>                # confirm reachability from host
```

On Windows, you may need to allow the Multipass subnet in Windows Firewall.

**Containers not running**

```bash
docker compose up -d        # re-create missing containers
docker compose ps           # check status
```

**Migration errors**

```bash
docker compose exec backend alembic history   # show migration chain
docker compose exec backend alembic current   # show applied revision
```
