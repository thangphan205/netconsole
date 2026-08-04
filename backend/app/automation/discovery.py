"""Subnet-scan device discovery: TCP sweep, SSH platform detect, facts."""

import ipaddress
import re
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any

import napalm
import paramiko

from app.automation.devices import is_auth_error
from app.automation.health import _tcp_check

# Netmiko device_type -> (platform, device_type) as stored on Device
PLATFORM_MAP: dict[str, tuple[str, str]] = {
    "cisco_ios": ("ios", "cisco_ios"),
    "cisco_xe": ("ios", "cisco_ios"),
    "cisco_nxos": ("nxos_ssh", "cisco_nxos"),
    "juniper_junos": ("junos", "juniper_junos"),
    "arista_eos": ("eos", "arista_eos"),
}

# Patterns in "show version" output -> Netmiko device_type
_VERSION_PATTERNS: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"Junos|JUNOS|juniper", re.IGNORECASE), "juniper_junos"),
    (re.compile(r"Cisco IOS XE|IOS-XE", re.IGNORECASE), "cisco_xe"),
    (re.compile(r"NX-OS|Nexus", re.IGNORECASE), "cisco_nxos"),
    (re.compile(r"Arista|EOS", re.IGNORECASE), "arista_eos"),
    (
        re.compile(r"Cisco IOS Software|IOS Software|cisco_ios", re.IGNORECASE),
        "cisco_ios",
    ),
]

MAX_SCAN_HOSTS = 1024


def expand_cidr(cidr: str, max_hosts: int = MAX_SCAN_HOSTS) -> list[str]:
    """Expand a CIDR into usable host IPs. Raises ValueError on bad input."""
    try:
        network = ipaddress.ip_network(cidr.strip(), strict=False)
    except ValueError:
        raise ValueError(f"Invalid CIDR: {cidr}")
    if network.version != 4:
        raise ValueError("Only IPv4 subnets are supported")
    hosts = [str(h) for h in network.hosts()]
    if not hosts:
        hosts = [str(network.network_address)]
    if len(hosts) > max_hosts:
        raise ValueError(
            f"Subnet too large: {len(hosts)} hosts (max {max_hosts}, use /22 or smaller)"
        )
    return hosts


def sanitize_hostname(raw: str) -> str:
    """Device hostname -> valid netconsole hostname ([a-zA-Z0-9_])."""
    return re.sub(r"[^a-zA-Z0-9_]", "_", raw.split(".")[0])


def _prompt_to_hostname(prompt: str) -> str:
    """Netmiko base prompt (e.g. 'user@switch>', 'switch#') -> bare hostname."""
    prompt = prompt.strip()
    if "@" in prompt:
        prompt = prompt.rsplit("@", 1)[1]
    return prompt.rstrip("#>$%: ")


def scan_subnet(
    ips: list[str], port: int, timeout: float, max_workers: int = 50
) -> list[str]:
    """Return the subset of ips with the SSH port open."""
    open_ips: list[str] = []
    with ThreadPoolExecutor(max_workers=max_workers) as pool:
        futures = {pool.submit(_tcp_check, ip, port, timeout): ip for ip in ips}
        for future in as_completed(futures):
            if future.result():
                open_ips.append(futures[future])
    return sorted(open_ips, key=lambda ip: ipaddress.ip_address(ip))


def _get_facts(ip: str, port: int, platform: str, cred: dict) -> dict[str, Any]:
    driver = napalm.get_network_driver(platform)
    device = driver(
        hostname=ip,
        username=cred["username"],
        password=cred["password"],
        optional_args={"port": port, "timeout": 5},
    )
    try:
        device.open()
        return dict(device.get_facts())
    finally:
        try:
            device.close()
        except Exception:
            pass


def _ssh_detect(
    ip: str, port: int, cred: dict, timeout: int = 5
) -> tuple[str | None, str | None, str]:
    """SSH into the device, run 'show version', and detect platform from output.

    Returns (device_type, prompt_hostname, version_text) on success,
    or (None, None, "") on failure.
    Much faster and more reliable than Netmiko SSHDetect for devices like
    Juniper cRPD that autodetect cannot identify.
    """
    client = paramiko.SSHClient()
    # Trust-on-first-use is inherent to subnet discovery: target IPs are
    # unidentified devices with no pre-shared host key to verify against.
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())  # nosec B507
    try:
        client.connect(
            hostname=ip,
            port=port,
            username=cred["username"],
            password=cred["password"],
            timeout=timeout,
            look_for_keys=False,
            allow_agent=False,
            banner_timeout=timeout,
            auth_timeout=timeout,
        )
        shell = client.invoke_shell()
        time.sleep(1)
        # Read and discard the initial banner/prompt
        if shell.recv_ready():
            banner = shell.recv(65535).decode("utf-8", errors="ignore")
        else:
            banner = ""

        # Extract hostname from the initial prompt
        prompt_hostname: str | None = None
        for line in banner.strip().splitlines():
            line = line.strip()
            if line and re.search(r"[#>$%]$", line):
                prompt_hostname = _prompt_to_hostname(line)
                break

        # Send "show version" and collect output
        shell.sendall(b"show version\n")
        time.sleep(2)
        output = b""
        while shell.recv_ready():
            output += shell.recv(65535)
        version_text = output.decode("utf-8", errors="ignore")

        # Try to extract hostname from output if not found in banner
        if not prompt_hostname:
            for line in version_text.strip().splitlines():
                line = line.strip()
                if re.search(r"[#>$%]$", line):
                    prompt_hostname = _prompt_to_hostname(line)
                    break

        # Match version output against known patterns
        for pattern, device_type in _VERSION_PATTERNS:
            if pattern.search(version_text):
                return device_type, prompt_hostname, version_text

        return None, prompt_hostname, version_text
    except paramiko.AuthenticationException:
        raise
    except paramiko.SSHException as exc:
        raise exc
    except Exception:
        return None, None, ""
    finally:
        try:
            client.close()
        except Exception:
            pass


