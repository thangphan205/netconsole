import ipaddress
from datetime import UTC, datetime
from typing import Any, Literal

from pydantic import field_validator, model_validator
from sqlalchemy import String, UniqueConstraint
from sqlmodel import Field, Relationship, SQLModel


# Shared properties
# TODO replace email str with EmailStr when sqlmodel supports it
class UserBase(SQLModel):
    email: str = Field(unique=True, index=True)
    is_active: bool = True
    is_superuser: bool = False
    full_name: str | None = None
    password_login_enabled: bool = True
    is_service_account: bool = False


# Properties to receive via API on creation
class UserCreate(UserBase):
    password: str


# TODO replace email str with EmailStr when sqlmodel supports it
class UserRegister(SQLModel):
    email: str
    password: str
    full_name: str | None = None


# Properties to receive via API on update, all are optional
# TODO replace email str with EmailStr when sqlmodel supports it
class UserUpdate(UserBase):
    email: str | None = None  # type: ignore
    password: str | None = None


# TODO replace email str with EmailStr when sqlmodel supports it
class UserUpdateMe(SQLModel):
    full_name: str | None = None
    email: str | None = None


class UpdatePassword(SQLModel):
    current_password: str
    new_password: str


# Database model, database table inferred from class name
class User(UserBase, table=True):
    id: int | None = Field(default=None, primary_key=True)
    hashed_password: str | None = None
    items: list["Item"] = Relationship(back_populates="owner")
    oauth_accounts: list["OAuthAccount"] = Relationship(back_populates="user")
    webauthn_credentials: list["WebAuthnCredential"] = Relationship(
        back_populates="user"
    )
    api_keys: list["ApiKey"] = Relationship(back_populates="user")


# Properties to return via API, id is always required
class UserPublic(UserBase):
    id: int
    auth_methods: list[str] = []


class UsersPublic(SQLModel):
    data: list[UserPublic]
    count: int


# Shared properties
class ItemBase(SQLModel):
    title: str
    description: str | None = None


# Properties to receive on item creation
class ItemCreate(ItemBase):
    title: str


# Properties to receive on item update
class ItemUpdate(ItemBase):
    title: str | None = None  # type: ignore


# Database model, database table inferred from class name
class Item(ItemBase, table=True):
    id: int | None = Field(default=None, primary_key=True)
    title: str
    owner_id: int | None = Field(default=None, foreign_key="user.id", nullable=False)
    owner: User | None = Relationship(back_populates="items")
    created_at: datetime = Field(default=datetime.now())
    updated_at: datetime = Field(default=datetime.now())


# Properties to return via API, id is always required
class ItemPublic(ItemBase):
    id: int
    owner_id: int
    created_at: datetime
    updated_at: datetime


class ItemsPublic(SQLModel):
    data: list[ItemPublic]
    count: int


# Generic message
class Message(SQLModel):
    message: str


# JSON payload containing access token
class Token(SQLModel):
    access_token: str
    token_type: str = "bearer"


# Contents of JWT token
class TokenPayload(SQLModel):
    sub: int | None = None


class NewPassword(SQLModel):
    token: str
    new_password: str


# Group Device
class GroupBase(SQLModel):
    name: str
    description: str
    site: str


# Properties to receive on group creation
class GroupCreate(GroupBase):
    name: str


# Properties to receive on group update
class GroupUpdate(GroupBase):
    name: str | None = None  # type: ignore
    description: str | None = None  # type: ignore
    site: str | None = None  # type: ignore


# Database model, database table inferred from class name
class Group(GroupBase, table=True):
    id: int | None = Field(default=None, primary_key=True)
    name: str = Field(index=True)
    site: str = Field(index=True)
    created_at: datetime = Field(default=datetime.now())
    updated_at: datetime = Field(default=datetime.now())


# Properties to return via API, id is always required
class GroupPublic(GroupBase):
    id: int
    created_at: datetime
    updated_at: datetime


class GroupsPublic(SQLModel):
    data: list[GroupPublic]
    count: int


# Credentials
class CredentialBase(SQLModel):
    username: str
    public_key: str | None = None
    private_key: str | None = None
    default: bool | None = None
    description: str = ""
    enable_password: str | None = None


# Properties to receive on arp creation
class CredentialCreate(CredentialBase):
    password: str


