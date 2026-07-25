from ..client import client
from ..server import mcp


@mcp.tool()
async def list_compliance_rules() -> dict:
    """
    List the hardening rule catalog, each rule mapped to PCI DSS v4.0.1
    requirements and ISO 27001:2022 Annex A controls, with the platforms
    (ios/nxos/junos/eos) it applies to.
    """
    return await client.get("/compliance/rules")


@mcp.tool()
async def get_compliance_profiles() -> dict:
    """
    Get the global compliance profile (NTP/syslog/DNS servers, password
    policy, exec-timeout) and any per-group overrides.
    """
    return await client.get("/compliance/profiles")


@mcp.tool()
async def update_compliance_profile(
    group_id: int | None = None,
    ntp_server: str | None = None,
    syslog_server: str | None = None,
    dns_server: str | None = None,
    password_min_length: int | None = None,
    exec_timeout_minutes: int | None = None,
) -> dict:
    """
    Update the global compliance profile, or a per-group override when
    group_id is set. Only the fields passed are changed; a group override
    field left null falls back to the global profile's value.

    ntp_server, syslog_server and dns_server accept a comma-separated list
    ("10.0.0.1,10.0.0.4"): the rule passes only when every listed server is
    configured, and remediation adds only the missing ones.
    """
    payload = {
        "ntp_server": ntp_server,
        "syslog_server": syslog_server,
        "dns_server": dns_server,
        "password_min_length": password_min_length,
        "exec_timeout_minutes": exec_timeout_minutes,
    }
    path = (
        f"/compliance/profiles/group/{group_id}"
        if group_id is not None
        else "/compliance/profiles/global"
    )
    return await client.put(path, json=payload)


@mcp.tool()
async def run_compliance_check(id: int) -> dict:
    """
    Fetch a switch's live config and evaluate it against the hardening rule
    catalog using its effective compliance profile (group override merged
    over global). Persists a new compliance run and returns its results.
    """
    return await client.post(f"/compliance/switches/{id}/run")


@mcp.tool()
async def run_group_compliance_check(group_name: str) -> dict:
    """
    Run compliance checks against every switch in a group. Returns the new
    run id per hostname plus any per-switch errors.
    """
    return await client.post(f"/compliance/groups/{group_name}/run")


@mcp.tool()
async def get_compliance_results(id: int, run_id: int | None = None) -> dict:
    """
    Get a switch's compliance results: the latest run by default, or a
    specific run_id.
    """
    if run_id is not None:
        return await client.get(f"/compliance/runs/{run_id}")
    return await client.get(f"/compliance/switches/{id}/latest")


@mcp.tool()
async def get_compliance_summary() -> dict:
    """
    Latest compliance pass/fail/skip counts per switch, for a dashboard view.
    """
    return await client.get("/compliance/summary")


@mcp.tool()
async def preview_compliance_remediation(
    id: int, run_id: int, rule_ids: list[str]
) -> dict:
    """
    Build the remediation commands for a set of failed rules from a stored
    compliance run, without touching the device. Returns commands_sha256 —
    always call this before apply_compliance_remediation and show the
    commands to the user for confirmation.
    """
    return await client.post(
        f"/compliance/switches/{id}/remediation-preview",
        json={"run_id": run_id, "rule_ids": rule_ids},
    )


@mcp.tool()
async def apply_compliance_remediation(
    id: int,
    run_id: int,
    rule_ids: list[str],
    confirm: bool = False,
    expected_commands_sha256: str = "",
) -> dict:
    """
    WARNING: pushes hardening remediation commands to a real network device
    (merge mode) and re-runs the compliance check. This changes the live
    running configuration.

    Required workflow: (1) call preview_compliance_remediation, (2) show the
    generated commands to the user and get explicit confirmation of switch id
    + rule ids, (3) call this with confirm=true and expected_commands_sha256
    set to the preview's commands_sha256 — the API rejects the push with 409
    if the stored run's remediation commands changed since the preview.
    """
    return await client.post(
        f"/compliance/switches/{id}/remediate",
        json={
            "run_id": run_id,
            "rule_ids": rule_ids,
            "confirm": confirm,
            "expected_commands_sha256": expected_commands_sha256,
        },
    )


@mcp.tool()
async def preview_group_compliance_remediation(
    group_name: str, rule_ids: list[str] | None = None
) -> dict:
    """
    Build the per-switch remediation plan for every switch in a group, from
    each switch's own latest compliance run, without touching any device.
    Leave rule_ids empty to target all currently-failed rules per switch.

    Returns one command block per switch plus an aggregate commands_sha256 —
    always call this before apply_group_compliance_remediation and show the
    per-switch commands to the user for confirmation.
    """
    return await client.post(
        f"/compliance/groups/{group_name}/remediation-preview",
        json={"rule_ids": rule_ids or []},
    )


@mcp.tool()
async def apply_group_compliance_remediation(
    group_name: str,
    rule_ids: list[str] | None = None,
    confirm: bool = False,
    expected_commands_sha256: str = "",
    rerun_check: bool = True,
) -> dict:
    """
    WARNING: pushes hardening remediation commands to EVERY switch in a group
    (merge mode) and re-runs each compliance check. This changes live running
    configurations on multiple devices at once.

    Required workflow: (1) call preview_group_compliance_remediation, (2) show
    the per-switch command blocks and the affected hostnames to the user and
    get explicit confirmation, (3) call this with confirm=true and
    expected_commands_sha256 set to the preview's aggregate commands_sha256.
    Unlike the single-switch tool, that token is mandatory — the API rejects
    the push with 400 without it, and with 409 if the plan changed since the
    preview.

    Set rerun_check=false on large groups to skip the post-push verification
    check (one less SSH session per switch); dashboard counts then stay stale
    until the next group check.

    One unreachable device does not abort the batch: per-switch outcomes come
    back in `results` and `errors`.
    """
    return await client.post(
        f"/compliance/groups/{group_name}/remediate",
        json={
            "rule_ids": rule_ids or [],
            "confirm": confirm,
            "expected_commands_sha256": expected_commands_sha256,
            "rerun_check": rerun_check,
        },
    )