# Regex helpers to extract info from "show version" output
_RE_MODEL = re.compile(r"Model:\s*(.+)", re.IGNORECASE)
_RE_JUNOS_VER = re.compile(r"Junos:\s*(.+)", re.IGNORECASE)
_RE_IOS_VER = re.compile(r"Version\s+([\w.\(\)]+)", re.IGNORECASE)
_RE_SERIAL = re.compile(
    r"(?:Processor board ID|System serial number|Serial Number)[:\s]+(\S+)",
    re.IGNORECASE,
)


def _parse_version_info(version_text: str) -> dict[str, str | None]:
    """Extract model, os_version, serial_number from raw 'show version' output."""
    info: dict[str, str | None] = {
        "model": None,
        "os_version": None,
        "serial_number": None,
    }
    if not version_text:
        return info

    m = _RE_MODEL.search(version_text)
    if m:
        info["model"] = m.group(1).strip()

    m = _RE_JUNOS_VER.search(version_text)
    if m:
        info["os_version"] = m.group(1).strip()
    else:
        m = _RE_IOS_VER.search(version_text)
        if m:
            info["os_version"] = m.group(1).strip()

    m = _RE_SERIAL.search(version_text)
    if m:
        info["serial_number"] = m.group(1).strip()

    return info


def identify_host(ip: str, port: int, credentials: list[dict]) -> dict[str, Any]:
    """Try credentials in order: SSH into device, run 'show version' to detect
    platform, then pull NAPALM facts.

    credentials: [{"id": int, "username": str, "password": str(plaintext)}]
    """
    candidate: dict[str, Any] = {
        "ip": ip,
        "port": port,
        "status": "auth_failed",
        "platform": None,
        "device_type": None,
        "hostname": None,
        "raw_hostname": None,
        "vendor": None,
        "model": None,
        "os_version": None,
        "serial_number": None,
        "credential_id": None,
        "error": None,
    }

    detected: str | None = None
    winning_cred: dict | None = None
    prompt_hostname: str | None = None
    version_text: str = ""
    last_error = ""
    for cred in credentials:
        try:
            detected, prompt_hostname, version_text = _ssh_detect(ip, port, cred)
            winning_cred = cred
            break
        except paramiko.AuthenticationException as exc:
            last_error = str(exc)
            continue
        except (OSError, paramiko.SSHException) as exc:
            if is_auth_error(exc):
                last_error = str(exc)
                continue
            candidate["status"] = "unreachable"
            candidate["error"] = str(exc)
            return candidate
        except Exception as exc:
            candidate["status"] = "error"
            candidate["error"] = str(exc)
            return candidate

    if winning_cred is None:
        candidate["error"] = last_error or "All credentials failed"
        return candidate

    candidate["credential_id"] = winning_cred["id"]

    if not detected or detected not in PLATFORM_MAP:
        candidate["status"] = "unknown_platform"
        candidate["error"] = (
            f"Unsupported or undetected platform: {detected or 'no match'}"
        )
        # Still fill hostname from prompt if available
        if prompt_hostname:
            candidate["raw_hostname"] = prompt_hostname
            candidate["hostname"] = sanitize_hostname(prompt_hostname)
        return candidate

    platform, device_type = PLATFORM_MAP[detected]
    candidate["platform"] = platform
    candidate["device_type"] = device_type
    candidate["status"] = "identified"

    # Extract info from "show version" output (always available)
    ver_info = _parse_version_info(version_text)

    facts: dict[str, Any] = {}
    try:
        facts = _get_facts(ip, port, platform, winning_cred)
    except Exception as exc:
        # Platform detection succeeded; facts are best-effort (e.g. Junos
        # facts need NETCONF, a separate service from the SSH CLI used for
        # detection, and it's often disabled even when SSH works fine).
        candidate["error"] = f"get_facts failed: {exc}"

    # Merge: prefer NAPALM facts, fall back to parsed "show version" output
    raw_hostname = str(facts.get("hostname") or "") or (prompt_hostname or "")
    candidate["raw_hostname"] = raw_hostname or None
    candidate["hostname"] = sanitize_hostname(raw_hostname) if raw_hostname else None
    candidate["vendor"] = facts.get("vendor") or None
    candidate["model"] = facts.get("model") or ver_info.get("model")
    candidate["os_version"] = str(facts.get("os_version") or "") or ver_info.get(
        "os_version"
    )
    candidate["serial_number"] = facts.get("serial_number") or ver_info.get(
        "serial_number"
    )

    return candidate


def identify_hosts_parallel(
    ips: list[str], port: int, credentials: list[dict], max_workers: int = 16
) -> list[dict[str, Any]]:
    results: list[dict[str, Any]] = []
    with ThreadPoolExecutor(max_workers=max_workers) as pool:
        futures = {pool.submit(identify_host, ip, port, credentials): ip for ip in ips}
        for future in as_completed(futures):
            results.append(future.result())
    return sorted(results, key=lambda c: ipaddress.ip_address(c["ip"]))
