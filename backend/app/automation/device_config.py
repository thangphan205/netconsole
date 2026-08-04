from nornir import InitNornir
from nornir_netmiko import netmiko_commit, netmiko_send_command, netmiko_send_config


def device_configure(
    hostname: str = "", commands: str = "", command_type: str = ""
) -> dict[str, str]:
    nr = InitNornir(config_file="./app/automation/config.yaml")
    try:
        rtr = nr.filter(name=hostname)
        if not rtr.inventory.hosts:
            raise ValueError(f"Device '{hostname}' not found in inventory")
        if command_type == "show":
            result = rtr.run(
                task=netmiko_send_command, command_string=commands, enable=True
            )
        elif command_type == "config":
            result = rtr.run(
                task=netmiko_send_config, config_commands=commands.split("\n")
            )
            # Junos candidate config is discarded (not applied) on session exit
            # unless explicitly committed.
            if not result.failed and rtr.inventory.hosts[hostname].platform == "junos":
                result = rtr.run(task=netmiko_commit)
        else:
            return {}
        return {
            host: str(task.result) if not task.failed else f"ERROR: {task.result}"
            for host, task in result.items()
        }
    finally:
        nr.close_connections()
