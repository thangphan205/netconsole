from ..client import client
from ..server import mcp


@mcp.tool()
async def list_mac_addresses(
    skip: int = 0,
    limit: int = 200,
    switch_id: int = 0,
    search: str = "",
    since: str | None = None,
) -> dict:
    """List MAC address table entries. `since` is an ISO datetime string."""
    return await client.get(
        "/mac_addresses/",
        params={
            "skip": skip,
            "limit": limit,
            "switch_id": switch_id,
            "search": search,
            "since": since,
        },
    )


@mcp.tool()
async def get_mac_address(id: int) -> dict:
    """Get a MAC address entry by ID."""
    return await client.get(f"/mac_addresses/{id}")


@mcp.tool()
async def create_mac_address(
    mac: str,
    interface: str,
    switch_id: int,
    vlan: int | None = None,
    static: bool | None = None,
) -> dict:
    """Create a MAC address table entry."""
    return await client.post(
        "/mac_addresses/",
        json={
            "mac": mac,
            "interface": interface,
            "switch_id": switch_id,
            "vlan": vlan,
            "static": static,
        },
    )


@mcp.tool()
async def update_mac_address(
    id: int,
    mac: str | None = None,
    interface: str | None = None,
    vlan: int | None = None,
) -> dict:
    """Update a MAC address table entry."""
    return await client.put(
        f"/mac_addresses/{id}",
        json={"mac": mac, "interface": interface, "vlan": vlan},
    )


@mcp.tool()
async def delete_mac_address(id: int) -> dict:
    """Delete a MAC address table entry."""
    return await client.delete(f"/mac_addresses/{id}")
