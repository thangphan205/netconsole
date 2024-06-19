from sqlmodel import Field, Relationship, SQLModel
from datetime import datetime


# Shared properties
# TODO replace email str with EmailStr when sqlmodel supports it
class UserBase(SQLModel):
    email: str = Field(unique=True, index=True)
    is_active: bool = True
    is_superuser: bool = False
    full_name: str | None = None


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
    hashed_password: str
    items: list["Item"] = Relationship(back_populates="owner")


# Properties to return via API, id is always required
class UserPublic(UserBase):
    id: int


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


# Group Switch
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


# Properties to receive on arp creation
class CredentialCreate(CredentialBase):
    password: str


# Properties to receive on arp update
class CredentialUpdate(CredentialBase):
    password: str


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
    password: str
    created_at: datetime
    updated_at: datetime


class CredentialsPublic(SQLModel):
    data: list[CredentialPublic]
    count: int


# Shared properties
class SwitchBase(SQLModel):
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


# Properties to receive on switch creation
class SwitchCreate(SwitchBase):
    hostname: str


# Properties to receive on switch update
class SwitchUpdate(SwitchBase):
    hostname: str | None = None  # type: ignore


# Properties to receive on switch update
class SwitchUpdateMetadata(SQLModel):
    id: int


# Database model, database table inferred from class name
class Switch(SwitchBase, table=True):
    id: int | None = Field(default=None, primary_key=True)
    hostname: str = Field(unique=True, index=True)
    created_at: datetime = Field(default=datetime.now())
    updated_at: datetime = Field(default=datetime.now())
    mac_addresses: list["MacAddress"] = Relationship(back_populates="switch")
    arps: list["Arp"] = Relationship(back_populates="switch")
    ip_interfaces: list["IpInterface"] = Relationship(back_populates="switch")


# Properties to return via API, id is always required
class SwitchPublic(SwitchBase):
    id: int
    created_at: datetime
    updated_at: datetime


class SwitchesPublic(SQLModel):
    data: list[SwitchPublic]
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
    switch_id: int | None = None
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
    switch_id: int = Field(index=True)
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
    datetime: str
    severity: str
    username: str
    client_ip: str
    message: str


class LogsPublic(SQLModel):
    data: list[LogPublic]
    count: int


# MAC Address
class MacAddressBase(SQLModel):
    mac: str
    interface: str
    vlan: int | None = None
    static: bool | None = None
    active: bool | None = None
    moves: int | None = None
    last_move: int | None = None
    switch_id: int | None = None


# Properties to receive on mac address creation
class MacAddressCreate(MacAddressBase):
    mac: str


# Properties to receive on mac address update
class MacAddressUpdate(MacAddressBase):
    mac: str | None = None  # type: ignore


# Database model, database table inferred from class name
class MacAddress(MacAddressBase, table=True):
    id: int | None = Field(default=None, primary_key=True)
    mac: str = Field(index=True)
    switch_id: int = Field(default=None, foreign_key="switch.id", nullable=False)
    switch: Switch | None = Relationship(back_populates="mac_addresses")
    created_at: datetime = Field(default=datetime.now())
    updated_at: datetime = Field(default=datetime.now())


# Properties to return via API, id is always required
class MacAddressPublic(MacAddressBase):
    id: int
    switch_hostname: str = ""
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
    switch_id: int | None = None


# Properties to receive on arp creation
class ArpCreate(ArpBase):
    ip: str


# Properties to receive on arp update
class ArpUpdate(ArpBase):
    ip: str | None = None  # type: ignore


# Database model, database table inferred from class name
class Arp(ArpBase, table=True):
    id: int | None = Field(default=None, primary_key=True)
    ip: str = Field(index=True)
    switch_id: int = Field(default=None, foreign_key="switch.id", nullable=False)
    switch: Switch | None = Relationship(back_populates="arps")
    created_at: datetime = Field(default=datetime.now())
    updated_at: datetime = Field(default=datetime.now())


# Properties to return via API, id is always required
class ArpPublic(ArpBase):
    id: int
    switch_hostname: str = ""
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
    switch_id: int | None = None


# Properties to receive on ip creation
class IpInterfaceCreate(IpInterfaceBase):
    ipv4: str


# Properties to receive on ip update
class IpInterfaceUpdate(IpInterfaceBase):
    ipv4: str | None = None  # type: ignore


# Database model, database table inferred from class name
class IpInterface(IpInterfaceBase, table=True):
    id: int | None = Field(default=None, primary_key=True)
    ipv4: str = Field(index=True)
    switch_id: int = Field(default=None, foreign_key="switch.id", nullable=False)
    switch: Switch | None = Relationship(back_populates="ip_interfaces")
    created_at: datetime = Field(default=datetime.now())
    updated_at: datetime = Field(default=datetime.now())


# Properties to return via API, id is always required
class IpInterfacePublic(IpInterfaceBase):
    id: int
    switch_hostname: str = ""
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
