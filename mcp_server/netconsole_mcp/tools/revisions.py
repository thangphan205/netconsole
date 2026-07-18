from ..client import client
from ..server import mcp


@mcp.tool()
async def snapshot_switch_config(id: int) -> dict:
    """
    Snapshot a switch's full running configuration into its revision history
    (git-backed). Connects to the live device to fetch the config. Returns the
    new revision, or null if the config is unchanged since the last revision.
    """
    return await client.post(f"/switches/{id}/revisions")


@mcp.tool()
async def list_config_revisions(id: int, skip: int = 0, limit: int = 100) -> dict:
    """
    List config revisions of a switch, newest first. Each revision records the
    action that produced it (manual / pre_push / post_push / rollback /
    scheduled), the user, the git commit hash and any pushed commands.
    """
    return await client.get(
        f"/switches/{id}/revisions", params={"skip": skip, "limit": limit}
    )


@mcp.tool()
async def get_config_revision(id: int, revision_id: int) -> dict:
    """Get a config revision's metadata and its full stored config text."""
    return await client.get(f"/switches/{id}/revisions/{revision_id}")


@mcp.tool()
async def diff_config_revision(
    id: int, revision_id: int, against: str = "previous"
) -> dict:
    """
    Diff a config revision against another. `against` is another revision id,
    "previous" (the prior revision) or "live" (fetches the device's current
    running config over SSH).
    """
    return await client.get(
        f"/switches/{id}/revisions/{revision_id}/diff", params={"against": against}
    )


@mcp.tool()
async def rollback_preview_config_revision(id: int, revision_id: int) -> dict:
    """
    Dry-run a rollback: loads the revision's config on the live device in
    replace mode and returns the diff that a real rollback would apply, plus a
    diff_sha256 token and platform caveats. Nothing is committed to the device.

    Always call this before rollback_config_revision, show the returned diff to
    the user, and get their explicit confirmation.
    """
    return await client.post(f"/switches/{id}/revisions/{revision_id}/rollback-preview")


@mcp.tool()
async def rollback_config_revision(
    id: int,
    revision_id: int,
    confirm: bool = False,
    expected_diff_sha256: str = "",
    mode: str = "replace",
) -> dict:
    """
    WARNING: replaces the running configuration of a real network device with a
    stored revision. This can take down interfaces, trunks, routing, or the
    whole device.

    Required workflow: (1) call rollback_preview_config_revision, (2) show the
    diff to the user and get explicit confirmation of switch id + revision id,
    (3) call this with confirm=true and expected_diff_sha256 set to the
    preview's diff_sha256 — the API rejects the rollback with 409 if the device
    config drifted since the preview.

    mode="replace" (default) replaces the full config; mode="merge" merges the
    revision into the current config (explicit fallback for platforms where
    replace is unsupported, e.g. IOS without the archive feature).
    """
    return await client.post(
        f"/switches/{id}/revisions/{revision_id}/rollback",
        json={
            "confirm": confirm,
            "expected_diff_sha256": expected_diff_sha256,
            "mode": mode,
        },
    )
