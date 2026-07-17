from ..client import client
from ..server import mcp


@mcp.tool()
async def list_switches(
    skip: int = 0,
    limit: int = 200,
    ipaddress: str = "",
    hostname: str = "",
    search: str = "",
) -> dict:
    """List switches, optionally filtered by ipaddress/hostname/search substring."""
    return await client.get(
        "/switches/",
        params={
            "skip": skip,
            "limit": limit,
            "ipaddress": ipaddress,
            "hostname": hostname,
            "search": search,
        },
    )


@mcp.tool()
async def get_switch(id: int) -> dict:
    """Get a switch by ID."""
    return await client.get(f"/switches/{id}")


@mcp.tool()
async def create_switch(
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
    Create a new switch. `hostname` must be alphanumeric/underscore only.
    `credential_id` links to a stored SSH credential used for live device operations.
    `port` is the SSH port for device connections; only needed if the device uses a
    non-default port (default is 22).
    """
    return await client.post(
        "/switches/",
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
async def update_switch(
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
    Update a switch. Only fields provided are changed. `port` is the SSH port for
    device connections; only needed if the device uses a non-default port (default 22).
    """
    return await client.put(
        f"/switches/{id}",
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
async def delete_switch(id: int) -> dict:
    """Delete a switch and its associated interfaces/MAC/ARP/IP-interface records."""
    return await client.delete(f"/switches/{id}")


@mcp.tool()
async def update_switch_metadata(id: int) -> dict:
    """
    Refresh a switch's metadata (facts, MAC table, ARP table, IP interfaces) by
    connecting to the live device over NAPALM/Netmiko and re-syncing NetConsole's DB.
    """
    return await client.put(f"/switches/{id}/metadata")


@mcp.tool()
async def health_check_switch(id: int) -> dict:
    """TCP-connect health check for a single switch; updates its stored health_status."""
    return await client.post(f"/switches/{id}/health")


@mcp.tool()
async def health_check_all_switches() -> dict:
    """TCP-connect health check for every switch; updates each stored health_status."""
    return await client.post("/switches/health")


@mcp.tool()
async def push_switch_config(id: int, commands: str, command_type: str) -> dict:
    """
    WARNING: executes raw commands on a single real network device. No dry-run,
    no confirmation, no rollback. Pushes directly to the switch identified by
    `id` over SSH via Netmiko.

    command_type="show": runs `commands` (a single CLI string) in enable mode on
    the device and returns raw output. Still executes against a live session
    even though it is read-only.

    command_type="config": splits `commands` on newlines and pushes each line as
    a configuration command to the device. This can take down interfaces,
    trunks, routing, or the whole device. There is no per-command confirmation
    step and no automatic rollback if a command fails partway through.

    Only call this after the user has explicitly confirmed: (1) which switch
    (exact id/hostname), (2) the exact command text, (3) that command_type=
    "config" (not "show") is truly intended. When in doubt, use command_type=
    "show" first to verify state before ever using "config".
    """
    return await client.post(
        f"/switches/{id}/config",
        json={"commands": commands, "command_type": command_type},
    )
