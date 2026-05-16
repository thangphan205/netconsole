from nornir import InitNornir
from nornir.core.filter import F
from nornir_netmiko import netmiko_send_command, netmiko_send_config


def group_configure(group_name: str = "", commands: str = "", command_type: str = ""):
    nr = InitNornir(config_file="./app/automation/config.yaml")
    try:
        rtr = nr.filter(F(groups__contains=group_name))
        if not rtr.inventory.hosts:
            raise ValueError(f"Group '{group_name}' not found in inventory")
        if command_type == "show":
            result = rtr.run(task=netmiko_send_command, command_string=commands)
        elif command_type == "config":
            result = rtr.run(
                task=netmiko_send_config, config_commands=commands.split("\n")
            )
        else:
            return {}
        return {
            host: str(task.result) if not task.failed else f"ERROR: {task.result}"
            for host, task in result.items()
        }
    finally:
        nr.close_connections()
