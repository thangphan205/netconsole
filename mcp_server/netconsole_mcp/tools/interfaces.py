from ..client import client
from ..server import mcp


@mcp.tool()
async def list_interfaces(
    skip: int = 0,
    limit: int = 200,
    port: str = "",
    switch_id: int = 0,
    search: str = "",
) -> dict:
    """List interfaces, optionally filtered by port/switch_id/search substring."""
    return await client.get(
        "/interfaces/",
        params={
            "skip": skip,
            "limit": limit,
            "port": port,
            "switch_id": switch_id,
            "search": search,
        },
    )


@mcp.tool()
async def get_interface(id: int) -> dict:
    """Get an interface by ID."""
    return await client.get(f"/interfaces/{id}")


@mcp.tool()
async def get_interface_running_config(id: int) -> dict:
    """Pull the live running configuration for this interface's port directly from the device."""
    return await client.get(f"/interfaces/{id}/running")


@mcp.tool()
async def create_interface(
    port: str,
    description: str,
    switch_id: int,
    vlan: str | None = None,
    mode: str | None = None,
    native_vlan: str | None = None,
    allowed_vlan: str | None = None,
) -> dict:
    """Create an interface record in NetConsole's DB (does not push config to the device)."""
    return await client.post(
        "/interfaces/",
        json={
            "port": port,
            "description": description,
            "switch_id": switch_id,
            "vlan": vlan,
            "mode": mode,
            "native_vlan": native_vlan,
            "allowed_vlan": allowed_vlan,
        },
    )


@mcp.tool()
async def update_interface(
    id: int,
    port: str | None = None,
    description: str | None = None,
    vlan: str | None = None,
    mode: str | None = None,
    native_vlan: str | None = None,
    allowed_vlan: str | None = None,
) -> dict:
    """
    Update an interface. This PUSHES the corresponding switchport/VLAN/description
    config to the live device over Netmiko, not just a DB update. Only fields
    provided are changed.
    """
    return await client.put(
        f"/interfaces/{id}",
        json={
            "port": port,
            "description": description,
            "vlan": vlan,
            "mode": mode,
            "native_vlan": native_vlan,
            "allowed_vlan": allowed_vlan,
        },
    )


@mcp.tool()
async def set_interface_status(id: int, set_status: int = 1) -> dict:
    """
    Set interface admin status on the LIVE device: set_status=1 for 'no shutdown'
    (bring up), set_status=0 for 'shutdown' (bring down). This can take a port
    offline immediately.
    """
    return await client.put(
        f"/interfaces/{id}/status", params={"set_status": set_status}
    )


@mcp.tool()
async def delete_interface(id: int) -> dict:
    """Delete an interface record from NetConsole's DB."""
    return await client.delete(f"/interfaces/{id}")
