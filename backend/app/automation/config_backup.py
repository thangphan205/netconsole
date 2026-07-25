from nornir import InitNornir
from nornir_napalm.plugins.tasks import napalm_configure, napalm_get
from nornir_netmiko import netmiko_send_command

from app.automation.switches import (
    SwitchAuthenticationError,
    SwitchConnectionError,
    is_auth_error,
)
from app.models import Switch

# Operator-facing caveats surfaced in rollback previews
PLATFORM_CAVEATS = {
    "ios": (
        "Cisco IOS config replace requires the 'archive' feature and SCP "
        "enabled on the device. If the preview fails, enable them or use "
        "merge mode."
    ),
    "nxos_ssh": (
        "NX-OS rollback uses checkpoint/rollback files; some sections "
        "(e.g. banners) may not replay exactly."
    ),
    "eos": "",
    "junos": "",
}


def _first_exception(result, hostname: str) -> Exception | None:
    if hostname not in result:
        return None
    host_result = result[hostname]
    if host_result.exception:
        return host_result.exception
    for sub_res in host_result:
        if sub_res.failed and sub_res.exception:
            return sub_res.exception
    return None


def _raise_for_failure(result, switch: Switch) -> None:
    exc = _first_exception(result, switch.hostname)
    exc_str = str(exc) if exc else "Unknown Nornir task failure"
    if exc and is_auth_error(exc):
        raise SwitchAuthenticationError(exc_str)
    raise SwitchConnectionError(exc_str)


def get_running_config(switch: Switch) -> str:
    """Fetch the device's full running configuration as text."""
    nr = InitNornir(config_file="./app/automation/config.yaml")
    try:
        rtr = nr.filter(name=switch.hostname)
        result = rtr.run(
            task=napalm_get,
            getters=["config"],
            getters_options={"config": {"retrieve": "running"}},
        )
        if not result.failed:
            config = result[switch.hostname].result["config"]["running"]
            if config:
                return str(config)

        # NAPALM getter failed or returned empty — fall back to raw CLI
        command = (
            "show configuration"
            if switch.platform == "junos"
            else "show running-config"
        )
        fallback = rtr.run(task=netmiko_send_command, command_string=command)
        if fallback.failed:
            _raise_for_failure(fallback, switch)
        return str(fallback[switch.hostname].result)
    finally:
        nr.close_connections()


def get_compliance_config(switch: Switch) -> str:
    """Fetch config text suitable for compliance regex checks.

    JunOS's curly-brace config is not regex-friendly, so use the flat
    "set"-style output instead. Other platforms reuse get_running_config.
    """
    if switch.platform != "junos":
        return get_running_config(switch)

    nr = InitNornir(config_file="./app/automation/config.yaml")
    try:
        rtr = nr.filter(name=switch.hostname)
        result = rtr.run(
            task=netmiko_send_command, command_string="show configuration | display set"
        )
        if result.failed:
            _raise_for_failure(result, switch)
        return str(result[switch.hostname].result)
    finally:
        nr.close_connections()


def replace_config(
    switch: Switch, config_text: str, *, dry_run: bool, replace: bool = True
) -> dict:
    """Load config onto the device via NAPALM.

    replace=True: full config replace (load_replace_candidate).
    replace=False: merge (load_merge_candidate).
    dry_run=True: compare only, discard candidate — returns the diff without
    touching the running config.
    """
    nr = InitNornir(config_file="./app/automation/config.yaml")
    try:
        rtr = nr.filter(name=switch.hostname)
        result = rtr.run(
            task=napalm_configure,
            configuration=config_text,
            replace=replace,
            dry_run=dry_run,
        )
        if result.failed:
            _raise_for_failure(result, switch)
        host_result = result[switch.hostname][0]
        return {
            "diff": host_result.diff or "",
            "changed": host_result.changed,
            "caveats": PLATFORM_CAVEATS.get(switch.platform or "", ""),
        }
    finally:
        nr.close_connections()
