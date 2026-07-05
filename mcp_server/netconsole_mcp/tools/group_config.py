from ..client import client
from ..server import mcp


@mcp.tool()
async def push_group_config(group_name: str, commands: str, command_type: str) -> dict:
    """
    WARNING: executes raw commands on real network hardware. No dry-run, no
    confirmation, no rollback. Pushes directly to every device in the Nornir
    inventory group `group_name` over SSH via Netmiko.

    command_type="show": runs `commands` (a single CLI string) in enable mode on
    every device in the group and returns raw output per host. Still executes
    against a live session even though it is read-only.

    command_type="config": splits `commands` on newlines and pushes each line as
    a configuration command to every device in the group. This can take down
    interfaces, trunks, routing, or an entire site. There is no per-device
    confirmation step and no automatic rollback if a command fails partway
    through the group.

    Only call this after the user has explicitly confirmed: (1) the exact
    group_name and that they know which devices are members, (2) the exact
    command text, (3) that command_type="config" (not "show") is truly intended.
    When in doubt, use command_type="show" first to verify state before ever
    using "config".
    """
    return await client.post(
        "/group_config/",
        json={
            "group_name": group_name,
            "commands": commands,
            "command_type": command_type,
        },
    )
