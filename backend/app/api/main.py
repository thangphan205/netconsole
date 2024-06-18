from fastapi import APIRouter

from app.api.routes import (
    items,
    login,
    users,
    utils,
    switches,
    interfaces,
    logs,
    mac_addresses,
    arps,
    groups,
    ip_interfaces,
    group_config,
)

api_router = APIRouter()
api_router.include_router(login.router, tags=["login"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(utils.router, prefix="/utils", tags=["utils"])
api_router.include_router(items.router, prefix="/items", tags=["items"])
api_router.include_router(groups.router, prefix="/groups", tags=["groups"])
api_router.include_router(switches.router, prefix="/switches", tags=["switches"])
api_router.include_router(interfaces.router, prefix="/interfaces", tags=["interfaces"])
api_router.include_router(
    mac_addresses.router, prefix="/mac_addresses", tags=["mac_addresses"]
)
api_router.include_router(arps.router, prefix="/arps", tags=["arps"])
api_router.include_router(
    ip_interfaces.router, prefix="/ip_interfaces", tags=["ip_interfaces"]
)
api_router.include_router(
    group_config.router, prefix="/group_config", tags=["group_config"]
)
api_router.include_router(logs.router, prefix="/logs", tags=["logs"])
