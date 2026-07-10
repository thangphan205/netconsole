# NetConsole

<p align="center">
  <a href="https://fastapi.tiangolo.com"><img src="https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi" alt="FastAPI" /></a>
  <a href="https://react.dev"><img src="https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React" /></a>
  <a href="https://nornir.tech"><img src="https://img.shields.io/badge/Nornir-Automated-3B82F6?style=for-the-badge" alt="Nornir" /></a>
  <a href="https://modelcontextprotocol.io"><img src="https://img.shields.io/badge/MCP-Ready-orange?style=for-the-badge&logo=claude" alt="MCP Ready" /></a>
  <a href="https://www.docker.com"><img src="https://img.shields.io/badge/docker-%230db7ed.svg?style=for-the-badge&logo=docker&logoColor=white" alt="Docker" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-green?style=for-the-badge" alt="License" /></a>
</p>

<p align="center">
  🌐 <a href="README.md">English</a> | <strong>Tiếng Việt</strong>
</p>

---

**NetConsole** là một nền tảng tự động hóa và quản lý thiết bị mạng hiện đại, được thiết kế để đơn giản hóa các hoạt động vận hành mạng. Với giao diện React đẹp mắt và backend FastAPI mạnh mẽ, NetConsole cho phép giám sát, cấu hình và điều phối các thiết bị switch trong môi trường đa hãng (multi-vendor).

### 🤖 Tích hợp sẵn AI-Agent (Model Context Protocol)
NetConsole tích hợp sâu giao thức **Model Context Protocol (MCP)**, chuyển đổi toàn bộ REST API của hệ thống thành các công cụ (tools) bảo mật cho các AI Agent như **Claude Code**, **Claude Desktop** và **Gemini CLI**. Bạn có thể truy vấn trạng thái mạng, tra cứu bảng MAC/ARP, kiểm tra kết nối thiết bị hoặc đẩy cấu hình bằng ngôn ngữ tự nhiên.

---

## 🎥 Video Demo

