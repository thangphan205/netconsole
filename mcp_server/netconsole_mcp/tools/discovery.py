from ..client import client
from ..server import mcp

# Scan + SSH identify are slow (per-host SSH connects); override the default
# client timeout so these calls don't abort mid-scan.
DISCOVERY_TIMEOUT = 180.0


@mcp.tool()
async def discover_devices(cidr: str, port: int = 22, tcp_timeout: float = 1.0) -> dict:
    """
    Scan a subnet (CIDR, e.g. "10.0.0.0/24") for hosts with the SSH port open.
    Returns {cidr, total_hosts, open_count, hosts:[{ip, port, existing,
    existing_device_id, existing_hostname}]}. IPv4 only; subnets larger than
    /22 (>1024 hosts) are rejected. This only TCP-probes the port — it does not
    log in. Follow with identify_discovered_devices on the open, non-existing
    IPs. Superuser API key required.
    """
    return await client.post(
        "/devices/discovery/scan",
        json={"cidr": cidr, "port": port, "tcp_timeout": tcp_timeout},
        timeout=DISCOVERY_TIMEOUT,
    )


@mcp.tool()
async def identify_discovered_devices(
    ips: list[str], credential_ids: list[int], port: int = 22
) -> dict:
    """
    SSH into up to 8 IPs at a time: try each credential (by id) in order,
    autodetect the platform (Netmiko SSHDetect) and pull device facts (NAPALM
    get_facts). Returns {candidates:[{ip, status, platform, device_type,
    hostname, raw_hostname, vendor, model, os_version, serial_number,
    credential_id, error}]}. status is one of identified/auth_failed/
    unreachable/unknown_platform/error. Already-registered IPs are skipped.
    Pass at most 8 ips per call (chunk larger scan results). Superuser required.
    """
    return await client.post(
        "/devices/discovery/identify",
        json={"ips": ips, "credential_ids": credential_ids, "port": port},
        timeout=DISCOVERY_TIMEOUT,
    )


@mcp.tool()
async def bulk_add_discovered_devices(devices: list[dict]) -> dict:
    """
    Bulk-add reviewed discovery candidates as devices. Each dict is a device:
    {hostname (required, [a-zA-Z0-9_] only), ipaddress (required), port,
    platform (ios|nxos_ssh|junos|eos), device_type (cisco_ios|cisco_nxos|
    juniper_junos|arista_eos), vendor, model, os_version, serial_number,
    credential_id, groups (comma-joined)}. Per-row validation; valid rows are
    inserted with one commit and one inventory regen. Returns {created:[...],
    errors:[{hostname, ipaddress, detail}]}. Rows with a duplicate hostname/IP
    or bad hostname charset land in errors, not created. Superuser required.
    """
    return await client.post(
        "/devices/discovery/add",
        json={"devices": devices},
        timeout=DISCOVERY_TIMEOUT,
    )
