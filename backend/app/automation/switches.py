from nornir import InitNornir
from nornir.core.task import Task, Result
from nornir_utils.plugins.functions import print_result
from nornir_napalm.plugins.tasks import napalm_get
import json
from datetime import datetime


def get_metadata(hostname: str):
    nr = InitNornir(config_file="./app/automation/config.yaml")
    rtr = nr.filter(name=hostname)
    result = rtr.run(task=napalm_get, getters=["get_facts"])
    result_dict = {host: task.result for host, task in result.items()}

    return result_dict