*   📺 **2025 - Video demo các tính năng chính**: [Xem trên YouTube](https://youtu.be/hVJTylnBLaw)
*   📺 **2026 - Video hướng dẫn triển khai từ A - Z**: [Xem trên YouTube](https://youtu.be/mz_sXdAkB3k)

---

## 📸 Hình ảnh & Sơ đồ kiến trúc

<details>
<summary>🖥️ Xem thư viện giao diện (Dashboard, Switch, Interface, MAC/ARP)</summary>

### Giao diện Dashboard (Chế độ tối)
![Dashboard](img/dashboard-dark.png)

### Quản lý danh sách Switch (Dạng thẻ & danh sách)
![Switches](img/netconsole-switches.png)

### Xem trạng thái & Cấu hình Interface (Cisco / Juniper)
![Interfaces](img/netconsole-interfaces-cisco.png)

### Theo dõi bảng MAC & ARP (Thời điểm phát hiện đầu/cuối)
![MAC Addresses](img/netconsole-mac-addresses.png)
</details>

<details>
<summary>🏗️ Xem sơ đồ kiến trúc & Mô hình triển khai</summary>

### Sơ đồ luồng kiến trúc hệ thống
![System Architecture](img/diagram1.png)

### Mô hình topo triển khai mạng
![Deployment Topology](img/diagram2.png)
</details>

---

## 🚀 Các tính năng nổi bật

*   🔌 **Hỗ trợ đa hãng (Multi-Vendor)**: Tích hợp sẵn driver cho **Cisco IOS**, **Cisco NX-OS**, **Juniper JunOS**, và **Arista EOS** qua NAPALM và Netmiko.
*   🖥️ **Giao diện Dashboard trực quan**: Thiết kế responsive, hỗ trợ giao diện sáng/tối (Chakra UI), hiển thị trạng thái kết nối switch thời gian thực (UP/DOWN TCP check) và số liệu thống kê.
*   🔍 **Tự động cập nhật trạng thái**: Tiến trình nền tự động đồng bộ và lưu lịch sử bảng MAC, ARP cache và thông tin gán IP Interface Layer 3 với mốc thời gian `first_seen` / `last_seen`.
*   ⚡ **Cấu hình nhóm hàng loạt (Group Config)**: Đẩy lệnh cấu hình hoặc truy vấn đồng thời tới hàng trăm switch cùng lúc, được tăng tốc bởi các tiến trình song song của **Nornir**.
*   🔒 **Bảo mật cấp doanh nghiệp**:
    *   **Mã hóa thông tin xác thực**: Mật khẩu SSH thiết bị được mã hóa an toàn ở chế độ lưu trữ bằng Fernet.
    *   **Phân quyền API Key**: Tạo khóa API phân quyền read-only hoặc read-write cho các service account và AI Agent.
    *   **Audit Log chi tiết**: Mọi hoạt động ghi, thay đổi cấu hình đều được ghi nhật ký kèm thông tin tài khoản, hành động, IP nguồn và thời gian.
*   📅 **Lập lịch tự động**: Tùy chỉnh tần suất tự động đồng bộ và kiểm tra trạng thái thiết bị theo khoảng thời gian linh hoạt.

---

## 🔌 Nền tảng hỗ trợ

| Thiết bị | Driver | Interfaces | MAC / ARP / IP | Group Config |
|---|---|---|---|---|
| **Cisco IOS** | `ios` | ✅ | ✅ | ✅ |
| **Cisco NX-OS** | `nxos_ssh` | ✅ | ✅ | ✅ |
| **Juniper JunOS** | `junos` | ✅ | ✅ | ✅ |
| **Arista EOS** | `eos` | ✅ | ✅ | ✅ |

---

## 🛠️ Công nghệ sử dụng

*   **Backend**: FastAPI, SQLModel (SQLAlchemy), PostgreSQL, Alembic (Migration), APScheduler
*   **Tự động hóa mạng**: Nornir, NAPALM, Netmiko
*   **Frontend**: React, Vite, Chakra UI, TanStack Router & Query
*   **Triển khai**: Docker Compose, Traefik (tự động cấp SSL Let's Encrypt)

---

## ⚙️ Yêu cầu hệ thống

*   [Docker](https://docs.docker.com/engine/install/) + Docker Compose v2.22+
*   Tên miền và bản ghi DNS A trỏ về IP máy chủ (khi triển khai Production)

---

## 💻 Phát triển cục bộ (Local Development)

### 1. Clone Source Code

```bash
git clone https://github.com/thangphan205/netconsole.git
cd netconsole
```

### 2. Cấu hình môi trường

```bash
cp .env.example .env
```

Mở `.env` và thiết lập các biến môi trường. Bạn có thể sử dụng các lệnh sau để tạo các khóa bảo mật ngẫu nhiên:

| Biến | Mô tả | Lệnh tạo khóa |
|---|---|---|
| `SECRET_KEY` | Khóa ký JWT | `python3 -c "import secrets; print(secrets.token_urlsafe(32))"` |
| `FIRST_SUPERUSER_PASSWORD` | Mật khẩu tài khoản admin khởi tạo | *Chọn mật khẩu đủ mạnh* |
| `POSTGRES_PASSWORD` | Mật khẩu cơ sở dữ liệu PostgreSQL | `python3 -c "import secrets; print(secrets.token_urlsafe(32))"` |
| `CREDENTIAL_ENCRYPTION_KEY` | Khóa Fernet dùng để mã hóa mật khẩu thiết bị | `python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"` |

### 3. Build & Khởi động Container

```bash
docker compose build
docker compose up -d
```

| Dịch vụ | URL truy cập |
|---|---|
| **Ứng dụng Web** | [http://localhost](http://localhost) |
| **Tài liệu API (Swagger UI)** | [http://localhost/docs](http://localhost/docs) |
| **Quản trị Database (Adminer)** | [http://localhost:8080](http://localhost:8080) |

### 4. Chạy Database Migration

```bash
docker compose exec backend alembic upgrade head
```

### 5. Bật chế độ Hot-Reload khi lập trình

```bash
docker compose watch
```

### Dừng các dịch vụ

*   **Giữ lại dữ liệu**: `docker compose down`
*   **Xóa sạch cơ sở dữ liệu**: `docker compose down -v`

---

## 🤖 MCP Server (Tích hợp AI Agent)

Thư mục `mcp_server/` chứa cấu hình export REST API của NetConsole thành các tool chuẩn [MCP](https://modelcontextprotocol.io). Điều này giúp các AI Agent (như Claude Desktop, Claude Code, Gemini CLI) có thể đọc trạng thái mạng và chạy lệnh cấu hình trực tiếp.

> [!WARNING]
> MCP Server có toàn quyền đọc/ghi bao gồm cả chức năng `push_group_config` để gửi cấu hình trực tiếp tới các switch thật mà không có chế độ dry-run hay rollback. Vui lòng đọc kỹ [mcp_server/README.md](mcp_server/README.md) trước khi bật.

### 1. Tạo API Key trên Giao diện

1. Đăng nhập bằng tài khoản **superuser**.
2. Truy cập menu **API Keys** ở thanh bên (sidebar).
3. Bấm **+ Add ApiKey**, đặt tên, chọn quyền (`Read-write` hoặc `Read-only`).
4. Sao chép API key hiển thị trên màn hình (chỉ hiển thị một lần duy nhất).

*Lưu ý: API key `Read-only` sẽ nhận phản hồi `403 Forbidden` khi thực hiện các tác vụ thay đổi (POST/PUT/DELETE).*

#### Tạo API Key thông qua Curl

```bash
TOKEN=$(curl -s -X POST http://localhost/api/v1/login/access-token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=<superuser-email>&password=<superuser-password>" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

curl -s -X POST http://localhost/api/v1/api-keys/ \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"claude-mcp","role":"read_write"}'
```

### 2. Cấu hình và Chạy MCP Server

#### Thiết lập biến môi trường

Trước khi bắt đầu, bạn cần khai báo API URL và API Key trong cửa sổ terminal. Chọn lệnh phù hợp với Hệ điều hành và Shell bạn đang dùng:

*   **Linux / macOS / Git Bash**:
    ```bash
    export NETCONSOLE_API_URL="http://localhost/api/v1"
    export NETCONSOLE_API_KEY="ncmcp_..."
    ```
*   **Windows (PowerShell)**:
    ```powershell
    $env:NETCONSOLE_API_URL="http://localhost/api/v1"
    $env:NETCONSOLE_API_KEY="ncmcp_..."
    ```
*   **Windows (Command Prompt)**:
    ```cmd
    set NETCONSOLE_API_URL=http://localhost/api/v1
    set NETCONSOLE_API_KEY=ncmcp_...
    ```

Sau đó, tiến hành cài đặt phụ thuộc:

```bash
cd mcp_server
uv sync
```

*   **Claude Code**: Đã có sẵn file cấu hình `.mcp.json` ở thư mục gốc. Hệ thống tự động nạp `NETCONSOLE_API_URL` và `NETCONSOLE_API_KEY` từ môi trường shell. Chỉ cần thiết lập các biến môi trường này theo hướng dẫn ở trên trước khi khởi động Claude Code.
*   **Claude Desktop**: Thêm cấu hình mcpServer vào file `claude_desktop_config.json`:
    ```json
    {
      "mcpServers": {
        "netconsole": {
          "command": "uv",
          "args": ["--directory", "/đường_dẫn_tuyệt_đối_tới/netconsole/mcp_server", "run", "python", "-m", "netconsole_mcp"],
          "env": {
            "NETCONSOLE_API_URL": "http://localhost/api/v1",
            "NETCONSOLE_API_KEY": "ncmcp_..."
          }
        }
      }
    }
    ```
*   **Gemini CLI**: Cấu hình tương tự trong `.gemini/settings.json` hoặc `~/.gemini/settings.json`:
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

Để xem danh sách đầy đủ các tool, cách thu hồi API Key và xử lý sự cố, xem thêm tại [mcp_server/README.md](mcp_server/README.md).

---

## 🚢 Triển khai Production

### Yêu cầu
*   Máy chủ Linux đã cài đặt Docker và Docker Compose.
*   Tên miền đã được trỏ bản ghi DNS A về địa chỉ IP máy chủ.

### 1. Khởi tạo Traefik Reverse Proxy (Một lần duy nhất trên máy chủ)

```bash
docker network create traefik-public

export USERNAME=admin
export PASSWORD=your-traefik-password
export HASHED_PASSWORD=$(openssl passwd -apr1 $PASSWORD)
export DOMAIN=yourdomain.com
export EMAIL=you@yourdomain.com

docker compose -f docker-compose.traefik.yml up -d
```

### 2. Triển khai NetConsole

```bash
git clone https://github.com/thangphan205/netconsole.git
cd netconsole
cp .env.example .env
# Chỉnh sửa .env: Điền DOMAIN, ENVIRONMENT=production và tạo các khóa bảo mật
docker compose build
docker compose up -d
docker compose exec backend alembic upgrade head
```

| Dịch vụ | URL công khai |
|---|---|
| **Web App** | `https://yourdomain.com` |
| **Tài liệu API** | `https://yourdomain.com/docs` |
| **Quản trị CSDL** | `https://adminer.yourdomain.com` |
| **Bảng điều khiển Traefik** | `https://traefik.yourdomain.com` |

### 3. Tích hợp CI/CD

Để tự động triển khai mã nguồn thông qua GitHub Actions, tham khảo [deployment.md](./deployment.md).

---

## 🔌 Cấu hình tối thiểu trên Switch

Cần chắc chắn các thiết bị Switch được phân quyền truy cập phù hợp:

### Cisco IOS / Arista EOS
```config
username netconsole privilege 15 secret <DEVICE_PASSWORD>
```

### Cisco NX-OS
```config
role name netconsole
  rule 4 permit read-write feature interface
  rule 3 permit read-write feature copy
  rule 2 permit read
  rule 1 permit command show running-config *

username netconsole password <DEVICE_PASSWORD> role netconsole
```

### Juniper JunOS
```config
set system login class netconsole-class permissions view
set system login class netconsole-class permissions view-configuration
set system login class netconsole-class permissions configure
set system login user netconsole class netconsole-class
set system login user netconsole authentication plaintext-password
```

### Arista EOS (Với Enable Mật khẩu)
Nếu thiết bị cần nâng quyền enable thủ công:
```config
username netconsole privilege 15 secret <DEVICE_PASSWORD>
enable secret <ENABLE_PASSWORD>
```
Khai báo enable password này trong mục **Enable Password** khi thêm Credential trên NetConsole.
