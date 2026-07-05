from ..client import client
from ..server import mcp


@mcp.tool()
async def list_arps(
    skip: int = 0,
    limit: int = 200,
    switch_id: int = 0,
    search: str = "",
    since: str | None = None,
) -> dict:
    """List ARP table entries. `since` is an ISO datetime string."""
    return await client.get(
        "/arps/",
        params={
            "skip": skip,
            "limit": limit,
            "switch_id": switch_id,
            "search": search,
            "since": since,
        },
    )


@mcp.tool()
async def get_arp(id: int) -> dict:
    """Get an ARP entry by ID."""
    return await client.get(f"/arps/{id}")


@mcp.tool()
async def create_arp(
    ip: str,
    interface: str,
    switch_id: int,
    mac: str | None = None,
    age: int | None = None,
) -> dict:
    """Create an ARP table entry."""
    return await client.post(
        "/arps/",
        json={
            "ip": ip,
            "interface": interface,
            "switch_id": switch_id,
            "mac": mac,
            "age": age,
        },
    )


@mcp.tool()
async def update_arp(
    id: int,
    ip: str | None = None,
    interface: str | None = None,
    mac: str | None = None,
) -> dict:
    """Update an ARP table entry."""
    return await client.put(
        f"/arps/{id}", json={"ip": ip, "interface": interface, "mac": mac}
    )


@mcp.tool()
async def delete_arp(id: int) -> dict:
    """Delete an ARP table entry."""
    return await client.delete(f"/arps/{id}")
