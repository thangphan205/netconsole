import asyncio
import json
from typing import Any

from fastapi import APIRouter, HTTPException, Request
from sqlmodel import col, select

from app.api.deps import CurrentUser, SessionDep
from app.crud.audit import write_audit_log
from app.crud.config_revisions import snapshot_device_config
from app.crud.group_config import create_group_config as create_group_config_model
from app.models import Device, GroupConfigCreate

router = APIRouter()


def _group_devices(session: SessionDep, group_name: str) -> list[Device]:
    statement = select(Device).where(col(Device.groups).contains(group_name))
    return list(session.exec(statement).all())


@router.post("/")
async def create_group_config(
    *,
    request: Request,
    session: SessionDep,
    current_user: CurrentUser,
    group_in: GroupConfigCreate,
) -> Any:
    """
    Push config or run show command against all devices in a group.
    """
    if not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    devices = _group_devices(session, group_in.group_name)
    snapshot_warnings: list[str] = []

    async def snapshot_all(
        action: str, commands: str = "", command_type: str = ""
    ) -> None:
        for device in devices:
            try:
                await asyncio.to_thread(
                    snapshot_device_config,
                    session,
                    device,
                    action=action,
                    username=current_user.email,
                    user_email=current_user.email,
                    commands=commands,
                    command_type=command_type,
                )
            except Exception as exc:  # snapshot failure must never block the push
                # Clear any half-applied transaction so the shared session
                # stays usable for the remaining devices and the audit log.
                session.rollback()
                snapshot_warnings.append(
                    f"{device.hostname}: {action} snapshot failed: {exc}"
                )

    if group_in.command_type == "config":
        await snapshot_all("pre_push")

    group = await asyncio.to_thread(create_group_config_model, group_in)

    if group_in.command_type == "config":
        await snapshot_all(
            "post_push",
            commands=group_in.commands,
            command_type=group_in.command_type,
        )

    write_audit_log(
        session,
        username=current_user.email,
        action="push_group_config",
        client_ip=request.client.host if request.client else "",
        message=f"Pushed {group_in.command_type} to group {group_in.group_name}: {group_in.commands[:200]}",
        severity="WARNING" if group_in.command_type == "config" else "INFO",
    )
    if snapshot_warnings:
        write_audit_log(
            session,
            username=current_user.email,
            action="snapshot_config",
            client_ip=request.client.host if request.client else "",
            message=f"Group {group_in.group_name}: " + "; ".join(snapshot_warnings),
            severity="WARNING",
        )
    response: dict[str, Any] = {
        "status": True,
        "message": json.dumps(group, default=str),
    }
    if snapshot_warnings:
        response["snapshot_warning"] = "; ".join(snapshot_warnings)
    return response
