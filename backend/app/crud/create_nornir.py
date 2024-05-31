import yaml

from app.core.config import settings


def create_hosts(switches_db: any):
    switch_dict_nornir = {}

    for switch in switches_db:
        switch_dict = switch.__dict__
        print(switch_dict)
        switch_dict_nornir[switch_dict["hostname"]] = {
            "hostname": switch_dict["ipaddress"],
            "username": settings.NETWORK_USERNAME,
            "password": settings.NETWORK_PASSWORD,
            "platform": switch_dict["platform"],
            "device_type": switch_dict["device_type"],
            "groups": switch_dict["groups"].split(","),
        }

    with open("./app/automation/inventory/hosts.yaml", "w") as file:
        yaml.dump(switch_dict_nornir, file, default_flow_style=False)


def create_groups(groups_db: any):
    group_dict_nornir = {}
    group_dict_nornir["cisco_nxos"] = {"platform": "nxos"}
    for group in groups_db:
        group_dict = group.__dict__
        print(group_dict)
        group_dict_nornir[group_dict["name"]] = {
            "data": {"location": group_dict["name"]},
            "groups": group_dict["name"].split(","),
        }

    with open("./app/automation/inventory/groups.yaml", "w") as file:
        yaml.dump(group_dict_nornir, file, default_flow_style=False)
