from mcp.server.fastmcp import FastMCP

mcp = FastMCP("netconsole")

from .tools import (  # noqa: E402  (import for tool-registration side effects)
    arps,
    compliance,
    credentials,
    discovery,
    group_config,
    groups,
    interfaces,
    ip_interfaces,
    logs,
    mac_addresses,
    revisions,
    switches,
)

__all__ = [
    "mcp",
    "arps",
    "compliance",
    "credentials",
    "discovery",
    "group_config",
    "groups",
    "interfaces",
    "ip_interfaces",
    "logs",
    "mac_addresses",
    "revisions",
    "switches",
]
