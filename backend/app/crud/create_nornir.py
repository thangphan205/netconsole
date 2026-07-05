import os
import tempfile

import yaml

from app.core.config import settings
from app.core.crypto import decrypt_password

_INVENTORY_DIR = "./app/automation/inventory"


def _write_yaml_atomic(path: str, data: dict) -> None:
    os.makedirs(_INVENTORY_DIR, exist_ok=True)
    fd, tmp_path = tempfile.mkstemp(dir=_INVENTORY_DIR, prefix=f".{os.path.basename(path)}.")
    try:
        with os.fdopen(fd, "w") as file:
            yaml.dump(data, file, default_flow_style=False)
        os.replace(tmp_path, path)
    except BaseException:
        os.remove(tmp_path)
        raise


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
            raw_password = (
                decrypt_password(credential_dict["password"])
                if credential_dict.get("password")
                else ""
            )
            switch_dict_nornir[switch_dict["hostname"]]["password"] = raw_password
            raw_enable_password = (
                decrypt_password(credential_dict["enable_password"])
                if credential_dict.get("enable_password")
                else raw_password
            )
        else:
            switch_dict_nornir[switch_dict["hostname"]]["username"] = (
                settings.NETWORK_USERNAME
            )
            switch_dict_nornir[switch_dict["hostname"]]["password"] = (
                settings.NETWORK_PASSWORD
            )
            raw_enable_password = settings.NETWORK_PASSWORD
        if switch_dict["groups"]:
            switch_dict_nornir[switch_dict["hostname"]]["groups"] = switch_dict[
                "groups"
            ].split(",")
        if switch_dict["platform"] == "eos":
            switch_dict_nornir[switch_dict["hostname"]]["connection_options"] = {
                "napalm": {
                    "extras": {
                        "optional_args": {
                            "transport": "ssh",
                            "secret": raw_enable_password,
                            "global_delay_factor": 2,
                            "fast_cli": False,
                        }
                    }
                },
                "netmiko": {
                    "platform": "arista_eos",
                    "extras": {
                        "secret": raw_enable_password,
                        "global_delay_factor": 2,
                        "fast_cli": False,
                    },
                },
            }
        elif (
            raw_enable_password
            != switch_dict_nornir[switch_dict["hostname"]]["password"]
        ):
            switch_dict_nornir[switch_dict["hostname"]]["connection_options"] = {
                "netmiko": {"extras": {"secret": raw_enable_password}},
            }
    _write_yaml_atomic(f"{_INVENTORY_DIR}/hosts.yaml", switch_dict_nornir)


def create_groups(groups_db: any):
    group_dict_nornir: dict = {}
    group_dict_nornir["SWITCH"] = {"data": {"site": "default"}}
    for group in groups_db:
        group_dict = group.__dict__
        group_dict_nornir[group_dict["name"]] = {
            "groups": ["SWITCH"],
            "data": {"group_site": group_dict["site"]},
        }
    # Platform groups written last so they always take precedence over
    # any user-defined group with the same name.
    group_dict_nornir["cisco_nxos"] = {"platform": "nxos"}
    group_dict_nornir["cisco_ios"] = {"platform": "ios"}
    group_dict_nornir["juniper_junos"] = {"platform": "junos"}
    group_dict_nornir["arista_eos"] = {"platform": "eos"}

    _write_yaml_atomic(f"{_INVENTORY_DIR}/groups.yaml", group_dict_nornir)
