# Hướng dẫn Lab NetConsole — Multipass + Ubuntu 26.04

Hướng dẫn từng bước cài đặt NetConsole trên máy ảo Multipass.

---

## Yêu cầu chuẩn bị

Cài [Multipass](https://multipass.run) trên máy host:

- **macOS**: `brew install --cask multipass`
- **Windows**: Tải installer tại https://multipass.run
- **Linux**: `sudo snap install multipass`

Kiểm tra:

```bash
multipass version
```

---

## Bước 1 — Tạo máy ảo Ubuntu 26.04

```bash
multipass launch 26.04 \
  --name netconsole \
  --cpus 2 \
  --memory 4G \
  --disk 20G
```

Chờ máy ảo khởi động xong, sau đó mở shell vào trong:

```bash
multipass shell netconsole
```

Tất cả các lệnh tiếp theo chạy **bên trong máy ảo**.

---

## Bước 2 — Cài Docker

```bash
# Cập nhật package và cài các gói cần thiết
sudo apt update
sudo apt install -y ca-certificates curl

# Thêm GPG key của Docker
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

# Thêm repository Docker (format DEB822 — chuẩn mới từ Ubuntu 24.04+)
sudo tee /etc/apt/sources.list.d/docker.sources <<EOF
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}")
Components: stable
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/docker.asc
EOF

# Cài Docker
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io \
  docker-buildx-plugin docker-compose-plugin

# Cho phép user hiện tại chạy Docker không cần sudo
sudo usermod -aG docker $USER
newgrp docker
```

Kiểm tra:

```bash
docker --version
docker compose version
```

---

## Bước 3 — Clone mã nguồn NetConsole

```bash
git clone https://github.com/thangphan205/netconsole
cd netconsole
```

---

## Bước 4 — Cấu hình môi trường

```bash
cp .env.example .env
```

Tạo các giá trị bí mật cần thiết:

```bash
# SECRET_KEY
python3 -c "import secrets; print(secrets.token_urlsafe(32))"

# POSTGRES_PASSWORD
python3 -c "import secrets; print(secrets.token_urlsafe(32))"

# CREDENTIAL_ENCRYPTION_KEY
python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

Mở file `.env` để chỉnh sửa:

```bash
nano .env
```

Các giá trị bắt buộc phải thay đổi:

```env
SECRET_KEY=<giá trị đã tạo ở trên>
FIRST_SUPERUSER_PASSWORD=<mật-khẩu-admin>
POSTGRES_PASSWORD=<giá trị đã tạo ở trên>
CREDENTIAL_ENCRYPTION_KEY=<giá trị đã tạo ở trên>
```

**Tùy chọn A — Lab local (Multipass / localhost)**

Giữ nguyên giá trị mặc định:

```env
DOMAIN=localhost
ENVIRONMENT=local
```

**Tùy chọn B — Máy chủ từ xa, truy cập qua địa chỉ IP**

Lấy địa chỉ IP của máy chủ:

```bash
ip route get 1 | awk '{print $7; exit}'   # IP trong mạng LAN
# hoặc
curl -s ifconfig.me                        # IP public
```

Cập nhật trong `.env`:

```env
DOMAIN=<địa-chỉ-IP-máy-chủ>
ENVIRONMENT=local
BACKEND_CORS_ORIGINS=http://<địa-chỉ-IP-máy-chủ>
```

> **Dùng IP làm DOMAIN có hoạt động không?** — **Có.** Traefik dùng HTTP `Host` header để định tuyến request, không phải DNS lookup. Khi trình duyệt gọi `http://192.168.64.10`, header `Host: 192.168.64.10` được gửi đi, và Traefik khớp đúng với `DOMAIN=192.168.64.10`.
>
> **Quan trọng**: phải giữ `ENVIRONMENT=local`. Nếu đặt `ENVIRONMENT=production`, hệ thống sẽ tự redirect sang HTTPS — không có SSL cert cho IP nên kết nối sẽ thất bại.

NetConsole sẽ truy cập được tại `http://<IP-máy-chủ>` từ bất kỳ máy nào trong mạng.

> **Lưu ý firewall**: mở port 80 trên máy chủ.
> - Ubuntu UFW: `sudo ufw allow 80/tcp`
> - AWS/GCP/Azure: thêm inbound rule cho port 80 trong Security Group / Firewall Rules.

---

## Bước 5 — Build và khởi động

```bash
docker compose build
docker compose up -d
```

Kiểm tra trạng thái các container:

```bash
docker compose ps
```

Kết quả mong đợi — tất cả hiển thị `running`:

```
NAME                        STATUS
netconsole-backend-1        running
netconsole-frontend-1       running
netconsole-db-1             running
netconsole-traefik-1        running
```

> **Migration cơ sở dữ liệu chạy tự động** khi backend container khởi động (`prestart.sh`). Không cần chạy thủ công.

---

## Bước 7 — Lấy IP và truy cập giao diện

Quay lại **máy host**:

```bash
multipass info netconsole
```

Ghi lại địa chỉ `IPv4` (ví dụ: `192.168.64.10`).

Mở trình duyệt:

| Dịch vụ | URL |
|---|---|
| NetConsole | `http://<IP-máy-ảo>` |
| API docs | `http://<IP-máy-ảo>/docs` |
| Quản lý DB | `http://<IP-máy-ảo>:8080` |

Đăng nhập:
- **Email**: giá trị `FIRST_SUPERUSER` trong `.env` (mặc định: `admin@example.com`)
- **Mật khẩu**: giá trị `FIRST_SUPERUSER_PASSWORD` đã đặt

---

## Bước 8 — Cài ContainerLab & Tạo Arista cEOS Lab

> Bước này giúp tạo switch ảo Arista cEOS ngay trên VM để test NetConsole mà không cần thiết bị thật.

### 8.1 — Cài ContainerLab

Chạy trong VM (Docker đã phải có từ Bước 2):

```bash
curl -sL https://containerlab.dev/setup | sudo -E bash -s "all"
```

Kiểm tra:

```bash
containerlab version
```

### 8.2 — Tải và import Arista cEOS image

cEOS yêu cầu đăng ký tài khoản miễn phí tại [arista.com](https://www.arista.com/en/support/software-download) → tải file `cEOS64-lab-<version>.tar.xz`.

Chuyển file vào VM rồi import:

```bash
# Ví dụ với cEOS 4.32.0
docker import cEOSarm-lab-4.36.0.1F.tar ceos:4.36.0.1F
```

Xác nhận image đã có:

```bash
docker images | grep ceos
```

### 8.3 — Tạo topology file

```bash
mkdir -p ~/clab && cat > ~/clab/netconsole.clab.yml << 'EOF'
name: netconsole

mgmt:
  network: clab-mgmt
  ipv4-subnet: 172.20.20.0/24

topology:
  nodes:
    arista1:
      kind: ceos
      image: ceos:4.36.0.1F
      mgmt-ipv4: 172.20.20.11
    arista2:
      kind: ceos
      image: ceos:4.36.0.1F
      mgmt-ipv4: 172.20.20.12

  links:
    - endpoints: ["arista1:eth1", "arista2:eth1"]
EOF
```

### 8.4 — Khởi động lab

```bash
cd ~/clab
sudo containerlab deploy -t netconsole.clab.yml
```

Xem IP và trạng thái các node:

```bash
sudo containerlab inspect -t netconsole.clab.yml
```

Kết quả mẫu:

```
+---+------------------+--------------+----------------+-------+
| # | Name             | Kind         | Mgmt IPv4      | State |
+---+------------------+--------------+----------------+-------+
| 1 | clab-netconsole-arista1 | ceos     | 172.20.20.11   | running |
| 2 | clab-netconsole-arista2 | ceos     | 172.20.20.12   | running |
+---+------------------+--------------+----------------+-------+
```

### 8.5 — Cấu hình cEOS cho NetConsole

Vào CLI của từng switch:

```bash
docker exec -it clab-netconsole-arista1 Cli
```

Cấu hình tối thiểu:

```
configure
!
username netconsole privilege 15 secret netconsole
!
management api http-commands
   no shutdown
!
management ssh
   idle-timeout 0
   authentication mode password
   no shutdown
!
end
write memory
```

Kiểm tra SSH từ VM:

```bash
ssh netconsole@172.20.20.11   # password: netconsole
```

### 8.6 — Các lệnh quản lý lab

```bash
# Xem trạng thái
sudo containerlab inspect -t ~/clab/netconsole.clab.yml

# Dừng lab (giữ config)
sudo containerlab save -t ~/clab/netconsole.clab.yml
sudo containerlab destroy -t ~/clab/netconsole.clab.yml

# Khởi động lại
sudo containerlab deploy -t ~/clab/netconsole.clab.yml
```

---

## Bước 9 — Thêm thông tin đăng nhập thiết bị

Cần tạo credential trước khi thêm switch.

1. Vào **Credentials** → **Add Credential**
2. Điền username, password
3. Với Cisco IOS / Arista EOS có enable mode, điền thêm **Enable Password**
4. Credential được mã hóa bằng Fernet key trong `.env`

---

## Bước 10 — Thêm Switch

1. Vào **Switches** → **Add Switch**
2. Điền thông tin:

| Trường | Mô tả |
|---|---|
| Hostname | Tên dùng trong inventory Nornir (ví dụ: `sw01`) — phải khớp chính xác với hostname thiết bị |
| IP Address | IP có thể kết nối được từ máy ảo |
| Platform | `ios` / `nxos_ssh` / `junos` / `eos` |
| Device Type | Driver Netmiko tương ứng (ví dụ: `cisco_ios`, `arista_eos`) |
| Credential | Chọn credential đã tạo ở Bước 9 |

3. Lưu lại, sau đó click **Check Health** để kiểm tra kết nối TCP.

---

## Bước 11 — Đồng bộ dữ liệu

Trên trang Switches, chọn switch và:

- **Update Metadata** — kéo thông tin hệ thống, MAC, ARP, IP interfaces qua NAPALM
- **Check Health** — kiểm tra kết nối TCP đến thiết bị

Trên trang **Interfaces**:

- Chọn switch từ dropdown
- Click **Sync Interfaces** — kéo bảng trạng thái interface qua Netmiko

---

## Cấu hình tối thiểu trên thiết bị

### Cisco IOS / Arista EOS

```
username netconsole privilege 15 secret <password>
```

Nếu EOS cần enable mode:
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

## Các lệnh thường dùng

```bash
# Xem log backend (real-time)
docker compose logs -f backend

# Khởi động lại backend
docker compose restart backend

# Dừng tất cả (giữ dữ liệu)
docker compose down

# Dừng và xóa toàn bộ dữ liệu
docker compose down -v

# Mở shell vào backend
docker compose exec backend bash

# Kiểm tra migration hiện tại
docker compose exec backend alembic current

# Áp dụng lại migration
docker compose exec backend alembic upgrade head
```

---

## Quản lý máy ảo

Từ **máy host**:

```bash
# Tạm dừng (lưu trạng thái, giải phóng RAM)
multipass suspend netconsole

# Tiếp tục
multipass start netconsole

# Xóa máy ảo vĩnh viễn
multipass delete netconsole
multipass purge
```

---

## Xử lý sự cố

**Backend không khởi động được**

```bash
docker compose logs backend
```

Nguyên nhân thường gặp: `CREDENTIAL_ENCRYPTION_KEY` không hợp lệ — phải là Fernet key đúng định dạng (44 ký tự base64, kết thúc bằng `=`). Tạo lại:

```bash
python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

**Không truy cập được giao diện từ máy host**

```bash
multipass info netconsole   # kiểm tra IP
ping <IP-máy-ảo>            # kiểm tra kết nối từ host
```

Trên Windows, có thể cần thêm rule cho subnet Multipass trong Windows Firewall.

**Container không chạy**

```bash
docker compose up -d        # tạo lại container bị thiếu
docker compose ps           # kiểm tra trạng thái
```

**Lỗi migration**

```bash
docker compose exec backend alembic history   # xem chuỗi migration
docker compose exec backend alembic current   # xem revision đang áp dụng
```
