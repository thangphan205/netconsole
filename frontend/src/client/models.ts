export type ServerInfo = {
	timezone: string;
	current_time: string;
	utc_time: string;
};

export type ApiKeyCreate = {
	name?: string;
	expires_at?: string | null;
	user_id?: number | null;
	role?: 'read_only' | 'read_write';
	allowed_ips?: string;
};



export type ApiKeyCreateResponse = {
	name?: string;
	is_active?: boolean;
	expires_at?: string | null;
	role?: 'read_only' | 'read_write';
	allowed_ips?: string;
	id: number;
	prefix: string;
	key: string;
	created_at: string;
};



export type ApiKeyPublic = {
	name?: string;
	is_active?: boolean;
	expires_at?: string | null;
	role?: 'read_only' | 'read_write';
	allowed_ips?: string;
	id: number;
	prefix: string;
	user_id: number;
	created_at: string;
	last_used_at?: string | null;
};



export type ApiKeyUpdate = {
	name?: string | null;
	is_active?: boolean | null;
	expires_at?: string | null;
	role?: 'read_only' | 'read_write' | null;
	allowed_ips?: string | null;
};



export type ApiKeysPublic = {
	data: Array<ApiKeyPublic>;
	count: number;
};



export type ArpCreate = {
	ip: string;
	interface: string;
	mac?: string | null;
	age?: number | null;
	device_id?: number | null;
};



export type ArpPublic = {
	ip: string;
	interface: string;
	mac?: string | null;
	age?: number | null;
	device_id?: number | null;
	id: number;
	device_hostname?: string;
	created_at: string;
	updated_at: string;
};



export type ArpUpdate = {
	ip?: string | null;
	interface: string;
	mac?: string | null;
	age?: number | null;
	device_id?: number | null;
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
	enable_password?: string | null;
	password: string;
};



