from nornir import InitNornir
from nornir_napalm.plugins.tasks import napalm_get
import ast
from nornir_netmiko import netmiko_send_command
from ttp import ttp

"""
Switch config to allow tool:

role name priv-1
  rule 1 permit read-write feature interface
  rule 2 permit read-write feature copy
  rule 3 permit read
  exit
username netconsole password changethis role priv-1

"""


def show_run_interface(data: str):
    ttp_template_cisco_nexus = """interface {{ interface }}\n  description {{ description | re(".*") }}\n  switchport mode {{ mode }}\n  switchport trunk native vlan {{ native_vlan }}\n  switchport trunk allowed vlan {{ allowed_vlan }}\n  switchport trunk allowed vlan add {{ allowed_vlan_add }}\n  switchport access vlan {{ vlan }}"""
    # create parser object and parse data using template:

    parser = ttp(data=data, template=ttp_template_cisco_nexus)
    parser.parse()

    # print result in JSON format
    results = parser.result(format="json")[0]

    return ast.literal_eval(results)[0]


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
            intf_dict["port"] = entry[0].replace("Eth", "Ethernet")

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
            intf_dict["mode"] = "access"
            intf_dict["native_vlan"] = "1"
            intf_dict["allowed_vlan"] = "1"
            intf_dict["allowed_vlan_add"] = "1"
            intf_list.append(intf_dict)
    return intf_list


def show_interfaces_status(hostname: str):

    nr = InitNornir(config_file="./app/automation/config.yaml")
    rtr = nr.filter(name=hostname)
    result = rtr.run(task=netmiko_send_command, command_string="show interface status")
    result_dict = {host: task.result for host, task in result.items()}

    result2 = rtr.run(
        task=netmiko_send_command,
        command_string="show running-config | section interface",
    )
    result_dict2 = {host: task.result for host, task in result2.items()}

    list_interfaces = parser_show_interface_status(
        data=result_dict[hostname].split("\n")
    )
    result_run_interface = show_run_interface(data=result_dict2[hostname])

    list_run_interfaces = []
    for list_interface in list_interfaces:
        for run_interface in result_run_interface:
            if list_interface["port"] == run_interface["interface"]:
                combined_dict = list_interface.copy()
                combined_dict.update(run_interface)
                list_run_interfaces.append(combined_dict)
                break
    return list_run_interfaces


def get_metadata(hostname: str):
    nr = InitNornir(config_file="./app/automation/config.yaml")
    rtr = nr.filter(name=hostname)
    result = rtr.run(
        task=napalm_get, getters=["get_facts", "get_mac_address_table", "get_arp_table"]
    )
    result_dict = {host: task.result for host, task in result.items()}

    return result_dict