# Properties to receive on arp update
class CredentialUpdate(CredentialBase):
    username: str | None = None  # type: ignore
    password: str | None = None


# Database model, database table inferred from class name
class Credential(CredentialBase, table=True):
    id: int | None = Field(default=None, primary_key=True)
    username: str = Field(index=True)
    password: str | None = None
    created_at: datetime = Field(default=datetime.now())
    updated_at: datetime = Field(default=datetime.now())


# Properties to return via API, id is always required
class CredentialPublic(CredentialBase):
    id: int
    created_at: datetime
    updated_at: datetime


class CredentialsPublic(SQLModel):
    data: list[CredentialPublic]
    count: int


# Shared properties
class DeviceBase(SQLModel):
    hostname: str
    ipaddress: str
    groups: str | None = None
    platform: str | None = None
    device_type: str | None = None
    os_version: str | None = None
    model: str | None = None
    vendor: str | None = None
    serial_number: str | None = None
    description: str | None = None
    more_info: str | None = None
    credential_id: int | None = None
    port: int | None = None
    health_status: str | None = None


# Properties to receive on device creation
class DeviceCreate(DeviceBase):
    hostname: str


# Properties to receive on device update
class DeviceUpdate(DeviceBase):
    hostname: str | None = None  # type: ignore


# Properties to receive on device update
class DeviceUpdateMetadata(SQLModel):
    id: int


# Database model, database table inferred from class name
class Device(DeviceBase, table=True):
    id: int | None = Field(default=None, primary_key=True)
    hostname: str = Field(unique=True, index=True)
    created_at: datetime = Field(default=datetime.now())
    updated_at: datetime = Field(default=datetime.now())
    mac_addresses: list["MacAddress"] = Relationship(back_populates="device")
    arps: list["Arp"] = Relationship(back_populates="device")
    ip_interfaces: list["IpInterface"] = Relationship(back_populates="device")


# Properties to return via API, id is always required
class DevicePublic(DeviceBase):
    id: int
    created_at: datetime
    updated_at: datetime


class DevicesPublic(SQLModel):
    data: list[DevicePublic]
    count: int


# Interfaces
class InterfaceBase(SQLModel):
    port: str
    description: str
    status: str | None = None
    vlan: str | None = None
    duplex: str | None = None
    speed: str | None = None
    type: str | None = None
    device_id: int | None = None
    mode: str | None = None
    native_vlan: str | None = None
    allowed_vlan: str | None = None
    allowed_vlan_add: str | None = None


# Properties to receive on interface creation
class InterfaceCreate(InterfaceBase):
    port: str


# Properties to receive on interface update
class InterfaceUpdate(InterfaceBase):
    port: str | None = None  # type: ignore


# Database model, database table inferred from class name
class Interface(InterfaceBase, table=True):
    id: int | None = Field(default=None, primary_key=True)
    port: str = Field(index=True)
    device_id: int = Field(index=True)
    created_at: datetime = Field(default=datetime.now())
    updated_at: datetime = Field(default=datetime.now())


# Properties to return via API, id is always required
class InterfacePublic(InterfaceBase):
    id: int
    created_at: datetime
    updated_at: datetime


class InterfacesPublic(SQLModel):
    data: list[InterfacePublic]
    count: int


# Properties to return via API, id is always required
class LogPublic(SQLModel):
    id: int
    timestamp: str
    severity: str
    username: str
    client_ip: str
    action: str
    message: str


class LogsPublic(SQLModel):
    data: list[LogPublic]
    count: int


class AuditLog(SQLModel, table=True):
    __tablename__ = "auditlog"
    id: int | None = Field(default=None, primary_key=True)
    timestamp: datetime = Field(default_factory=lambda: datetime.now(UTC))
    severity: str = Field(default="INFO")
    username: str
    client_ip: str = Field(default="")
    action: str
    message: str = Field(default="")


# MAC Address
class MacAddressBase(SQLModel):
    mac: str
    interface: str
    vlan: int | None = None
    static: bool | None = None
    active: bool | None = None
    moves: int | None = None
    last_move: int | None = None
    device_id: int | None = None


# Properties to receive on mac address creation
class MacAddressCreate(MacAddressBase):
    mac: str


# Properties to receive on mac address update
class MacAddressUpdate(MacAddressBase):
    mac: str | None = None  # type: ignore
    interface: str | None = None  # type: ignore


