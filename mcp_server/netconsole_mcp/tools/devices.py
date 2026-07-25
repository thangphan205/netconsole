from ..client import client
from ..server import mcp


@mcp.tool()
async def list_devices(
    skip: int = 0,
    limit: int = 200,
    ipaddress: str = "",
    hostname: str = "",
    search: str = "",
) -> dict:
    """List devices, optionally filtered by ipaddress/hostname/search substring."""
    return await client.get(
        "/devices/",
        params={
            "skip": skip,
            "limit": limit,
            "ipaddress": ipaddress,
            "hostname": hostname,
            "search": search,
        },
    )


@mcp.tool()
async def get_device(id: int) -> dict:
    """Get a device by ID."""
    return await client.get(f"/devices/{id}")


@mcp.tool()
async def create_device(
    hostname: str,
    ipaddress: str,
    groups: str | None = None,
    platform: str | None = None,
    device_type: str | None = None,
    vendor: str | None = None,
    description: str | None = None,
    credential_id: int | None = None,
    port: int | None = None,
) -> dict:
    """
    Create a new device. `hostname` must be alphanumeric/underscore only.
    `credential_id` links to a stored SSH credential used for live device operations.
    `port` is the SSH port for device connections; only needed if the device uses a
    non-default port (default is 22).
    """
    return await client.post(
        "/devices/",
        json={
            "hostname": hostname,
            "ipaddress": ipaddress,
            "groups": groups,
            "platform": platform,
            "device_type": device_type,
            "vendor": vendor,
            "description": description,
            "credential_id": credential_id,
            "port": port,
        },
    )


@mcp.tool()
async def update_device(
    id: int,
    hostname: str | None = None,
    ipaddress: str | None = None,
    groups: str | None = None,
    platform: str | None = None,
    device_type: str | None = None,
    vendor: str | None = None,
    description: str | None = None,
    credential_id: int | None = None,
    port: int | None = None,
) -> dict:
    """
    Update a device. Only fields provided are changed. `port` is the SSH port for
    device connections; only needed if the device uses a non-default port (default 22).
    """
    return await client.put(
        f"/devices/{id}",
        json={
            "hostname": hostname,
            "ipaddress": ipaddress,
            "groups": groups,
            "platform": platform,
            "device_type": device_type,
            "vendor": vendor,
            "description": description,
            "credential_id": credential_id,
            "port": port,
        },
    )


@mcp.tool()
async def delete_device(id: int) -> dict:
    """Delete a device and its associated interfaces/MAC/ARP/IP-interface records."""
    return await client.delete(f"/devices/{id}")


@mcp.tool()
async def update_device_metadata(id: int) -> dict:
    """
    Refresh a device's metadata (facts, MAC table, ARP table, IP interfaces) by
    connecting to the live device over NAPALM/Netmiko and re-syncing NetConsole's DB.
    """
    return await client.put(f"/devices/{id}/metadata")


@mcp.tool()
async def health_check_device(id: int) -> dict:
    """TCP-connect health check for a single device; updates its stored health_status."""
    return await client.post(f"/devices/{id}/health")


@mcp.tool()
async def health_check_all_devices() -> dict:
    """TCP-connect health check for every device; updates each stored health_status."""
    return await client.post("/devices/health")


@mcp.tool()
async def push_device_config(id: int, commands: str, command_type: str) -> dict:
    """
    WARNING: executes raw commands on a single real network device. No dry-run
    and no confirmation. Pushes directly to the device identified by `id` over
    SSH via Netmiko. For command_type="config", NetConsole automatically
    records pre_push/post_push config revisions; a bad push can be undone via
    rollback_preview_config_revision + rollback_config_revision, but only after
    the damage is already applied.

    command_type="show": runs `commands` (a single CLI string) in enable mode on
    the device and returns raw output. Still executes against a live session
    even though it is read-only.

    command_type="config": splits `commands` on newlines and pushes each line as
    a configuration command to the device. This can take down interfaces,
    trunks, routing, or the whole device. There is no per-command confirmation
    step and no automatic rollback if a command fails partway through.

    Only call this after the user has explicitly confirmed: (1) which device
    (exact id/hostname), (2) the exact command text, (3) that command_type=
    "config" (not "show") is truly intended. When in doubt, use command_type=
    "show" first to verify state before ever using "config".
    """
    return await client.post(
        f"/devices/{id}/config",
        json={"commands": commands, "command_type": command_type},
    )
