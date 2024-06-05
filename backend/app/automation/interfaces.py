from nornir import InitNornir
from nornir_netmiko import netmiko_send_config, netmiko_send_command
from app.models import Switch


def configure_interface(hostname: str, interface_info: dict):

    nr = InitNornir(config_file="./app/automation/config.yaml")
    commands = []
    if interface_info["mode"] == "access":
        commands = [
            "interface {}".format(interface_info["port"]),
            "description {}".format(interface_info["description"]),
            "no switchport trunk native vlan",
            "no switchport trunk allowed vlan",
            "switchport mode access",
            "switchport access vlan {}".format(interface_info["vlan"]),
        ]
    elif interface_info["mode"] == "trunk":
        commands = [
            "interface {}".format(interface_info["port"]),
            "description {}".format(interface_info["description"]),
            "no switchport access vlan",
            "switchport mode trunk",
            "switchport trunk native vlan {}".format(interface_info["native_vlan"]),
        ]
        vlan_list = interface_info["allowed_vlan_add"].split(",")
        commands.append("switchport trunk allowed vlan {}".format(vlan_list[0]))
        for i in range(1, len(vlan_list)):
            commands.append("switchport trunk allowed vlan add {}".format(vlan_list[i]))

    rtr = nr.filter(name=hostname)
    result = rtr.run(task=netmiko_send_config, config_commands=commands)
    result_dict = {host: task.result for host, task in result.items()}
    nr.close_connections()
    return result_dict


def show_run_interface(switch: Switch, port: str):
    nr = InitNornir(config_file="./app/automation/config.yaml")
    rtr = nr.filter(name=switch.hostname)
    result = None
    if switch.platform in ["ios", "nxos_ssh"]:
        result = rtr.run(
            task=netmiko_send_command,
            command_string="show running-config interface {}".format(port),
        )
    elif switch.platform == "junos":
        result = rtr.run(
            task=netmiko_send_command,
            command_string="show configuration interfaces {}".format(port),
        )
    nr.close_connections()

    result_dict = {}
    if result:
        result_dict = {host: task.result for host, task in result.items()}
    return result_dict