# Database model, database table inferred from class name
class MacAddress(MacAddressBase, table=True):
    id: int | None = Field(default=None, primary_key=True)
    mac: str = Field(index=True)
    device_id: int = Field(default=None, foreign_key="device.id", nullable=False)
    device: Device | None = Relationship(back_populates="mac_addresses")
    created_at: datetime = Field(default=datetime.now())
    updated_at: datetime = Field(default=datetime.now())


# Properties to return via API, id is always required
class MacAddressPublic(MacAddressBase):
    id: int
    device_hostname: str = ""
    created_at: datetime
    updated_at: datetime


class MacAddressesPublic(SQLModel):
    data: list[MacAddressPublic]
    count: int


# IP ARP
class ArpBase(SQLModel):
    ip: str
    interface: str
    mac: str | None = None
    age: int | None = None
    device_id: int | None = None


# Properties to receive on arp creation
class ArpCreate(ArpBase):
    ip: str


# Properties to receive on arp update
class ArpUpdate(ArpBase):
    ip: str | None = None  # type: ignore
    interface: str | None = None  # type: ignore


# Database model, database table inferred from class name
class Arp(ArpBase, table=True):
    id: int | None = Field(default=None, primary_key=True)
    ip: str = Field(index=True)
    device_id: int = Field(default=None, foreign_key="device.id", nullable=False)
    device: Device | None = Relationship(back_populates="arps")
    created_at: datetime = Field(default=datetime.now())
    updated_at: datetime = Field(default=datetime.now())


# Properties to return via API, id is always required
class ArpPublic(ArpBase):
    id: int
    device_hostname: str = ""
    created_at: datetime
    updated_at: datetime


class ArpsPublic(SQLModel):
    data: list[ArpPublic]
    count: int


# IP Interface
class IpInterfaceBase(SQLModel):
    interface: str
    ipv4: str
    ipv6: str | None = None
    device_id: int | None = None


# Properties to receive on ip creation
class IpInterfaceCreate(IpInterfaceBase):
    ipv4: str


# Properties to receive on ip update
class IpInterfaceUpdate(IpInterfaceBase):
    ipv4: str | None = None  # type: ignore
    interface: str | None = None  # type: ignore


# Database model, database table inferred from class name
class IpInterface(IpInterfaceBase, table=True):
    id: int | None = Field(default=None, primary_key=True)
    ipv4: str = Field(index=True)
    device_id: int = Field(default=None, foreign_key="device.id", nullable=False)
    device: Device | None = Relationship(back_populates="ip_interfaces")
    created_at: datetime = Field(default=datetime.now())
    updated_at: datetime = Field(default=datetime.now())


# Properties to return via API, id is always required
class IpInterfacePublic(IpInterfaceBase):
    id: int
    device_hostname: str = ""
    created_at: datetime
    updated_at: datetime


class IpInterfacesPublic(SQLModel):
    data: list[IpInterfacePublic]
    count: int


# Group Config
class GroupConfigBase(SQLModel):
    group_name: str = ""
    commands: str = ""
    command_type: str = ""


class GroupConfigCreate(GroupConfigBase):
    group_name: str = ""
    commands: str = ""


# Properties to return via API, id is always required
class GroupConfigPublic(GroupConfigBase):
    status: bool = False
    message: str = ""


# Device Config
class DeviceConfigBase(SQLModel):
    commands: str = ""
    command_type: str = ""


class DeviceConfigCreate(DeviceConfigBase):
    pass


# Properties to return via API
class DeviceConfigPublic(DeviceConfigBase):
    status: bool = False
    message: str = ""


# Device Auto-Discovery (no DB tables — request/response models only)
class DiscoveryScanRequest(SQLModel):
    cidr: str
    port: int = 22
    tcp_timeout: float = 1.0


class DiscoveryHostPublic(SQLModel):
    ip: str
    port: int
    existing: bool = False
    existing_device_id: int | None = None
    existing_hostname: str | None = None


class DiscoveryScanPublic(SQLModel):
    cidr: str
    total_hosts: int
    open_count: int
    hosts: list[DiscoveryHostPublic]


class DiscoveryIdentifyRequest(SQLModel):
    ips: list[str]
    port: int = 22
    credential_ids: list[int]


