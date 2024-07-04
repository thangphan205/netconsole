export type ArpCreate = {
	ip: string;
	interface: string;
	mac?: string | null;
	age?: number | null;
	switch_id?: number | null;
};



export type ArpPublic = {
	ip: string;
	interface: string;
	mac?: string | null;
	age?: number | null;
	switch_id?: number | null;
	id: number;
	switch_hostname?: string;
	created_at: string;
	updated_at: string;
};



export type ArpUpdate = {
	ip?: string | null;
	interface: string;
	mac?: string | null;
	age?: number | null;
	switch_id?: number | null;
};



export type ArpsPublic = {
	data: Array<ArpPublic>;
	count: number;
};



export type Body_login_login_access_token = {
	grant_type?: string | null;
	username: string;
	password: string;
	scope?: string;
	client_id?: string | null;
	client_secret?: string | null;
};



export type CredentialCreate = {
	username: string;
	public_key?: string | null;
	private_key?: string | null;
	default?: boolean | null;
	description?: string;
	password: string;
};



export type CredentialPublic = {
	username: string;
	public_key?: string | null;
	private_key?: string | null;
	default?: boolean | null;
	description?: string;
	id: number;
	password: string;
	created_at: string;
	updated_at: string;
};



export type CredentialUpdate = {
	username: string;
	public_key?: string | null;
	private_key?: string | null;
	default?: boolean | null;
	description?: string;
	password: string;
};



export type CredentialsPublic = {
	data: Array<CredentialPublic>;
	count: number;
};



export type GroupConfigCreate = {
	group_name?: string;
	commands?: string;
	command_type?: string;
};



export type GroupCreate = {
	name: string;
	description: string;
	site: string;
};



export type GroupPublic = {
	name: string;
	description: string;
	site: string;
	id: number;
	created_at: string;
	updated_at: string;
};



export type GroupUpdate = {
	name?: string | null;
	description: string;
	site: string;
};



export type GroupsPublic = {
	data: Array<GroupPublic>;
	count: number;
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
	created_at: string;
	updated_at: string;
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



export type IpInterfaceCreate = {
	interface: string;
	ipv4: string;
	ipv6?: string | null;
	switch_id?: number | null;
};



export type IpInterfacePublic = {
	interface: string;
	ipv4: string;
	ipv6?: string | null;
	switch_id?: number | null;
	id: number;
	switch_hostname?: string;
	created_at: string;
	updated_at: string;
};



export type IpInterfaceUpdate = {
	interface: string;
	ipv4?: string | null;
	ipv6?: string | null;
	switch_id?: number | null;
};



export type IpInterfacesPublic = {
	data: Array<IpInterfacePublic>;
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
	created_at: string;
	updated_at: string;
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



export type MacAddressCreate = {
	mac: string;
	interface: string;
	vlan?: number | null;
	static?: boolean | null;
	active?: boolean | null;
	moves?: number | null;
	last_move?: number | null;
	switch_id?: number | null;
};



export type MacAddressPublic = {
	mac: string;
	interface: string;
	vlan?: number | null;
	static?: boolean | null;
	active?: boolean | null;
	moves?: number | null;
	last_move?: number | null;
	switch_id?: number | null;
	id: number;
	switch_hostname?: string;
	created_at: string;
	updated_at: string;
};



export type MacAddressUpdate = {
	mac?: string | null;
	interface: string;
	vlan?: number | null;
	static?: boolean | null;
	active?: boolean | null;
	moves?: number | null;
	last_move?: number | null;
	switch_id?: number | null;
};



export type MacAddressesPublic = {
	data: Array<MacAddressPublic>;
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
	credential_id?: number | null;
	port?: number | null;
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
	credential_id?: number | null;
	port?: number | null;
	id: number;
	created_at: string;
	updated_at: string;
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
	credential_id?: number | null;
	port?: number | null;
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

