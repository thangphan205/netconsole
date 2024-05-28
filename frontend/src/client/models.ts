export type Body_login_login_access_token = {
	grant_type?: string | null;
	username: string;
	password: string;
	scope?: string;
	client_id?: string | null;
	client_secret?: string | null;
};



export type HTTPValidationError = {
	detail?: Array<ValidationError>;
};



export type InterfaceCreate = {
	port: string;
	description: string;
	status?: string | null;
	vlan?: string | null;
	duplex?: string | null;
	speed?: string | null;
	type?: string | null;
	switch_id?: number | null;
	mode?: string | null;
	native_vlan?: string | null;
	allowed_vlan?: string | null;
	allowed_vlan_add?: string | null;
};



export type InterfacePublic = {
	port: string;
	description: string;
	status?: string | null;
	vlan?: string | null;
	duplex?: string | null;
	speed?: string | null;
	type?: string | null;
	switch_id?: number | null;
	mode?: string | null;
	native_vlan?: string | null;
	allowed_vlan?: string | null;
	allowed_vlan_add?: string | null;
	id: number;
};



export type InterfaceUpdate = {
	port?: string | null;
	description: string;
	status?: string | null;
	vlan?: string | null;
	duplex?: string | null;
	speed?: string | null;
	type?: string | null;
	switch_id?: number | null;
	mode?: string | null;
	native_vlan?: string | null;
	allowed_vlan?: string | null;
	allowed_vlan_add?: string | null;
};



export type InterfacesPublic = {
	data: Array<InterfacePublic>;
	count: number;
};



export type ItemCreate = {
	title: string;
	description?: string | null;
};



export type ItemPublic = {
	title: string;
	description?: string | null;
	id: number;
	owner_id: number;
};



export type ItemUpdate = {
	title?: string | null;
	description?: string | null;
};



export type ItemsPublic = {
	data: Array<ItemPublic>;
	count: number;
};



export type LogPublic = {
	id: number;
	datetime: string;
	severity: string;
	username: string;
	client_ip: string;
	message: string;
};



export type LogsPublic = {
	data: Array<LogPublic>;
	count: number;
};



export type Message = {
	message: string;
};



export type NewPassword = {
	token: string;
	new_password: string;
};



export type SwitchCreate = {
	hostname: string;
	ipaddress: string;
	groups?: string | null;
	platform?: string | null;
	device_type?: string | null;
	os_version?: string | null;
	model?: string | null;
	vendor?: string | null;
	serial_number?: string | null;
	description?: string | null;
	more_info?: string | null;
};



export type SwitchPublic = {
	hostname: string;
	ipaddress: string;
	groups?: string | null;
	platform?: string | null;
	device_type?: string | null;
	os_version?: string | null;
	model?: string | null;
	vendor?: string | null;
	serial_number?: string | null;
	description?: string | null;
	more_info?: string | null;
	id: number;
};



export type SwitchUpdate = {
	hostname?: string | null;
	ipaddress: string;
	groups?: string | null;
	platform?: string | null;
	device_type?: string | null;
	os_version?: string | null;
	model?: string | null;
	vendor?: string | null;
	serial_number?: string | null;
	description?: string | null;
	more_info?: string | null;
};



export type SwitchesPublic = {
	data: Array<SwitchPublic>;
	count: number;
};



export type Token = {
	access_token: string;
	token_type?: string;
};



export type UpdatePassword = {
	current_password: string;
	new_password: string;
};



export type UserCreate = {
	email: string;
	is_active?: boolean;
	is_superuser?: boolean;
	full_name?: string | null;
	password: string;
};



export type UserPublic = {
	email: string;
	is_active?: boolean;
	is_superuser?: boolean;
	full_name?: string | null;
	id: number;
};



export type UserRegister = {
	email: string;
	password: string;
	full_name?: string | null;
};



export type UserUpdate = {
	email?: string | null;
	is_active?: boolean;
	is_superuser?: boolean;
	full_name?: string | null;
	password?: string | null;
};



export type UserUpdateMe = {
	full_name?: string | null;
	email?: string | null;
};



export type UsersPublic = {
	data: Array<UserPublic>;
	count: number;
};



export type ValidationError = {
	loc: Array<string | number>;
	msg: string;
	type: string;
};

