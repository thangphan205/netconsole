"""Subnet-scan switch discovery: TCP sweep, SSH platform autodetect, facts."""

import ipaddress
import re
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any

import napalm
from netmiko import SSHDetect
from netmiko.exceptions import (
    NetmikoAuthenticationException,
    NetmikoTimeoutException,
)

from app.automation.health import _tcp_check
from app.automation.switches import is_auth_error

# SSHDetect device_type -> (platform, device_type) as stored on Switch
PLATFORM_MAP: dict[str, tuple[str, str]] = {
    "cisco_ios": ("ios", "cisco_ios"),
    "cisco_xe": ("ios", "cisco_ios"),
    "cisco_nxos": ("nxos_ssh", "cisco_nxos"),
    "juniper": ("junos", "juniper_junos"),
    "juniper_junos": ("junos", "juniper_junos"),
    "arista_eos": ("eos", "arista_eos"),
}

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
        optional_args={"port": port},
    )
    try:
        device.open()
        return dict(device.get_facts())
    finally:
        try:
            device.close()
        except Exception:
            pass


def identify_host(ip: str, port: int, credentials: list[dict]) -> dict[str, Any]:
    """Try credentials in order: SSH-autodetect platform, then pull NAPALM facts.

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
    last_error = ""
    for cred in credentials:
        try:
            guesser = SSHDetect(
                device_type="autodetect",
                host=ip,
                port=port,
                username=cred["username"],
                password=cred["password"],
                conn_timeout=10,
                banner_timeout=15,
                auth_timeout=15,
            )
            detected = guesser.autodetect()
            try:
                guesser.connection.disconnect()
            except Exception:
                pass
            winning_cred = cred
            break
        except NetmikoAuthenticationException as exc:
            last_error = str(exc)
            continue
        except NetmikoTimeoutException as exc:
            candidate["status"] = "unreachable"
            candidate["error"] = str(exc)
            return candidate
        except Exception as exc:
            if is_auth_error(exc):
                last_error = str(exc)
                continue
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
        return candidate

    platform, device_type = PLATFORM_MAP[detected]
    candidate["platform"] = platform
    candidate["device_type"] = device_type
    candidate["status"] = "identified"

    try:
        facts = _get_facts(ip, port, platform, winning_cred)
        raw_hostname = str(facts.get("hostname") or "")
        candidate["raw_hostname"] = raw_hostname or None
        candidate["hostname"] = (
            sanitize_hostname(raw_hostname) if raw_hostname else None
        )
        candidate["vendor"] = facts.get("vendor") or None
        candidate["model"] = facts.get("model") or None
        candidate["os_version"] = str(facts.get("os_version") or "") or None
        candidate["serial_number"] = facts.get("serial_number") or None
    except Exception as exc:
        # Platform detection succeeded; facts are best-effort
        candidate["error"] = f"get_facts failed: {exc}"

    return candidate


def identify_hosts_parallel(
    ips: list[str], port: int, credentials: list[dict], max_workers: int = 5
) -> list[dict[str, Any]]:
    results: list[dict[str, Any]] = []
    with ThreadPoolExecutor(max_workers=max_workers) as pool:
        futures = {pool.submit(identify_host, ip, port, credentials): ip for ip in ips}
        for future in as_completed(futures):
            results.append(future.result())
    return sorted(results, key=lambda c: ipaddress.ip_address(c["ip"]))
