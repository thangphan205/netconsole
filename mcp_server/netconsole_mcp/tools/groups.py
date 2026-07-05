from ..client import client
from ..server import mcp


@mcp.tool()
async def list_groups(skip: int = 0, limit: int = 200, search: str = "") -> dict:
    """List device groups used for bulk operations."""
    return await client.get(
        "/groups/", params={"skip": skip, "limit": limit, "search": search}
    )


@mcp.tool()
async def get_group(id: int) -> dict:
    """Get a device group by ID."""
    return await client.get(f"/groups/{id}")


@mcp.tool()
async def create_group(name: str, site: str, description: str = "") -> dict:
    """Create a device group. `name` and `site` must be alphanumeric/underscore only."""
    return await client.post(
        "/groups/", json={"name": name, "site": site, "description": description}
    )


@mcp.tool()
async def update_group(
    id: int,
    name: str | None = None,
    site: str | None = None,
    description: str | None = None,
) -> dict:
    """Update a device group. Only fields provided are changed."""
    return await client.put(
        f"/groups/{id}", json={"name": name, "site": site, "description": description}
    )


@mcp.tool()
async def delete_group(id: int) -> dict:
    """Delete a device group."""
    return await client.delete(f"/groups/{id}")