class DiscoveryCandidatePublic(SQLModel):
    ip: str
    port: int
    # "identified" | "auth_failed" | "unreachable" | "unknown_platform" | "error"
    status: str
    platform: str | None = None
    device_type: str | None = None
    hostname: str | None = None
    raw_hostname: str | None = None
    vendor: str | None = None
    model: str | None = None
    os_version: str | None = None
    serial_number: str | None = None
    credential_id: int | None = None
    error: str | None = None


class DiscoveryIdentifyPublic(SQLModel):
    candidates: list[DiscoveryCandidatePublic]


class DiscoveryAddRequest(SQLModel):
    devices: list[DeviceCreate]


class DiscoveryAddError(SQLModel):
    hostname: str
    ipaddress: str
    detail: str


class DiscoveryAddPublic(SQLModel):
    created: list[DevicePublic]
    errors: list[DiscoveryAddError]


# Config Revisions — snapshots of device running-config stored in per-device
# git repos; this table holds only metadata pointing at commit hashes
class ConfigRevision(SQLModel, table=True):
    __tablename__ = "configrevision"
    id: int | None = Field(default=None, primary_key=True)
    device_id: int = Field(foreign_key="device.id", index=True)
    commit_hash: str = Field(index=True)
    # "manual" | "pre_push" | "post_push" | "rollback" | "scheduled"
    action: str = Field(index=True)
    username: str = Field(default="")
    command_type: str = Field(default="")
    commands: str = Field(default="")
    message: str = Field(default="")
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC), index=True)


class ConfigRevisionPublic(SQLModel):
    id: int
    device_id: int
    commit_hash: str
    action: str
    username: str
    command_type: str
    commands: str
    message: str
    created_at: datetime


class ConfigRevisionsPublic(SQLModel):
    data: list[ConfigRevisionPublic]
    count: int


class ConfigRevisionContentPublic(SQLModel):
    revision: ConfigRevisionPublic
    config: str


class RevisionDiffPublic(SQLModel):
    base_revision_id: int
    target: str  # revision id, "previous" or "live"
    diff: str


class RollbackPreviewPublic(SQLModel):
    revision_id: int
    diff: str
    diff_sha256: str
    caveats: str = ""


class RollbackRequest(SQLModel):
    confirm: bool = False
    expected_diff_sha256: str = ""
    mode: str = "replace"  # "replace" | "merge"


class RollbackResultPublic(SQLModel):
    status: bool
    diff: str = ""
    new_revision_id: int | None = None
    message: str = ""


# Compliance — hardening checks against PCI DSS / ISO 27001, evaluated from a
# code-defined rule catalog (app/automation/compliance_rules.py) against a
# per-device effective profile (global profile + optional group override).
class ComplianceProfileBase(SQLModel):
    ntp_server: str | None = None
    syslog_server: str | None = None
    dns_server: str | None = None
    password_min_length: int | None = None
    exec_timeout_minutes: int | None = None


class ComplianceProfileUpdate(ComplianceProfileBase):
    pass


class ComplianceProfile(ComplianceProfileBase, table=True):
    __tablename__ = "complianceprofile"
    __table_args__ = (
        UniqueConstraint("group_id", name="uq_complianceprofile_group_id"),
    )

    id: int | None = Field(default=None, primary_key=True)
    # NULL = the single global default profile
    group_id: int | None = Field(default=None, foreign_key="group.id", index=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


class ComplianceProfilePublic(ComplianceProfileBase):
    id: int
    group_id: int | None
    created_at: datetime
    updated_at: datetime


class ComplianceProfilesPublic(SQLModel):
    global_profile: ComplianceProfilePublic
    group_profiles: list[ComplianceProfilePublic]


class ComplianceRunResultBase(SQLModel):
    device_id: int = Field(foreign_key="device.id", index=True)
    platform: str = Field(default="")
    username: str = Field(default="")
    status: str = Field(default="completed")  # "completed" | "error"
    error: str = Field(default="")
    profile_snapshot: str = Field(default="")  # JSON of the effective profile used
    passed_count: int = Field(default=0)
    failed_count: int = Field(default=0)
    skipped_count: int = Field(default=0)


class ComplianceRun(ComplianceRunResultBase, table=True):
    __tablename__ = "compliancerun"

    id: int | None = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC), index=True)


