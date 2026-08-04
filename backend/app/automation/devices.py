import ast

from nornir import InitNornir
from nornir_napalm.plugins.tasks import napalm_get
from nornir_netmiko import netmiko_send_command
from ttp import ttp

from app.models import Device
from app.vendor import JUNOS1

"""
Device config to allow tool:

role name priv-1
  rule 1 permit read-write feature interface
  rule 2 permit read-write feature copy
  rule 3 permit read
  exit
username netconsole password <DEVICE_PASSWORD> role priv-1

"""


def show_run_interface(data: str, device: Device):

    ttp_template_cisco_nexus = """interface {{ interface }}\n  description {{ description | re(".*") }}\n  switchport mode {{ mode }}\n  switchport trunk native vlan {{ native_vlan }}\n  switchport trunk allowed vlan {{ allowed_vlan }}\n  switchport trunk allowed vlan add {{ allowed_vlan_add }}\n  switchport access vlan {{ vlan }}"""
    ttp_template_cisco_ios = """interface {{ interface }}\n description {{ description | re(".*") }}\n switchport mode {{ mode }}\n switchport trunk native vlan {{ native_vlan }}\n switchport trunk allowed vlan {{ allowed_vlan }}\n switchport trunk allowed vlan add {{ allowed_vlan_add }}\n switchport access vlan {{ vlan }}"""
    ttp_template_arista_eos = """interface {{ interface }}\n   description {{ description | re(".*") }}\n   switchport mode {{ mode }}\n   switchport trunk native vlan {{ native_vlan }}\n   switchport trunk allowed vlan {{ allowed_vlan }}\n   switchport trunk allowed vlan add {{ allowed_vlan_add }}\n   switchport access vlan {{ vlan }}"""
    ttp_template_juniper_junos1 = """{{ interface }} {\n    description {{ description | re(".*") }};\n        802.3ad {{ mode }};\n            port-mode {{ mode }};\n                members {{ vlan }};\n                members [ {{ allowed_vlan | re(".*") }} ];\n            native-vlan-id {{ native_vlan }};"""
    ttp_template_juniper_junos2 = """{{ interface }} {\n    description {{ description | re(".*") }};\n        802.3ad {{ mode }};\n            interface-mode {{ mode }};\n                members {{ vlan }};\n                members [ {{ allowed_vlan | re(".*") }} ];\n            native-vlan-id {{ native_vlan }};"""

    parser = None
    if device.platform == "ios":
        parser = ttp(data=data, template=ttp_template_cisco_ios)
    elif device.platform == "nxos_ssh":
        parser = ttp(data=data, template=ttp_template_cisco_nexus)
    elif device.platform == "eos":
        parser = ttp(data=data, template=ttp_template_arista_eos)
    elif device.platform == "junos":
        if device.model and any(char in device.model for char in JUNOS1):
            parser = ttp(data=data, template=ttp_template_juniper_junos1)
        else:
            parser = ttp(data=data, template=ttp_template_juniper_junos2)

    if parser:
        try:
            parser.parse()
            results = parser.result(format="json")
            if results and len(results) > 0:
                parsed = ast.literal_eval(results[0])
                if isinstance(parsed, list) and len(parsed) > 0:
                    return parsed[0] if isinstance(parsed[0], list) else parsed
        except Exception:
            pass
    return []


def parser_show_interface_status(data: list):
    intf_list = []
    for i in data:
        if any(char in i for char in ("full", "auto", "half")):
            intf_dict = {}
            entry = i.split()

            status_lookup = [
                "connected",
                "notconnect",
                "notconnec",
                "disabled",
                "xcvrAbsen",
                "err-disabled",
                "down",
                "unknown",
                "sfpAbsent",
                "noOperMem",
                "bpdugrdEr",
                "linkFlapE",
            ]

            for status in status_lookup:
                if status in entry:
                    status_index = entry.index(status)
                    break
            else:
                raise ValueError("Unexpected interface status.")

            description = [entry.pop(1) for _ in range(1, status_index)]
            description = " ".join(description)
            intf_dict["description"] = description
            if entry[0][0:3] == "Eth":
                intf_dict["port"] = entry[0].replace("Eth", "Ethernet")
            elif entry[0][0:2] == "Gi":
                intf_dict["port"] = entry[0].replace("Gi", "GigabitEthernet")
            elif entry[0][0:2] == "Fa":
                intf_dict["port"] = entry[0].replace("Fa", "FastEthernet")
            elif entry[0][0:2] == "Et":
                intf_dict["port"] = entry[0].replace("Et", "Ethernet", 1)
            elif entry[0][0:2] == "Ma":
                intf_dict["port"] = entry[0].replace("Ma", "Management", 1)
            elif entry[0][0:2] == "Po":
                intf_dict["port"] = entry[0].replace("Po", "Port-Channel", 1)
            else:
                intf_dict["port"] = entry[0]
            intf_dict["status"] = entry[1]
            intf_dict["vlan"] = entry[2]
            intf_dict["duplex"] = entry[3]
            intf_dict["speed"] = entry[4]

            try:
                _type = [entry.pop(5) for _ in range(5, len(entry))]
                _type = " ".join(_type)
                intf_dict["type"] = _type if _type else "n/a"
            except IndexError:
                intf_dict["type"] = "n/a"

            vlan_col = entry[2]
            if vlan_col == "trunk":
                intf_dict["mode"] = "trunk"
            elif vlan_col == "routed":
                intf_dict["mode"] = "routed"
            else:
                intf_dict["mode"] = "access"
            intf_dict["native_vlan"] = "1"
            intf_dict["allowed_vlan"] = "1"
            intf_dict["allowed_vlan_add"] = "1"
            intf_list.append(intf_dict)
    return intf_list


