from sqlmodel import Session, col, delete, func, select

from app.automation.config_backup import get_running_config
from app.core import config_store
from app.models import ConfigRevision, Device


def snapshot_device_config(
    session: Session,
    device: Device,
    *,
    action: str,
    username: str,
    user_email: str,
    commands: str = "",
    command_type: str = "",
    message: str = "",
) -> ConfigRevision | None:
    """Fetch the running config, commit it to the device's git repo and record
    a revision row.

    Returns None when nothing changed and the action is a plain snapshot
    (manual/scheduled). pre_push/post_push/rollback revisions are always
    recorded (pointing at HEAD) so pushes stay traceable.
    """
    assert device.id is not None
    commit_message = f"{action}: {device.hostname}"
    if message:
        commit_message += f"\n\n{message}"
    if commands:
        commit_message += (
            f"\n\nCommand-Type: {command_type}\nPushed-Commands:\n{commands}"
        )

    with config_store.repo_lock(device.id):
        config_text = get_running_config(device)
        commit_hash, changed = config_store.commit_config(
            device.id,
            config_text,
            message=commit_message,
            author_name=username or user_email,
            author_email=user_email,
        )

    if not changed and action in ("manual", "scheduled"):
        return None

    revision = ConfigRevision(
        device_id=device.id,
        commit_hash=commit_hash,
        action=action,
        username=username,
        command_type=command_type,
        commands=commands,
        message=message,
    )
    session.add(revision)
    session.commit()
    session.refresh(revision)
    return revision


def get_revisions(
    session: Session, device_id: int, skip: int = 0, limit: int = 100
) -> list[ConfigRevision]:
    statement = (
        select(ConfigRevision)
        .where(ConfigRevision.device_id == device_id)
        .order_by(ConfigRevision.id.desc())  # type: ignore[union-attr]
        .offset(skip)
        .limit(limit)
    )
    return list(session.exec(statement).all())


def get_revisions_count(session: Session, device_id: int) -> int:
    statement = (
        select(func.count())
        .select_from(ConfigRevision)
        .where(ConfigRevision.device_id == device_id)
    )
    return session.exec(statement).one()


def get_revision(
    session: Session, device_id: int, revision_id: int
) -> ConfigRevision | None:
    revision = session.get(ConfigRevision, revision_id)
    if revision and revision.device_id == device_id:
        return revision
    return None


def get_previous_revision(
    session: Session, revision: ConfigRevision
) -> ConfigRevision | None:
    statement = (
        select(ConfigRevision)
        .where(ConfigRevision.device_id == revision.device_id)
        .where(ConfigRevision.id < revision.id)  # type: ignore[operator]
        .order_by(ConfigRevision.id.desc())  # type: ignore[union-attr]
        .limit(1)
    )
    return session.exec(statement).first()


def delete_revisions_by_device_id(session: Session, device_id: int) -> None:
    statement = delete(ConfigRevision).where(col(ConfigRevision.device_id) == device_id)
    session.exec(statement)
    session.commit()
    config_store.delete_repo(device_id)
