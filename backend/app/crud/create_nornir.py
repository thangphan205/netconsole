import os
import tempfile

import yaml

from app.core.config import settings
from app.core.crypto import decrypt_password

_INVENTORY_DIR = "./app/automation/inventory"


def _write_yaml_atomic(path: str, data: dict) -> None:
    os.makedirs(_INVENTORY_DIR, exist_ok=True)
    fd, tmp_path = tempfile.mkstemp(
        dir=_INVENTORY_DIR, prefix=f".{os.path.basename(path)}."
    )
    try:
        with os.fdopen(fd, "w") as file:
            yaml.dump(data, file, default_flow_style=False)
        os.replace(tmp_path, path)
    except BaseException:
        os.remove(tmp_path)
        raise


def create_hosts(devices_db: any):
    device_dict_nornir = {}

    for item in devices_db:
        if hasattr(item, "__getitem__"):
            device = item[0]
            credential = item[1] if len(item) > 1 else None
        else:
            device = item
            credential = None

        device_dict = device.__dict__
        credential_dict = credential.__dict__ if credential else {}

        device_dict_nornir[device_dict["hostname"]] = {
            "hostname": device_dict["ipaddress"],
            "platform": device_dict["platform"],
            "device_type": device_dict["device_type"],
            "groups": device_dict["groups"],
        }
        if device_dict.get("port"):
            device_dict_nornir[device_dict["hostname"]]["port"] = device_dict["port"]
        if (
            device_dict.get("credential_id")
            and device_dict["credential_id"] > 0
            and credential_dict
        ):
            device_dict_nornir[device_dict["hostname"]]["username"] = credential_dict[
                "username"
            ]
            raw_password = (
                decrypt_password(credential_dict["password"])
                if credential_dict.get("password")
                else ""
            )
            device_dict_nornir[device_dict["hostname"]]["password"] = raw_password
            raw_enable_password = (
                decrypt_password(credential_dict["enable_password"])
                if credential_dict.get("enable_password")
                else raw_password
            )
        else:
            device_dict_nornir[device_dict["hostname"]]["username"] = (
                settings.NETWORK_USERNAME
            )
            device_dict_nornir[device_dict["hostname"]]["password"] = (
                settings.NETWORK_PASSWORD
            )
            raw_enable_password = settings.NETWORK_PASSWORD
        if device_dict["groups"]:
            device_dict_nornir[device_dict["hostname"]]["groups"] = device_dict[
                "groups"
            ].split(",")
        if device_dict["platform"] == "eos":
            device_dict_nornir[device_dict["hostname"]]["connection_options"] = {
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
        elif device_dict["platform"] in ("ios", "nxos_ssh"):
            device_dict_nornir[device_dict["hostname"]]["connection_options"] = {
                "napalm": {
                    "extras": {"optional_args": {"secret": raw_enable_password}}
                },
                "netmiko": {"extras": {"secret": raw_enable_password}},
            }
    _write_yaml_atomic(f"{_INVENTORY_DIR}/hosts.yaml", device_dict_nornir)


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


def regenerate_inventory() -> None:
    """Rebuild hosts.yaml and groups.yaml from the DB.

    The inventory dir is gitignored and not a Docker volume, so every
    container recreate starts with it empty. hosts.yaml is normally
    rewritten as a side effect of device CRUD, and groups.yaml as a side
    effect of group CRUD — until either happens, InitNornir crashes with
    a KeyError on a missing platform group. Call this at app startup so
    a fresh container is never in that half-populated state.
    """
    from sqlmodel import Session, select

    from app.core.db import engine
    from app.models import Credential, Device, Group

    with Session(engine) as session:
        devices_db = session.exec(
            select(Device, Credential).where(Device.credential_id == Credential.id)
        ).all()
        create_hosts(devices_db)
        groups_db = session.exec(select(Group)).all()
        create_groups(groups_db)