def show_interfaces_status(device: Device):

    nr = InitNornir(config_file="./app/automation/config.yaml")
    rtr = nr.filter(name=device.hostname)
    if device.platform == "eos":
        result = rtr.run(
            task=netmiko_send_command, command_string="show interface status"
        )
        result_dict = {host: task.result for host, task in result.items()}
        nr.close_connections()
        return parser_show_interface_status(
            data=result_dict[device.hostname].split("\n")
        )
    elif device.platform in ["ios", "nxos_ssh"]:
        result = rtr.run(
            task=netmiko_send_command, command_string="show interface status"
        )
        result_dict = {host: task.result for host, task in result.items()}

        result2 = rtr.run(
            task=netmiko_send_command,
            command_string="show running-config | section interface",
        )
        result_dict2 = {host: task.result for host, task in result2.items()}

        nr.close_connections()
        list_interfaces = parser_show_interface_status(
            data=result_dict[device.hostname].split("\n")
        )
        result_run_interface = show_run_interface(
            data=result_dict2[device.hostname], device=device
        )

        list_run_interfaces = []
        for list_interface in list_interfaces:
            for run_interface in result_run_interface:
                if list_interface["port"] == run_interface["interface"]:
                    combined_dict = list_interface.copy()
                    combined_dict.update(run_interface)
                    list_run_interfaces.append(combined_dict)
                    break
        return list_run_interfaces
    elif device.platform == "junos":
        result = rtr.run(
            task=netmiko_send_command, command_string="show configuration interfaces"
        )
        result_dict = {host: task.result for host, task in result.items()}
        nr.close_connections()
        result_run_interface = show_run_interface(
            data=result_dict[device.hostname], device=device
        )
        list_run_interfaces = []
        for interface_info in result_run_interface:
            interface_dict = {
                "port": interface_info["interface"],
                "description": "",
                "status": "n/a",
                "vlan": "1",
                "duplex": "n/a",
                "speed": "n/a",
                "type": "n/a",
                "mode": "access",
                "native_vlan": "0",
                "allowed_vlan": "1",
                "allowed_vlan_add": "1",
            }
            if "description" in interface_info:
                interface_dict["description"] = interface_info["description"]
            if "mode" in interface_info:
                interface_dict["mode"] = interface_info["mode"]
            if "vlan" in interface_info:
                interface_dict["vlan"] = interface_info["vlan"]
            if "native_vlan" in interface_info:
                interface_dict["native_vlan"] = interface_info["native_vlan"]
            if "allowed_vlan" in interface_info:
                interface_dict["allowed_vlan"] = ",".join(
                    interface_info["allowed_vlan"].split(" ")
                )
            list_run_interfaces.append(interface_dict)
        return list_run_interfaces


class DeviceAuthenticationError(Exception):
    """Exception raised when device authentication fails."""

    pass


class DeviceConnectionError(Exception):
    """Exception raised when device connection fails for other reasons."""

    pass


def is_auth_error(exc: Exception) -> bool:
    if not exc:
        return False
    exc_name = exc.__class__.__name__.lower()
    exc_str = str(exc).lower()

    if "auth" in exc_name or "credential" in exc_name:
        return True

    auth_keywords = [
        "authentication failed",
        "authentication failure",
        "wrong password",
        "bad password",
        "password",
        "credentials",
        "login failed",
        "permission denied",
    ]
    return any(kw in exc_str for kw in auth_keywords)


def _safe_napalm_get_task(task, getters: list[str]):
    device = task.host.get_connection("napalm", task.nornir.config)
    res = {}
    for getter in getters:
        try:
            res[getter] = getattr(device, getter)()
        except Exception:
            if getter in ("get_mac_address_table", "get_arp_table"):
                res[getter] = []
            else:
                res[getter] = {}

    facts = res.get("get_facts") or {}
    if task.host.platform == "junos":
        facts.setdefault("vendor", "Juniper")
        facts.setdefault("hostname", task.host.name)
    res["get_facts"] = facts
    return res


def get_metadata(device: Device):
    nr = InitNornir(config_file="./app/automation/config.yaml")
    rtr = nr.filter(name=device.hostname)
    getters = [
        "get_facts",
        "get_mac_address_table",
        "get_arp_table",
        "get_interfaces_ip",
    ]
    if device.platform == "junos":
        getters.append("get_interfaces")

    result = rtr.run(
        task=_safe_napalm_get_task,
        getters=getters,
    )

    if result.failed:
        nr.close_connections()
        exc = None
        if device.hostname in result:
            host_result = result[device.hostname]
            exc = host_result.exception
            if not exc and len(host_result) > 0:
                for sub_res in host_result:
                    if sub_res.failed and sub_res.exception:
                        exc = sub_res.exception
                        break

        exc_str = str(exc) if exc else "Unknown Nornir task failure"
        if exc and is_auth_error(exc):
            raise DeviceAuthenticationError(exc_str)
        else:
            raise DeviceConnectionError(exc_str)

    result_dict = {
        host: task.result for host, task in result.items() if not task.failed
    }
    nr.close_connections()
    return result_dict


def get_metadata_all():
    nr = InitNornir(config_file="./app/automation/config.yaml")
    result = nr.run(
        task=_safe_napalm_get_task,
        getters=[
            "get_facts",
            "get_mac_address_table",
            "get_arp_table",
            "get_interfaces_ip",
            "get_interfaces",
        ],
    )

    result_dict = {host: task.result for host, task in result.items() if not task.failed}
    nr.close_connections()
    return result_dict
