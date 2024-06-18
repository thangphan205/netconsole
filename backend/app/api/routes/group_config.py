from typing import Any
import json
from fastapi import APIRouter, HTTPException
from app.api.deps import CurrentUser, SessionDep
from app.models import (
    GroupConfigCreate,
)

from app.crud.group_config import create_group_config as create_group_config_model

router = APIRouter()


@router.post("/")
def create_group_config(
    *, session: SessionDep, current_user: CurrentUser, group_in: GroupConfigCreate
) -> Any:
    """
    Create new group.
    """
    group = create_group_config_model(session=session, group_in=group_in)
    return {"status": True, "message": json.dumps(group)}
