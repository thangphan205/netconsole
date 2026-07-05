# NetConsole

🌐 [English](README.md) | Tiếng Việt

Nền tảng quản lý mạng để cấu hình switch, theo dõi MAC/ARP/IP interface và quản lý thông tin xác thực thiết bị.

## Mục lục

- [Tính năng](#tính-năng)
- [Nền tảng hỗ trợ](#nền-tảng-hỗ-trợ)
- [Công nghệ](#công-nghệ)
- [Demo](#demo)
- [Yêu cầu](#yêu-cầu)
- [Phát triển cục bộ](#phát-triển-cục-bộ)
- [MCP Server (tích hợp AI Agent)](#mcp-server-tích-hợp-ai-agent)
- [Triển khai production](#triển-khai-production)
- [Cấu hình tối thiểu cho switch](#cấu-hình-tối-thiểu-cho-switch)

---

## Tính năng

- **Switch** — danh sách thiết bị dạng card/list, kiểm tra kết nối TCP (UP/DOWN), đồng bộ metadata
- **Interface** — xem trạng thái, cấu hình access/trunk mode, shutdown/no shutdown, xem running config
- **MAC Address** — theo dõi bảng MAC với thời điểm phát hiện đầu tiên / lần cuối
- **ARP** — theo dõi bảng ARP với thời điểm phát hiện đầu tiên / lần cuối
- **IP Interface** — theo dõi gán interface Layer 3
- **Group Config** — đẩy lệnh show/config đến nhiều switch cùng lúc qua Nornir
- **Credential** — lưu trữ thông tin SSH được mã hóa bằng Fernet
- **Dashboard** — tóm tắt mạng, số entry mới theo khung 24h/7d
- **Audit Log** — ghi lại toàn bộ thao tác ghi với thông tin user, action, IP, timestamp
- **Đồng bộ tự động** — tự động sync MAC/ARP/IP interface và kiểm tra kết nối theo lịch cấu hình sẵn

---

## Nền tảng hỗ trợ

| Nền tảng | Driver | Interfaces | MAC/ARP/IP | Group Config |
|---|---|---|---|---|
| Cisco IOS | `ios` | ✅ | ✅ | ✅ |
| Cisco NX-OS | `nxos_ssh` | ✅ | ✅ | ✅ |
| Juniper JunOS | `junos` | ✅ | ✅ | ✅ |
| Arista EOS | `eos` | ✅ | ✅ | ✅ |

---

## Công nghệ

- **Backend** — FastAPI, SQLModel, PostgreSQL, Alembic, APScheduler
- **Tự động hóa mạng** — Nornir, NAPALM, Netmiko
- **Frontend** — React, Vite, Chakra UI, TanStack Router/Query
- **Triển khai** — Docker Compose, Traefik (production)

---

## Demo

- 2025 - Video demo tính năng chính: [https://youtu.be/hVJTylnBLaw](https://youtu.be/hVJTylnBLaw)
- 2026 - Video hướng dẫn triển khai từ A - Z: [https://youtu.be/mz_sXdAkB3k](https://youtu.be/mz_sXdAkB3k)

---

## Yêu cầu

- [Docker](https://docs.docker.com/engine/install/) + Docker Compose v2.22+
- Tên miền (chỉ cần cho production)

---

## Phát triển cục bộ

### 1. Clone

```bash
git clone https://github.com/thangphan205/netconsole
cd netconsole
```

### 2. Cấu hình môi trường

```bash
cp .env.example .env
```

Chỉnh sửa `.env` và điền các giá trị bắt buộc:

| Biến | Mô tả | Lệnh tạo |
|---|---|---|
| `SECRET_KEY` | Khóa ký JWT | `python3 -c "import secrets; print(secrets.token_urlsafe(32))"` |
| `FIRST_SUPERUSER_PASSWORD` | Mật khẩu admin | _(mật khẩu mạnh)_ |
| `POSTGRES_PASSWORD` | Mật khẩu database | `python3 -c "import secrets; print(secrets.token_urlsafe(32))"` |
| `CREDENTIAL_ENCRYPTION_KEY` | Khóa Fernet mã hóa credential thiết bị | `python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"` |

### 3. Build và khởi động

```bash
docker compose build
docker compose up -d
```

| Dịch vụ | URL |
|---|---|
| Ứng dụng web | <http://localhost> |
| API docs | <http://localhost/docs> |
| Quản trị DB | <http://localhost:8080> |

### 4. Áp dụng migration

```bash
docker compose exec backend alembic upgrade head
```

### 5. Hot reload (development)

```bash
docker compose watch
```

### Dừng

```bash
docker compose down          # giữ nguyên dữ liệu
docker compose down -v       # xóa toàn bộ database
```

---

## MCP Server (tích hợp AI Agent)

`mcp_server/` expose REST API của NetConsole thành các tool [MCP](https://modelcontextprotocol.io), cho phép AI agent (Claude Desktop, Claude Code, Gemini CLI, ...) truy vấn và thao tác switch/interface/MAC/ARP/credential/group trực tiếp. Chạy dưới dạng process stdio cục bộ — không cần thêm container.

⚠️ **Scope đầy đủ read/write**, bao gồm `push_group_config` — đẩy lệnh show/config thô đến thiết bị thật, không có dry-run, không rollback. Đọc `mcp_server/README.md` trước khi bật tính năng này với switch production.

### 1. Tạo API key cho service account

```bash
# Đăng nhập bằng tài khoản superuser có sẵn
TOKEN=$(curl -s -X POST http://localhost/api/v1/login/access-token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=<superuser-email>&password=<superuser-password>" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

# Tạo service account (không đăng nhập tương tác được)
SERVICE_USER_ID=$(curl -s -X POST http://localhost/api/v1/users/ \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"email":"mcp-service@netconsole.local","password":"<throwaway>","is_superuser":true,"password_login_enabled":false}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")

# Tạo API key cho service account (chỉ hiển thị một lần)
curl -s -X POST http://localhost/api/v1/api-keys/ \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"name\":\"claude-mcp\",\"user_id\":$SERVICE_USER_ID}"
```

### 2. Cấu hình và chạy

```bash
cd mcp_server
uv sync
export NETCONSOLE_API_URL=http://localhost/api/v1
export NETCONSOLE_API_KEY=ncmcp_...   # key vừa tạo ở trên
```

- **Claude Code** — file `.mcp.json` ở thư mục gốc repo đã có sẵn, đọc `NETCONSOLE_API_KEY` từ biến môi trường shell. Chỉ cần `export` key rồi khởi động lại Claude Code.
- **Claude Desktop** — thêm entry `netconsole` vào `claude_desktop_config.json` trỏ đến `mcp_server` (xem cấu hình mẫu trong `mcp_server/README.md`).
- **Gemini CLI** — cùng cấu trúc config, thêm vào `.gemini/settings.json` (xem `mcp_server/README.md`).

Danh sách đầy đủ tool, cách thu hồi key, và xử lý sự cố: [mcp_server/README.md](mcp_server/README.md).

---

## Triển khai production

### Yêu cầu

- Server đã cài Docker
- Bản ghi DNS A trỏ tên miền về IP server

### 1. Cài đặt Traefik (một lần duy nhất trên mỗi server)

```bash
docker network create traefik-public

export USERNAME=admin
export PASSWORD=your-traefik-password
export HASHED_PASSWORD=$(openssl passwd -apr1 $PASSWORD)
export DOMAIN=yourdomain.com
export EMAIL=you@yourdomain.com

docker compose -f docker-compose.traefik.yml up -d
```

### 2. Triển khai

```bash
git clone https://github.com/thangphan205/netconsole
cd netconsole
cp .env.example .env
# Chỉnh .env: set DOMAIN, ENVIRONMENT=production và các secret key
docker compose build
docker compose up -d
docker compose exec backend alembic upgrade head
```

| Dịch vụ | URL |
|---|---|
| Ứng dụng web | `https://yourdomain.com` |
| API docs | `https://yourdomain.com/docs` |
| Quản trị DB | `https://adminer.yourdomain.com` |
| Traefik dashboard | `https://traefik.yourdomain.com` |

### 3. CI/CD

Xem [deployment.md](./deployment.md) để cài đặt GitHub Actions.

---

## Cấu hình tối thiểu cho switch

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

Nếu thiết bị yêu cầu enable mode:

```
username netconsole privilege 15 secret <DEVICE_PASSWORD>
enable secret <ENABLE_PASSWORD>
```

Điền enable password vào trường **Enable Password** khi tạo credential.
