from ..client import client
from ..server import mcp


@mcp.tool()
async def list_credentials(skip: int = 0, limit: int = 200, search: str = "") -> dict:
    """
    List stored device credentials. Passwords are never returned; `enable_password`
    is returned only as encrypted ciphertext, never plaintext.
    """
    return await client.get(
        "/credentials/", params={"skip": skip, "limit": limit, "search": search}
    )


@mcp.tool()
async def get_credential(id: int) -> dict:
    """Get a credential by ID (password fields are not exposed plaintext)."""
    return await client.get(f"/credentials/{id}")


@mcp.tool()
async def create_credential(
    username: str,
    password: str,
    description: str = "",
    enable_password: str | None = None,
    default: bool | None = None,
) -> dict:
    """
    Create a device SSH credential. `password`/`enable_password` are encrypted at
    rest and never echoed back by the API.
    """
    return await client.post(
        "/credentials/",
        json={
            "username": username,
            "password": password,
            "description": description,
            "enable_password": enable_password,
            "default": default,
        },
    )


@mcp.tool()
async def update_credential(
    id: int,
    username: str | None = None,
    password: str | None = None,
    description: str | None = None,
    enable_password: str | None = None,
) -> dict:
    """Update a device SSH credential. Only fields provided are changed."""
    return await client.put(
        f"/credentials/{id}",
        json={
            "username": username,
            "password": password,
            "description": description,
            "enable_password": enable_password,
        },
    )


@mcp.tool()
async def delete_credential(id: int) -> dict:
    """Delete a device SSH credential."""
    return await client.delete(f"/credentials/{id}")