class ComplianceRunPublic(ComplianceRunResultBase):
    id: int
    created_at: datetime


class ComplianceResult(SQLModel, table=True):
    __tablename__ = "complianceresult"

    id: int | None = Field(default=None, primary_key=True)
    run_id: int = Field(foreign_key="compliancerun.id", index=True)
    rule_id: str = Field(index=True)
    status: str = Field(default="")  # pass | fail | skipped | not_applicable | error
    evidence: str = Field(default="")
    remediation_commands: str = Field(default="")


class ComplianceResultPublic(SQLModel):
    id: int
    run_id: int
    rule_id: str
    status: str
    evidence: str
    remediation_commands: str


class ComplianceRulePublic(SQLModel):
    id: str
    title: str
    description: str
    severity: str
    pci_dss: tuple[str, ...]
    iso27001: tuple[str, ...]
    variables: tuple[str, ...]
    platforms: list[str]


class ComplianceRulesPublic(SQLModel):
    data: list[ComplianceRulePublic]


class ComplianceRunDetailPublic(SQLModel):
    run: ComplianceRunPublic
    results: list[ComplianceResultPublic]


class ComplianceSummaryItem(SQLModel):
    device_id: int
    hostname: str
    platform: str | None
    latest_run_id: int | None
    passed_count: int
    failed_count: int
    skipped_count: int
    last_checked: datetime | None


class ComplianceSummaryPublic(SQLModel):
    data: list[ComplianceSummaryItem]


class RemediationPreviewRequest(SQLModel):
    run_id: int
    rule_ids: list[str]


class RemediationPreviewPublic(SQLModel):
    commands: str
    commands_sha256: str
    rule_ids: list[str]
    caveats: str = ""


class RemediationRequest(SQLModel):
    run_id: int
    rule_ids: list[str]
    confirm: bool = False
    expected_commands_sha256: str = ""


class RemediationResultPublic(SQLModel):
    status: bool
    new_run_id: int | None = None
    message: str = ""


# Group remediation — plans and pushes the failed rules of every device in a
# group from each device's own latest run, so each device gets its own command
# block. The aggregate commands_sha256 guards the whole plan against staleness.
class GroupRemediationPreviewRequest(SQLModel):
    rule_ids: list[str] = []  # empty = all currently-failed rules per device


class GroupRemediationDevicePreview(SQLModel):
    device_id: int
    hostname: str
    platform: str | None = None
    run_id: int | None = None
    rule_ids: list[str] = []
    commands: str = ""
    commands_sha256: str = ""  # per-device, for display only
    # ready | no_run | no_failures | unsupported_platform
    status: str = "ready"
    message: str = ""


class GroupRemediationPreviewPublic(SQLModel):
    group_name: str
    devices: list[GroupRemediationDevicePreview]
    commands_sha256: str  # aggregate staleness token, over ready devices only
    total_devices: int
    total_rules: int
    caveats: str = ""


class GroupRemediationRequest(SQLModel):
    rule_ids: list[str] = []
    confirm: bool = False
    expected_commands_sha256: str = ""
    # False skips the post-push compliance re-check (one less SSH session per
    # device) for large groups; the dashboard counts then stay stale until the
    # next group check.
    rerun_check: bool = True


class GroupRemediationDeviceResult(SQLModel):
    device_id: int
    hostname: str
    status: str  # pushed | skipped | error
    rule_ids: list[str] = []
    new_run_id: int | None = None
    message: str = ""


class GroupRemediationResultPublic(SQLModel):
    group_name: str
    status: bool
    pushed_count: int
    skipped_count: int
    error_count: int
    results: list[GroupRemediationDeviceResult]
    errors: list[str] = []
    snapshot_warning: str = ""
    message: str = ""


# OAuth Accounts (social login)
class OAuthAccount(SQLModel, table=True):
    __tablename__ = "oauthaccount"
    __table_args__ = (
        UniqueConstraint(
            "provider", "provider_user_id", name="uq_oauthaccount_provider_sub"
        ),
    )

    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", nullable=False, index=True)
    provider: str = Field(index=True)
    provider_user_id: str = Field(index=True)
    provider_email: str | None = None
    access_token: str | None = None
    refresh_token: str | None = None
    expires_at: datetime | None = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    user: "User" = Relationship(back_populates="oauth_accounts")


