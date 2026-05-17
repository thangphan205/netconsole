# NetConsole

Network management platform for configuring switches, tracking MACs/ARPs/IP interfaces, and managing credentials.

## Features

- **Switches** — inventory with card/list view, TCP health check (UP/DOWN), sync metadata
- **Interfaces** — view status, configure access/trunk mode, shutdown/no shutdown, show running config
- **MAC Addresses** — track MAC table entries with first seen / last seen timestamps
- **ARP Entries** — track ARP table with first seen / last seen timestamps
- **IP Interfaces** — track Layer 3 interface assignments
- **Group Config** — push show/config commands to multiple switches simultaneously via Nornir
- **Credentials** — encrypted SSH credential storage (Fernet)
- **Dashboard** — network summary, new entries over 24h/7d time range
- **Audit Log** — all write operations logged with user, action, IP, timestamp
- **Scheduled sync** — automatic MAC/ARP/IP interface sync and health checks on configurable intervals

## Supported Platforms

| Platform | Driver | Interfaces | MAC/ARP/IP | Group Config |
|---|---|---|---|---|
| Cisco IOS | `ios` | ✅ | ✅ | ✅ |
| Cisco NX-OS | `nxos_ssh` | ✅ | ✅ | ✅ |
| Juniper JunOS | `junos` | ✅ | ✅ | ✅ |
| Arista EOS | `eos` | ✅ | ✅ | ✅ |

## Tech Stack

- **Backend** — FastAPI, SQLModel, PostgreSQL, Alembic, APScheduler
- **Network automation** — Nornir, NAPALM, Netmiko
- **Frontend** — React, Vite, Chakra UI, TanStack Router/Query
- **Deployment** — Docker Compose, Traefik (production)

## Demo

- Video: [https://youtu.be/hVJTylnBLaw](https://youtu.be/hVJTylnBLaw)
- Live demo: <http://netconsole.9ping.cloud>
- Account: `demo@9ping.cloud` / `ahjo2oop4hei9rieCaej`

---

## Prerequisites

- [Docker](https://docs.docker.com/engine/install/) + Docker Compose v2.22+
- Domain name (production only)

---

## Local Development

### 1. Clone

```bash
git clone https://github.com/thangphan205/netconsole
cd netconsole
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and set required values:

| Variable | Description | Generate with |
|---|---|---|
| `SECRET_KEY` | JWT signing key | `python3 -c "import secrets; print(secrets.token_urlsafe(32))"` |
| `FIRST_SUPERUSER_PASSWORD` | Admin password | _(strong password)_ |
| `POSTGRES_PASSWORD` | Database password | `python3 -c "import secrets; print(secrets.token_urlsafe(32))"` |
| `CREDENTIAL_ENCRYPTION_KEY` | Fernet key for device credentials | `python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"` |

### 3. Build and start

```bash
docker compose build
docker compose up -d
```

| Service | URL |
|---|---|
| Web app | <http://localhost> |
| API docs | <http://localhost/docs> |
| DB admin | <http://localhost:8080> |

### 4. Apply migrations

```bash
docker compose exec backend alembic upgrade head
```

### 5. Hot reload (development)

```bash
docker compose watch
```

### Stop

```bash
docker compose down          # keep data
docker compose down -v       # wipe database
```

---

## Production Deployment

### Requirements

- Server with Docker installed
- DNS A record pointing domain to server IP

### 1. Set up Traefik (once per server)

```bash
docker network create traefik-public

export USERNAME=admin
export PASSWORD=your-traefik-password
export HASHED_PASSWORD=$(openssl passwd -apr1 $PASSWORD)
export DOMAIN=yourdomain.com
export EMAIL=you@yourdomain.com

docker compose -f docker-compose.traefik.yml up -d
```

### 2. Deploy

```bash
git clone https://github.com/thangphan205/netconsole
cd netconsole
cp .env.example .env
# Edit .env: set DOMAIN, ENVIRONMENT=production, all secret keys
docker compose build
docker compose up -d
docker compose exec backend alembic upgrade head
```

| Service | URL |
|---|---|
| Web app | `https://yourdomain.com` |
| API docs | `https://yourdomain.com/docs` |
| DB admin | `https://adminer.yourdomain.com` |
| Traefik dashboard | `https://traefik.yourdomain.com` |

### 3. CI/CD

See [deployment.md](./deployment.md) for GitHub Actions setup.

---

## Minimum Switch Configuration

### Cisco IOS / Arista EOS

```
username netconsole privilege 15 secret <DEVICE_PASSWORD>
```

### Cisco NX-OS

```
role name netconsole
  rule 4 permit read-write feature interface
  rule 3 permit read-write feature copy
  rule 2 permit read
  rule 1 permit command show running-config *

username netconsole password <DEVICE_PASSWORD> role netconsole
```

### Juniper JunOS

```
set system login class netconsole-class permissions view
set system login class netconsole-class permissions view-configuration
set system login class netconsole-class permissions configure
set system login user netconsole class netconsole-class
set system login user netconsole authentication plaintext-password
```

### Arista EOS (enable password)

If the device requires enable mode:

```
username netconsole privilege 15 secret <DEVICE_PASSWORD>
enable secret <ENABLE_PASSWORD>
```

Set the enable password in the credential's **Enable Password** field.
