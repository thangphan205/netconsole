from ..client import client
from ..server import mcp


@mcp.tool()
async def list_ip_interfaces(
    skip: int = 0,
    limit: int = 200,
    interface: str = "",
    ipv4: str = "",
    switch_id: int = 0,
    search: str = "",
    since: str | None = None,
) -> dict:
    """List Layer 3 interface assignments. `since` is an ISO datetime string."""
    return await client.get(
        "/ip_interfaces/",
        params={
            "skip": skip,
            "limit": limit,
            "interface": interface,
            "ipv4": ipv4,
            "switch_id": switch_id,
            "search": search,
            "since": since,
        },
    )


@mcp.tool()
async def get_ip_interface(id: int) -> dict:
    """Get an IP interface entry by ID."""
    return await client.get(f"/ip_interfaces/{id}")


@mcp.tool()
async def create_ip_interface(
    interface: str,
    ipv4: str,
    switch_id: int,
    ipv6: str | None = None,
) -> dict:
    """Create a Layer 3 interface assignment."""
    return await client.post(
        "/ip_interfaces/",
        json={
            "interface": interface,
            "ipv4": ipv4,
            "switch_id": switch_id,
            "ipv6": ipv6,
        },
    )


@mcp.tool()
async def update_ip_interface(
    id: int,
    interface: str | None = None,
    ipv4: str | None = None,
    ipv6: str | None = None,
) -> dict:
    """Update a Layer 3 interface assignment."""
    return await client.put(
        f"/ip_interfaces/{id}",
        json={"interface": interface, "ipv4": ipv4, "ipv6": ipv6},
    )


@mcp.tool()
async def delete_ip_interface(id: int) -> dict:
    """Delete a Layer 3 interface assignment."""
    return await client.delete(f"/ip_interfaces/{id}")
