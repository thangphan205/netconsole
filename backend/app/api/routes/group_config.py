import asyncio
import json
from typing import Any

from fastapi import APIRouter, HTTPException

from app.api.deps import CurrentUser
from app.crud.group_config import create_group_config as create_group_config_model
from app.models import GroupConfigCreate

router = APIRouter()


@router.post("/")
async def create_group_config(
    *, current_user: CurrentUser, group_in: GroupConfigCreate
) -> Any:
    """
    Push config or run show command against all devices in a group.
    """
    if not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    group = await asyncio.to_thread(create_group_config_model, group_in)
    return {"status": True, "message": json.dumps(group, default=str)}
