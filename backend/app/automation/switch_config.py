from nornir import InitNornir
from nornir_netmiko import netmiko_send_command, netmiko_send_config


def switch_configure(hostname: str = "", commands: str = "", command_type: str = ""):
    nr = InitNornir(config_file="./app/automation/config.yaml")
    try:
        rtr = nr.filter(name=hostname)
        if not rtr.inventory.hosts:
            raise ValueError(f"Switch '{hostname}' not found in inventory")
        if command_type == "show":
            result = rtr.run(
                task=netmiko_send_command, command_string=commands, enable=True
            )
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
