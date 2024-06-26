import yaml

from app.core.config import settings


def create_hosts(switches_db: any):
    switch_dict_nornir = {}

    for switch, credential in switches_db:
        switch_dict = switch.__dict__
        credential_dict = credential.__dict__
        switch_dict_nornir[switch_dict["hostname"]] = {
            "hostname": switch_dict["ipaddress"],
            "platform": switch_dict["platform"],
            "device_type": switch_dict["device_type"],
            "groups": switch_dict["groups"],
        }
        if switch_dict["port"]:
            switch_dict_nornir[switch_dict["hostname"]]["port"] = switch_dict["port"]
        if switch_dict["credential_id"] > 0:
            switch_dict_nornir[switch_dict["hostname"]]["username"] = credential_dict[
                "username"
            ]
            switch_dict_nornir[switch_dict["hostname"]]["password"] = credential_dict[
                "password"
            ]
        else:
            switch_dict_nornir[switch_dict["hostname"]][
                "username"
            ] = settings.NETWORK_USERNAME
            switch_dict_nornir[switch_dict["hostname"]][
                "password"
            ] = settings.NETWORK_PASSWORD
        if switch_dict["groups"]:
            switch_dict_nornir[switch_dict["hostname"]]["groups"] = switch_dict[
                "groups"
            ].split(",")
    with open("./app/automation/inventory/hosts.yaml", "w") as file:
        yaml.dump(switch_dict_nornir, file, default_flow_style=False)


def create_groups(groups_db: any):
    group_dict_nornir = {}
    group_dict_nornir["SWITCH"] = {"data": {"site": "default"}}
    group_dict_nornir["cisco_nxos"] = {"platform": "nxos"}
    group_dict_nornir["cisco_ios"] = {"platform": "ios"}
    group_dict_nornir["juniper_junos"] = {"platform": "junos"}
    for group in groups_db:
        group_dict = group.__dict__
        group_dict_nornir[group_dict["name"]] = {
            "groups": ["SWITCH"],
            "data": {"group_site": group_dict["site"]},
        }

    with open("./app/automation/inventory/groups.yaml", "w") as file:
        yaml.dump(group_dict_nornir, file, default_flow_style=False)
