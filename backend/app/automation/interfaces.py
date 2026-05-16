import re

from nornir import InitNornir
from nornir_netmiko import netmiko_commit, netmiko_send_command, netmiko_send_config

from app.models import Switch
from app.vendor import JUNOS1

_INTERFACE_RE = re.compile(r"^[A-Za-z][A-Za-z0-9/\-\.]+$")
_DESCRIPTION_RE = re.compile(r"^[^\n\r\x00-\x1f]{0,255}$")


def _validate_port(port: str) -> None:
    if not _INTERFACE_RE.match(port):
        raise ValueError(f"Invalid interface name: {port!r}")


def _validate_vlan(vlan: str) -> None:
    try:
        v = int(vlan)
        if not (1 <= v <= 4094):
            raise ValueError
    except (ValueError, TypeError):
        raise ValueError(f"Invalid VLAN ID: {vlan!r}")


def _validate_description(desc: str) -> None:
    if not _DESCRIPTION_RE.match(desc):
        raise ValueError(f"Invalid description: {desc!r}")


def configure_interface(switch: Switch, interface_info: dict):
    _validate_port(interface_info["port"])
    _validate_description(interface_info["description"])

    nr = InitNornir(config_file="./app/automation/config.yaml")
    commands = []
    if switch.platform in ["ios", "nxos_ssh"]:
        if interface_info["mode"] == "access":
            _validate_vlan(interface_info["vlan"])
            commands = [
                "interface {}".format(interface_info["port"]),
                "description {}".format(interface_info["description"]),
                "no switchport trunk native vlan",
                "no switchport trunk allowed vlan",
                "switchport mode access",
                "switchport access vlan {}".format(interface_info["vlan"]),
            ]
        elif interface_info["mode"] == "trunk":
            vlan_list = interface_info["allowed_vlan_add"].split(",")
            for vlan in vlan_list:
                if vlan.strip():
                    _validate_vlan(vlan.strip())
            native = interface_info["native_vlan"]
            commands = [
                "interface {}".format(interface_info["port"]),
                "description {}".format(interface_info["description"]),
                "no switchport access vlan",
                "switchport mode trunk",
            ]
            commands.append(f"switchport trunk allowed vlan {vlan_list[0]}")
            for i in range(1, len(vlan_list)):
                commands.append(f"switchport trunk allowed vlan add {vlan_list[i]}")
            if native and 0 < int(native) < 4096:
                _validate_vlan(native)
                commands.append(
                    f"switchport trunk native vlan {native}",
                )
        rtr = nr.filter(name=switch.hostname)
        result = rtr.run(task=netmiko_send_config, config_commands=commands)
        result_dict = {host: task.result for host, task in result.items()}
        nr.close_connections()
        return result_dict
    elif switch.platform == "junos":
        if switch.model and any(char in switch.model for char in JUNOS1):
            commands = [
                "delete interfaces {}".format(interface_info["port"]),
                "set interfaces {} description {}".format(
                    interface_info["port"], interface_info["description"]
                ),
                "set interfaces {} unit 0 family ethernet-switching port-mode {}".format(
                    interface_info["port"], interface_info["mode"]
                ),
            ]
            if interface_info["mode"] == "access":
                _validate_vlan(interface_info["vlan"])
                commands.append(
                    "set interfaces {} unit 0 family ethernet-switching vlan members {}".format(
                        interface_info["port"], interface_info["vlan"]
                    )
                )
            elif interface_info["mode"] == "trunk":
                vlan_list = interface_info["allowed_vlan_add"].split(",")
                for vlan in vlan_list:
                    if vlan.strip():
                        _validate_vlan(vlan.strip())
                    commands.append(
                        "set interfaces {} unit 0 family ethernet-switching vlan members {}".format(
                            interface_info["port"], vlan
                        )
                    )
                native = interface_info["native_vlan"]
                if native and 0 < int(native) < 4096:
                    _validate_vlan(native)
                    commands.append(
                        "set interfaces {} unit 0 family ethernet-switching native-vlan-id {}".format(
                            interface_info["port"], native
                        )
                    )
        else:
            commands = [
                "delete interfaces {}".format(interface_info["port"]),
                "set interfaces {} description {}".format(
                    interface_info["port"], interface_info["description"]
                ),
                "set interfaces {} unit 0 family ethernet-switching interface-mode {}".format(
                    interface_info["port"], interface_info["mode"]
                ),
            ]
            if interface_info["mode"] == "access":
                _validate_vlan(interface_info["vlan"])
                commands.append(
                    "set interfaces {} unit 0 family ethernet-switching vlan members {}".format(
                        interface_info["port"], interface_info["vlan"]
                    )
                )
            elif interface_info["mode"] == "trunk":
                vlan_list = interface_info["allowed_vlan_add"].split(",")
                for vlan in vlan_list:
                    if vlan.strip():
                        _validate_vlan(vlan.strip())
                    commands.append(
                        "set interfaces {} unit 0 family ethernet-switching vlan members {}".format(
                            interface_info["port"], vlan
                        )
                    )
                native = interface_info["native_vlan"]
                if native and 0 < int(native) < 4096:
                    _validate_vlan(native)
                    commands.append(
                        "set interfaces {} unit 0 family ethernet-switching native-vlan-id {}".format(
                            interface_info["port"], native
                        )
                    )
        rtr = nr.filter(name=switch.hostname)
        result = rtr.run(task=netmiko_send_config, config_commands=commands)
        result = rtr.run(task=netmiko_commit)
        result_dict = {host: task.result for host, task in result.items()}
        nr.close_connections()
        return result_dict


def configure_interface_status(
    switch: Switch, interface_info: dict, set_status: int = 1
):
    """
    set_status = 1 => no shutdown (enable)
    set_status = 0 => shutdown (disable)
    """
    _validate_port(interface_info["port"])

    nr = InitNornir(config_file="./app/automation/config.yaml")
    commands = []
    if switch.platform in ["ios", "nxos_ssh"]:
        commands.append("interface {}".format(interface_info["port"]))
        if set_status == 0:
            commands.append("shutdown")
        else:
            commands.append("no shutdown")

        rtr = nr.filter(name=switch.hostname)
        result = rtr.run(task=netmiko_send_config, config_commands=commands)
        result_dict = {host: task.result for host, task in result.items()}
        nr.close_connections()
        return result_dict
    elif switch.platform == "junos":
        if set_status == 0:
            commands.append("set interfaces {} disable".format(interface_info["port"]))
        else:
            commands.append(
                "delete interfaces {} disable".format(interface_info["port"])
            )

        rtr = nr.filter(name=switch.hostname)
        result = rtr.run(task=netmiko_send_config, config_commands=commands)
        result = rtr.run(task=netmiko_commit)
        result_dict = {host: task.result for host, task in result.items()}
        nr.close_connections()
        return result_dict


def show_run_interface(switch: Switch, port: str):
    _validate_port(port)

    nr = InitNornir(config_file="./app/automation/config.yaml")
    rtr = nr.filter(name=switch.hostname)
    result = None
    if switch.platform in ["ios", "nxos_ssh"]:
        result = rtr.run(
            task=netmiko_send_command,
            command_string=f"show running-config interface {port}",
        )
    elif switch.platform == "junos":
        result = rtr.run(
            task=netmiko_send_command,
            command_string=f"show configuration interfaces {port}",
        )
    nr.close_connections()

    result_dict = {}
    if result:
        result_dict = {host: task.result for host, task in result.items()}
    return result_dict