class OAuthAccountPublic(SQLModel):
    id: int
    provider: str
    provider_email: str | None = None
    created_at: datetime


# WebAuthn / Passkey credentials
class WebAuthnCredential(SQLModel, table=True):
    __tablename__ = "webauthncredential"

    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", nullable=False, index=True)
    credential_id: str = Field(unique=True, index=True)
    public_key: str
    sign_count: int = Field(default=0)
    device_type: str | None = None
    backed_up: bool = Field(default=False)
    name: str | None = None
    aaguid: str | None = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    last_used_at: datetime | None = None
    user: "User" = Relationship(back_populates="webauthn_credentials")


class WebAuthnCredentialPublic(SQLModel):
    id: int
    name: str | None = None
    device_type: str | None = None
    backed_up: bool
    aaguid: str | None = None
    created_at: datetime
    last_used_at: datetime | None = None


# API Keys (service-account auth for MCP / machine clients)
def _validate_allowed_ips(value: str) -> str:
    entries = [e.strip() for e in value.split(",")]
    entries = [e for e in entries if e]
    if not entries:
        raise ValueError(
            "allowed_ips must contain at least one CIDR (use '0.0.0.0/0' to allow all)"
        )
    for entry in entries:
        try:
            ipaddress.ip_network(entry, strict=False)
        except ValueError as exc:
            raise ValueError(f"Invalid CIDR '{entry}' in allowed_ips: {exc}") from exc
    return ",".join(entries)


class ApiKeyBase(SQLModel):
    name: str = ""
    is_active: bool = True
    expires_at: datetime | None = None
    role: Literal["read_only", "read_write"] = "read_write"
    allowed_ips: str = "0.0.0.0/0"

    @field_validator("allowed_ips")
    @classmethod
    def validate_allowed_ips(cls, v: str) -> str:
        return _validate_allowed_ips(v)


class ApiKeyCreate(SQLModel):
    name: str = ""
    expires_at: datetime | None = None
    user_id: int | None = None
    role: Literal["read_only", "read_write"] = "read_write"
    allowed_ips: str = "0.0.0.0/0"

    @field_validator("allowed_ips")
    @classmethod
    def validate_allowed_ips(cls, v: str) -> str:
        return _validate_allowed_ips(v)


class ApiKeyUpdate(SQLModel):
    name: str | None = None
    is_active: bool | None = None
    expires_at: datetime | None = None
    role: Literal["read_only", "read_write"] | None = None
    allowed_ips: str | None = None

    # These fields are `X | None = None` so an *omitted* key means "leave
    # unchanged" (see exclude_unset=True in crud.update_api_key). But an
    # explicit `null` in the request body is indistinguishable from that at
    # the type level and would otherwise reach a NOT NULL DB column. Reject
    # it here with a clean 422 instead of an unhandled IntegrityError.
    @model_validator(mode="before")
    @classmethod
    def reject_explicit_null_for_required_fields(cls, data: Any) -> Any:
        if isinstance(data, dict):
            for field in ("name", "is_active", "role", "allowed_ips"):
                if field in data and data[field] is None:
                    raise ValueError(
                        f"'{field}' cannot be null; omit it to leave unchanged"
                    )
        return data

    @field_validator("allowed_ips")
    @classmethod
    def validate_allowed_ips(cls, v: str | None) -> str | None:
        if v is None:
            return v
        return _validate_allowed_ips(v)


class ApiKey(ApiKeyBase, table=True):
    __tablename__ = "apikey"

    id: int | None = Field(default=None, primary_key=True)
    prefix: str = Field(index=True)
    hashed_key: str
    user_id: int = Field(foreign_key="user.id", nullable=False, index=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    last_used_at: datetime | None = None
    role: Literal["read_only", "read_write"] = Field(
        default="read_write", sa_type=String
    )
    allowed_ips: str = Field(default="0.0.0.0/0", sa_type=String)
    user: "User" = Relationship(back_populates="api_keys")


class ApiKeyCreateResponse(ApiKeyBase):
    id: int
    prefix: str
    key: str
    created_at: datetime


class ApiKeyPublic(ApiKeyBase):
    id: int
    prefix: str
    user_id: int
    created_at: datetime
    last_used_at: datetime | None = None


class ApiKeysPublic(SQLModel):
    data: list[ApiKeyPublic]
    count: int
