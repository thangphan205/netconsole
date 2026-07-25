"""Git-backed store for per-device config revisions.

Each device gets a non-bare git repository at {CONFIG_REPO_DIR}/{device_id}/
tracking a single file, running-config.txt. Config text lives only in git;
the configrevision DB table stores metadata pointing at commit hashes.
"""

import fcntl
import subprocess
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path

from app.core.config import settings

CONFIG_FILENAME = "running-config.txt"
COMMITTER_NAME = "netconsole"
COMMITTER_EMAIL = "netconsole@localhost"


class ConfigStoreError(Exception):
    pass


def _repo_path(device_id: int) -> Path:
    return Path(settings.CONFIG_REPO_DIR) / str(device_id)


def _git(
    device_id: int, *args: str, env: dict[str, str] | None = None
) -> subprocess.CompletedProcess[str]:
    base_env = {
        "GIT_COMMITTER_NAME": COMMITTER_NAME,
        "GIT_COMMITTER_EMAIL": COMMITTER_EMAIL,
        "GIT_AUTHOR_NAME": COMMITTER_NAME,
        "GIT_AUTHOR_EMAIL": COMMITTER_EMAIL,
        # Ignore host/user gitconfig so behavior is identical everywhere
        "GIT_CONFIG_GLOBAL": "/dev/null",
        "GIT_CONFIG_SYSTEM": "/dev/null",
        "HOME": str(_repo_path(device_id)),
    }
    if env:
        base_env.update(env)
    try:
        return subprocess.run(
            ["git", *args],
            cwd=_repo_path(device_id),
            env=base_env,
            capture_output=True,
            text=True,
            check=True,
        )
    except subprocess.CalledProcessError as exc:
        raise ConfigStoreError(
            f"git {' '.join(args)} failed for device {device_id}: {exc.stderr.strip()}"
        ) from exc
    except FileNotFoundError as exc:
        raise ConfigStoreError("git binary not found") from exc


@contextmanager
def repo_lock(device_id: int) -> Iterator[None]:
    """Serialize snapshot/rollback per device across gunicorn worker processes."""
    repo = ensure_repo(device_id)
    lock_file = repo / ".netconsole.lock"
    with open(lock_file, "w") as fh:
        fcntl.flock(fh, fcntl.LOCK_EX)
        try:
            yield
        finally:
            fcntl.flock(fh, fcntl.LOCK_UN)


def ensure_repo(device_id: int) -> Path:
    repo = _repo_path(device_id)
    repo.mkdir(parents=True, exist_ok=True)
    if not (repo / ".git").is_dir():
        _git(device_id, "init", "-b", "main")
    return repo


def commit_config(
    device_id: int,
    config_text: str,
    *,
    message: str,
    author_name: str,
    author_email: str,
) -> tuple[str, bool]:
    """Write config and commit. Returns (commit_hash, changed).

    When the config is identical to HEAD, no commit is made and the current
    HEAD hash is returned with changed=False.
    """
    ensure_repo(device_id)
    repo = _repo_path(device_id)
    if not config_text.endswith("\n"):
        config_text += "\n"
    (repo / CONFIG_FILENAME).write_text(config_text)
    _git(device_id, "add", CONFIG_FILENAME)

    status = _git(device_id, "status", "--porcelain", "--", CONFIG_FILENAME)
    if not status.stdout.strip():
        head = _git(device_id, "rev-parse", "HEAD")
        return head.stdout.strip(), False

    _git(
        device_id,
        "commit",
        "-m",
        message,
        env={
            "GIT_AUTHOR_NAME": author_name or COMMITTER_NAME,
            "GIT_AUTHOR_EMAIL": author_email or COMMITTER_EMAIL,
        },
    )
    _git(device_id, "gc", "--auto", "--quiet")
    head = _git(device_id, "rev-parse", "HEAD")
    return head.stdout.strip(), True


def get_config_at(device_id: int, commit_hash: str) -> str:
    result = _git(device_id, "show", f"{commit_hash}:{CONFIG_FILENAME}")
    return result.stdout


def diff_commits(device_id: int, base: str, target: str) -> str:
    result = _git(device_id, "diff", "--no-color", base, target, "--", CONFIG_FILENAME)
    return result.stdout


def delete_repo(device_id: int) -> None:
    import shutil

    repo = _repo_path(device_id)
    if repo.is_dir():
        shutil.rmtree(repo, ignore_errors=True)
