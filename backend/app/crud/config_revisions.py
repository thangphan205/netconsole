from sqlmodel import Session, col, delete, func, select

from app.automation.config_backup import get_running_config
from app.core import config_store
from app.models import ConfigRevision, Switch


def snapshot_switch_config(
    session: Session,
    switch: Switch,
    *,
    action: str,
    username: str,
    user_email: str,
    commands: str = "",
    command_type: str = "",
    message: str = "",
) -> ConfigRevision | None:
    """Fetch the running config, commit it to the switch's git repo and record
    a revision row.

    Returns None when nothing changed and the action is a plain snapshot
    (manual/scheduled). pre_push/post_push/rollback revisions are always
    recorded (pointing at HEAD) so pushes stay traceable.
    """
    assert switch.id is not None
    commit_message = f"{action}: {switch.hostname}"
    if message:
        commit_message += f"\n\n{message}"
    if commands:
        commit_message += (
            f"\n\nCommand-Type: {command_type}\nPushed-Commands:\n{commands}"
        )

    with config_store.repo_lock(switch.id):
        config_text = get_running_config(switch)
        commit_hash, changed = config_store.commit_config(
            switch.id,
            config_text,
            message=commit_message,
            author_name=username or user_email,
            author_email=user_email,
        )

    if not changed and action in ("manual", "scheduled"):
        return None

    revision = ConfigRevision(
        switch_id=switch.id,
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
    session: Session, switch_id: int, skip: int = 0, limit: int = 100
) -> list[ConfigRevision]:
    statement = (
        select(ConfigRevision)
        .where(ConfigRevision.switch_id == switch_id)
        .order_by(ConfigRevision.id.desc())  # type: ignore[union-attr]
        .offset(skip)
        .limit(limit)
    )
    return list(session.exec(statement).all())


def get_revisions_count(session: Session, switch_id: int) -> int:
    statement = (
        select(func.count())
        .select_from(ConfigRevision)
        .where(ConfigRevision.switch_id == switch_id)
    )
    return session.exec(statement).one()


def get_revision(
    session: Session, switch_id: int, revision_id: int
) -> ConfigRevision | None:
    revision = session.get(ConfigRevision, revision_id)
    if revision and revision.switch_id == switch_id:
        return revision
    return None


def get_previous_revision(
    session: Session, revision: ConfigRevision
) -> ConfigRevision | None:
    statement = (
        select(ConfigRevision)
        .where(ConfigRevision.switch_id == revision.switch_id)
        .where(ConfigRevision.id < revision.id)  # type: ignore[operator]
        .order_by(ConfigRevision.id.desc())  # type: ignore[union-attr]
        .limit(1)
    )
    return session.exec(statement).first()


def delete_revisions_by_switch_id(session: Session, switch_id: int) -> None:
    statement = delete(ConfigRevision).where(col(ConfigRevision.switch_id) == switch_id)
    session.exec(statement)
    session.commit()
    config_store.delete_repo(switch_id)
