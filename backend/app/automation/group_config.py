from nornir import InitNornir
from nornir.core.filter import F
from nornir_netmiko import netmiko_commit, netmiko_send_command, netmiko_send_config


def group_configure(group_name: str = "", commands: str = "", command_type: str = ""):
    nr = InitNornir(config_file="./app/automation/config.yaml")
    try:
        rtr = nr.filter(F(groups__contains=group_name))
        if not rtr.inventory.hosts:
            raise ValueError(f"Group '{group_name}' not found in inventory")
        if command_type == "show":
            result = rtr.run(
                task=netmiko_send_command, command_string=commands, enable=True
            )
        elif command_type == "config":
            result = rtr.run(
                task=netmiko_send_config, config_commands=commands.split("\n")
            )
            # Junos candidate config is discarded (not applied) on session exit
            # unless explicitly committed. Only commit hosts whose config push
            # actually succeeded.
            ok_hosts = [h for h, task in result.items() if not task.failed]
            junos_rtr = rtr.filter(platform="junos").filter(
                filter_func=lambda h: h.name in ok_hosts
            )
            if junos_rtr.inventory.hosts:
                commit_result = junos_rtr.run(task=netmiko_commit)
                for host, task in commit_result.items():
                    result[host] = task
        else:
            return {}
        return {
            host: str(task.result) if not task.failed else f"ERROR: {task.result}"
            for host, task in result.items()
        }
    finally:
        nr.close_connections()
