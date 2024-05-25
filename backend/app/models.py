from sqlmodel import Field, Relationship, SQLModel


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


# Properties to return via API, id is always required
class ItemPublic(ItemBase):
    id: int
    owner_id: int


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
    hostname: str


# Properties to return via API, id is always required
class SwitchPublic(SwitchBase):
    id: int


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


# Properties to receive on item creation
class InterfaceCreate(InterfaceBase):
    port: str


# Properties to receive on item update
class InterfaceUpdate(InterfaceBase):
    port: str | None = None  # type: ignore


# Database model, database table inferred from class name
class Interface(InterfaceBase, table=True):
    id: int | None = Field(default=None, primary_key=True)
    port: str


# Properties to return via API, id is always required
class InterfacePublic(InterfaceBase):
    id: int


class InterfacesPublic(SQLModel):
    data: list[InterfacePublic]
    count: int
