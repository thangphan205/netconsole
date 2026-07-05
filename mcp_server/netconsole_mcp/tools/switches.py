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
) -> dict:
    """
    Create a new switch. `hostname` must be alphanumeric/underscore only.
    `credential_id` links to a stored SSH credential used for live device operations.
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
) -> dict:
    """Update a switch. Only fields provided are changed."""
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
