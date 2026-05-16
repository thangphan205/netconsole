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
    data = "username={}&password={}".format(USERNAME, PASSWORD)
    response = requests.post(URL + "/login/access-token", headers=headers, data=data)
    if response.status_code == 200:
        return cast(dict[str, Any], response.json())
    else:
        print(f"Error updating data: {response.status_code} - {response.text}")
        return {"status": False}


def get_switches(headers: dict[str, str]) -> dict[str, Any]:
    response = requests.get(URL + "/switches", headers=headers)
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
    switches = get_switches(headers=headers)
    if switches["count"] > 0:
        for switch in switches["data"]:
            print("sync running config on switch: {}".format(switch["hostname"]))
            requests.put(
                URL + "/switches/{}/metadata".format(str(switch["id"])), headers=headers
            )
    return True


get_running_config()