export type CredentialPublic = {
	username: string;
	public_key?: string | null;
	private_key?: string | null;
	default?: boolean | null;
	description?: string;
	enable_password?: string | null;
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
	enable_password?: string | null;
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



export type DeviceConfigCreate = {
	commands?: string;
	command_type?: string;
};



export type ConfigRevisionPublic = {
	id: number;
	device_id: number;
	commit_hash: string;
	action: string;
	username: string;
	command_type: string;
	commands: string;
	message: string;
	created_at: string;
};



export type DiscoveryScanRequest = {
	cidr: string;
	port?: number;
	tcp_timeout?: number;
};



export type DiscoveryHostPublic = {
	ip: string;
	port: number;
	existing?: boolean;
	existing_device_id?: number | null;
	existing_hostname?: string | null;
};



export type DiscoveryScanPublic = {
	cidr: string;
	total_hosts: number;
	open_count: number;
	hosts: Array<DiscoveryHostPublic>;
};



export type DiscoveryIdentifyRequest = {
	ips: Array<string>;
	port?: number;
	credential_ids: Array<number>;
};



export type DiscoveryCandidatePublic = {
	ip: string;
	port: number;
	status: string;
	platform?: string | null;
	device_type?: string | null;
	hostname?: string | null;
	raw_hostname?: string | null;
	vendor?: string | null;
	model?: string | null;
	os_version?: string | null;
	serial_number?: string | null;
	credential_id?: number | null;
	error?: string | null;
};



export type DiscoveryIdentifyPublic = {
	candidates: Array<DiscoveryCandidatePublic>;
};



export type DiscoveryAddRequest = {
	devices: Array<DeviceCreate>;
};



export type DiscoveryAddError = {
	hostname: string;
	ipaddress: string;
	detail: string;
};



export type DiscoveryAddPublic = {
	created: Array<DevicePublic>;
	errors: Array<DiscoveryAddError>;
};



export type ConfigRevisionsPublic = {
	data: Array<ConfigRevisionPublic>;
	count: number;
};



export type ConfigRevisionContentPublic = {
	revision: ConfigRevisionPublic;
	config: string;
};



export type RevisionDiffPublic = {
	base_revision_id: number;
	target: string;
	diff: string;
};



export type RollbackPreviewPublic = {
	revision_id: number;
	diff: string;
	diff_sha256: string;
	caveats?: string;
};



export type RollbackRequest = {
	confirm?: boolean;
	expected_diff_sha256?: string;
	mode?: string;
};



export type RollbackResultPublic = {
	status: boolean;
	diff?: string;
	new_revision_id?: number | null;
	message?: string;
};



export type ComplianceRulePublic = {
	id: string;
	title: string;
	description: string;
	severity: string;
	pci_dss: Array<string>;
	iso27001: Array<string>;
	variables: Array<string>;
	platforms: Array<string>;
};



export type ComplianceRulesPublic = {
	data: Array<ComplianceRulePublic>;
};



export type ComplianceProfilePublic = {
	ntp_server?: string | null;
	syslog_server?: string | null;
	syslog_severity?: string | null;
	dns_server?: string | null;
	password_min_length?: number | null;
	exec_timeout_minutes?: number | null;
	disabled_rules?: string | null;
	id: number;
	group_id: number | null;
	created_at: string;
	updated_at: string;
};



export type ComplianceProfileUpdate = {
	ntp_server?: string | null;
	syslog_server?: string | null;
	syslog_severity?: string | null;
	dns_server?: string | null;
	password_min_length?: number | null;
	exec_timeout_minutes?: number | null;
	disabled_rules?: string | null;
};



export type ComplianceProfilesPublic = {
	global_profile: ComplianceProfilePublic;
	group_profiles: Array<ComplianceProfilePublic>;
};



export type ComplianceResultPublic = {
	id: number;
	run_id: number;
	rule_id: string;
	status: string;
	evidence: string;
	remediation_commands: string;
	is_manual: boolean;
};



export type ComplianceManualEvidenceCreate = {
	evidence: string;
};



export type ComplianceRunPublic = {
	device_id: number;
	platform?: string;
	username?: string;
	status?: string;
	error?: string;
	profile_snapshot?: string;
	passed_count?: number;
	failed_count?: number;
	skipped_count?: number;
	id: number;
	created_at: string;
};



export type ComplianceRunDetailPublic = {
	run: ComplianceRunPublic;
	results: Array<ComplianceResultPublic>;
};



export type ComplianceSummaryItem = {
	device_id: number;
	hostname: string;
	platform: string | null;
	latest_run_id: number | null;
	passed_count: number;
	failed_count: number;
	skipped_count: number;
	last_checked: string | null;
};



export type ComplianceSummaryPublic = {
	data: Array<ComplianceSummaryItem>;
};



export type RemediationPreviewRequest = {
	run_id: number;
	rule_ids: Array<string>;
};



export type RemediationPreviewPublic = {
	commands: string;
	commands_sha256: string;
	rule_ids: Array<string>;
	caveats?: string;
};



export type RemediationRequest = {
	run_id: number;
	rule_ids: Array<string>;
	confirm?: boolean;
	expected_commands_sha256?: string;
};



export type RemediationResultPublic = {
	status: boolean;
	new_run_id?: number | null;
	message?: string;
};



export type GroupRemediationPreviewRequest = {
	rule_ids?: Array<string>;
};



export type GroupRemediationDevicePreview = {
	device_id: number;
	hostname: string;
	platform?: string | null;
	run_id?: number | null;
	rule_ids?: Array<string>;
	commands?: string;
	commands_sha256?: string;
	status?: string;
	message?: string;
};



export type GroupRemediationPreviewPublic = {
	group_name: string;
	devices: Array<GroupRemediationDevicePreview>;
	commands_sha256: string;
	total_devices: number;
	total_rules: number;
	caveats?: string;
};



export type GroupRemediationRequest = {
	rule_ids?: Array<string>;
	confirm?: boolean;
	expected_commands_sha256?: string;
	rerun_check?: boolean;
};



export type GroupRemediationDeviceResult = {
	device_id: number;
	hostname: string;
	status: string;
	rule_ids?: Array<string>;
	new_run_id?: number | null;
	message?: string;
};



export type GroupRemediationResultPublic = {
	group_name: string;
	status: boolean;
	pushed_count: number;
	skipped_count: number;
	error_count: number;
	results: Array<GroupRemediationDeviceResult>;
	errors?: Array<string>;
	snapshot_warning?: string;
	message?: string;
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
	device_id?: number | null;
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
	device_id?: number | null;
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
	device_id?: number | null;
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
	device_id?: number | null;
};



export type IpInterfacePublic = {
	interface: string;
	ipv4: string;
	ipv6?: string | null;
	device_id?: number | null;
	id: number;
	device_hostname?: string;
	created_at: string;
	updated_at: string;
};



export type IpInterfaceUpdate = {
	interface: string;
	ipv4?: string | null;
	ipv6?: string | null;
	device_id?: number | null;
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
	timestamp: string;
	severity: string;
	username: string;
	client_ip: string;
	action: string;
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
	device_id?: number | null;
};



export type MacAddressPublic = {
	mac: string;
	interface: string;
	vlan?: number | null;
	static?: boolean | null;
	active?: boolean | null;
	moves?: number | null;
	last_move?: number | null;
	device_id?: number | null;
	id: number;
	device_hostname?: string;
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
	device_id?: number | null;
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



export type DeviceCreate = {
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



export type DevicePublic = {
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
	health_status?: string | null;
	disabled_rules?: string | null;
	id: number;
	created_at: string;
	updated_at: string;
};



export type DeviceUpdate = {
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
	disabled_rules?: string | null;
};



export type DevicesPublic = {
	data: Array<DevicePublic>;
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
	is_service_account?: boolean;
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

