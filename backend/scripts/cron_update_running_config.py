from typing import Any, cast

import requests

URL = "http://localhost/api/v1"
USERNAME = "admin@example.com"
PASSWORD = "xxx"


def get_token() -> dict[str, Any]:
    """ """
    headers = {
        "Accept": "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
    }
    data = f"username={USERNAME}&password={PASSWORD}"
    response = requests.post(URL + "/login/access-token", headers=headers, data=data)
    if response.status_code == 200:
        return cast(dict[str, Any], response.json())
    else:
        print(f"Error updating data: {response.status_code} - {response.text}")
        return {"status": False}


def get_devices(headers: dict[str, str]) -> dict[str, Any]:
    response = requests.get(URL + "/devices", headers=headers)
    if response.status_code == 200:
        return cast(dict[str, Any], response.json())
    else:
        print(f"Error updating data: {response.status_code} - {response.text}")
        return {"data": [], "count": 0}


def get_running_config() -> bool:
    token = get_token()
    headers = {
        "Accept": "application/json",
        "Authorization": "Bearer {}".format(token["access_token"]),
    }
    devices = get_devices(headers=headers)
    if devices["count"] > 0:
        for device in devices["data"]:
            print("sync running config on device: {}".format(device["hostname"]))
            requests.put(
                URL + "/devices/{}/metadata".format(str(device["id"])), headers=headers
            )
    return True


get_running_config()
