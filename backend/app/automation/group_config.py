from nornir import InitNornir
from nornir_netmiko import netmiko_send_config, netmiko_send_command
from nornir.core.filter import F


def group_configure(group_name: str = "", commands: str = "", command_type: str = ""):
    nr = InitNornir(config_file="./app/automation/config.yaml")
    rtr = nr.filter(F(groups__contains=group_name))
    if command_type == "show":
        result = rtr.run(task=netmiko_send_command, command_string=commands)
    elif command_type == "config":
        result = rtr.run(task=netmiko_send_config, config_commands=commands.split("\n"))
    else:
        return True
    result_dict = {host: task.result for host, task in result.items()}

    nr.close_connections()
    return result_dict
