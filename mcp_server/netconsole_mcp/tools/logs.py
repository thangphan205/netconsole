from ..client import client
from ..server import mcp


@mcp.tool()
async def list_audit_logs(
    skip: int = 0,
    limit: int = 100,
    search: str = "",
    action: str = "",
    severity: str = "",
    from_date: str | None = None,
    to_date: str | None = None,
) -> dict:
    """
    List NetConsole's audit trail. `from_date`/`to_date` are ISO datetime strings.
    Requires superuser privileges on the calling API key's user.
    """
    return await client.get(
        "/logs/",
        params={
            "skip": skip,
            "limit": limit,
            "search": search,
            "action": action,
            "severity": severity,
            "from_date": from_date,
            "to_date": to_date,
        },
    )
