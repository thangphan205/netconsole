from fastapi import APIRouter

from app.api.routes import items, login, users, utils, switches, interfaces, logs

api_router = APIRouter()
api_router.include_router(login.router, tags=["login"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(utils.router, prefix="/utils", tags=["utils"])
api_router.include_router(items.router, prefix="/items", tags=["items"])
api_router.include_router(switches.router, prefix="/switches", tags=["switches"])
api_router.include_router(interfaces.router, prefix="/interfaces", tags=["interfaces"])
api_router.include_router(logs.router, prefix="/logs", tags=["logs"])
