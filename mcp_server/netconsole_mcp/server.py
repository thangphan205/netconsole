from mcp.server.fastmcp import FastMCP

mcp = FastMCP("netconsole")

from .tools import (  # noqa: E402  (import for tool-registration side effects)
    arps,
    credentials,
    group_config,
    groups,
    interfaces,
    ip_interfaces,
    logs,
    mac_addresses,
    switches,
)

__all__ = [
    "mcp",
    "arps",
    "credentials",
    "group_config",
    "groups",
    "interfaces",
    "ip_interfaces",
    "logs",
    "mac_addresses",
    "switches",
]
