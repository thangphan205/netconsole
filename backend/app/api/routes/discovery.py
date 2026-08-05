import asyncio
import re
from typing import Any

from fastapi import APIRouter, HTTPException, Request
from sqlmodel import select

from app.api.deps import CurrentUser, SessionDep, get_client_ip
from app.automation.discovery import (
    expand_cidr,
    identify_hosts_parallel,
    scan_subnet,
)
from app.core.crypto import decrypt_password
from app.crud.audit import write_audit_log
from app.crud.devices import bulk_create_devices, get_device_by_name
from app.models import (
    Credential,
    Device,
    DiscoveryAddError,
    DiscoveryAddPublic,
    DiscoveryAddRequest,
    DiscoveryCandidatePublic,
    DiscoveryHostPublic,
    DiscoveryIdentifyPublic,
    DiscoveryIdentifyRequest,
    DiscoveryScanPublic,
    DiscoveryScanRequest,
)

router = APIRouter()

HOSTNAME_RE = re.compile(r"^[a-zA-Z0-9_]+$")
MAX_IDENTIFY_IPS = 16


def _require_superuser(current_user: CurrentUser) -> None:
    if not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Not enough permissions")


@router.post("/scan", response_model=DiscoveryScanPublic)
async def discovery_scan(
    *,
    request: Request,
    session: SessionDep,
    current_user: CurrentUser,
    scan_in: DiscoveryScanRequest,
) -> Any:
    """
    TCP-sweep a subnet for hosts with the SSH port open. Marks IPs that are
    already registered as devices.
    """
    _require_superuser(current_user)
    try:
        ips = expand_cidr(scan_in.cidr)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    if not 1 <= scan_in.port <= 65535:
        raise HTTPException(status_code=400, detail="Invalid port")
    timeout = min(max(scan_in.tcp_timeout, 0.5), 5.0)

    open_ips = await asyncio.to_thread(scan_subnet, ips, scan_in.port, timeout)

    existing = {
        s.ipaddress: s for s in session.exec(select(Device)).all() if s.ipaddress
    }
    hosts = [
        DiscoveryHostPublic(
            ip=ip,
            port=scan_in.port,
            existing=ip in existing,
            existing_device_id=existing[ip].id if ip in existing else None,
            existing_hostname=existing[ip].hostname if ip in existing else None,
        )
        for ip in open_ips
    ]
    write_audit_log(
        session,
        username=current_user.email,
        action="discovery_scan",
        client_ip=get_client_ip(request),
        message=f"Scanned {scan_in.cidr}: {len(open_ips)}/{len(ips)} hosts with "
        f"port {scan_in.port} open",
    )
    return DiscoveryScanPublic(
        cidr=scan_in.cidr,
        total_hosts=len(ips),
        open_count=len(open_ips),
        hosts=hosts,
    )


@router.post("/identify", response_model=DiscoveryIdentifyPublic)
async def discovery_identify(
    *,
    request: Request,
    session: SessionDep,
    current_user: CurrentUser,
    identify_in: DiscoveryIdentifyRequest,
) -> Any:
    """
    SSH into up to 8 hosts: try the given credentials, autodetect platform and
    pull device facts. Returns one candidate per IP.
    """
    _require_superuser(current_user)
    if not identify_in.ips or len(identify_in.ips) > MAX_IDENTIFY_IPS:
        raise HTTPException(
            status_code=422,
            detail=f"ips must contain between 1 and {MAX_IDENTIFY_IPS} addresses",
        )
    if not identify_in.credential_ids:
        raise HTTPException(status_code=422, detail="credential_ids must not be empty")

    credentials = []
    for cred_id in identify_in.credential_ids:
        credential = session.get(Credential, cred_id)
        if not credential:
            raise HTTPException(
                status_code=404, detail=f"Credential {cred_id} not found"
            )
        credentials.append(
            {
                "id": credential.id,
                "username": credential.username,
                "password": decrypt_password(credential.password or ""),
            }
        )

    registered = {
        s.ipaddress for s in session.exec(select(Device)).all() if s.ipaddress
    }
    ips = [ip for ip in identify_in.ips if ip not in registered]

    candidates: list[dict[str, Any]] = []
    if ips:
        candidates = await asyncio.to_thread(
            identify_hosts_parallel, ips, identify_in.port, credentials
        )
    write_audit_log(
        session,
        username=current_user.email,
        action="discovery_identify",
        client_ip=get_client_ip(request),
        message=f"Identified {len(ips)} discovered hosts: {', '.join(ips[:10])}",
    )
    return DiscoveryIdentifyPublic(
        candidates=[DiscoveryCandidatePublic(**c) for c in candidates]
    )


@router.post("/add", response_model=DiscoveryAddPublic)
async def discovery_add(
    *,
    request: Request,
    session: SessionDep,
    current_user: CurrentUser,
    add_in: DiscoveryAddRequest,
) -> Any:
    """
    Bulk-add reviewed discovery candidates as devices. Per-row validation;
    valid rows are inserted with a single commit and one inventory regen.
    """
    _require_superuser(current_user)
    if not add_in.devices:
        raise HTTPException(status_code=422, detail="devices must not be empty")

    existing_ips = {
        s.ipaddress for s in session.exec(select(Device)).all() if s.ipaddress
    }
    errors: list[DiscoveryAddError] = []
    valid = []
    seen_hostnames: set[str] = set()
    seen_ips: set[str] = set()
    for row in add_in.devices:
        detail = ""
        if not HOSTNAME_RE.match(row.hostname or ""):
            detail = "hostname must match [a-zA-Z0-9_]"
        elif row.hostname in seen_hostnames or get_device_by_name(
            session=session, hostname=row.hostname
        ):
            detail = "hostname already exists"
        elif not row.ipaddress:
            detail = "ipaddress required"
        elif row.ipaddress in seen_ips or row.ipaddress in existing_ips:
            detail = "ipaddress already exists"
        elif row.credential_id and not session.get(Credential, row.credential_id):
            detail = f"credential {row.credential_id} not found"

        if detail:
            errors.append(
                DiscoveryAddError(
                    hostname=row.hostname or "",
                    ipaddress=row.ipaddress or "",
                    detail=detail,
                )
            )
            continue
        seen_hostnames.add(row.hostname)
        seen_ips.add(row.ipaddress)
        valid.append(row)

    created: list[Device] = []
    if valid:
        created = bulk_create_devices(session, valid)
        write_audit_log(
            session,
            username=current_user.email,
            action="discovery_add",
            client_ip=get_client_ip(request),
            message=f"Bulk-added {len(created)} discovered devices: "
            + ", ".join(s.hostname for s in created)[:200],
        )
    return DiscoveryAddPublic(created=created, errors=errors)
