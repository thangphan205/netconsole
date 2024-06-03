import type { CancelablePromise } from './core/CancelablePromise';
import { OpenAPI } from './core/OpenAPI';
import { request as __request } from './core/request';

import type { Body_login_login_access_token,Message,NewPassword,Token,UserPublic,UpdatePassword,UserCreate,UserRegister,UsersPublic,UserUpdate,UserUpdateMe,ItemCreate,ItemPublic,ItemsPublic,ItemUpdate,GroupCreate,GroupPublic,GroupsPublic,GroupUpdate,SwitchCreate,SwitchesPublic,SwitchPublic,SwitchUpdate,InterfaceCreate,InterfacePublic,InterfacesPublic,InterfaceUpdate,MacAddressCreate,MacAddressesPublic,MacAddressPublic,MacAddressUpdate,ArpCreate,ArpPublic,ArpsPublic,ArpUpdate,IpInterfaceCreate,IpInterfacePublic,IpInterfacesPublic,IpInterfaceUpdate,LogsPublic } from './models';

export type TDataLoginAccessToken = {
                formData: Body_login_login_access_token
                
            }
export type TDataRecoverPassword = {
                email: string
                
            }
export type TDataResetPassword = {
                requestBody: NewPassword
                
            }
export type TDataRecoverPasswordHtmlContent = {
                email: string
                
            }

export class LoginService {

	/**
	 * Login Access Token
	 * OAuth2 compatible token login, get an access token for future requests
	 * @returns Token Successful Response
	 * @throws ApiError
	 */
	public static loginAccessToken(data: TDataLoginAccessToken): CancelablePromise<Token> {
		const {
formData,
} = data;
		return __request(OpenAPI, {
			method: 'POST',
			url: '/api/v1/login/access-token',
			formData: formData,
			mediaType: 'application/x-www-form-urlencoded',
			errors: {
				422: `Validation Error`,
			},
		});
	}

	/**
	 * Test Token
	 * Test access token
	 * @returns UserPublic Successful Response
	 * @throws ApiError
	 */
	public static testToken(): CancelablePromise<UserPublic> {
				return __request(OpenAPI, {
			method: 'POST',
			url: '/api/v1/login/test-token',
		});
	}

	/**
	 * Recover Password
	 * Password Recovery
	 * @returns Message Successful Response
	 * @throws ApiError
	 */
	public static recoverPassword(data: TDataRecoverPassword): CancelablePromise<Message> {
		const {
email,
} = data;
		return __request(OpenAPI, {
			method: 'POST',
			url: '/api/v1/password-recovery/{email}',
			path: {
				email
			},
			errors: {
				422: `Validation Error`,
			},
		});
	}

	/**
	 * Reset Password
	 * Reset password
	 * @returns Message Successful Response
	 * @throws ApiError
	 */
	public static resetPassword(data: TDataResetPassword): CancelablePromise<Message> {
		const {
requestBody,
} = data;
		return __request(OpenAPI, {
			method: 'POST',
			url: '/api/v1/reset-password/',
			body: requestBody,
			mediaType: 'application/json',
			errors: {
				422: `Validation Error`,
			},
		});
	}

	/**
	 * Recover Password Html Content
	 * HTML Content for Password Recovery
	 * @returns string Successful Response
	 * @throws ApiError
	 */
	public static recoverPasswordHtmlContent(data: TDataRecoverPasswordHtmlContent): CancelablePromise<string> {
		const {
email,
} = data;
		return __request(OpenAPI, {
			method: 'POST',
			url: '/api/v1/password-recovery-html-content/{email}',
			path: {
				email
			},
			errors: {
				422: `Validation Error`,
			},
		});
	}

}

export type TDataReadUsers = {
                limit?: number
skip?: number
                
            }
export type TDataCreateUser = {
                requestBody: UserCreate
                
            }
export type TDataUpdateUserMe = {
                requestBody: UserUpdateMe
                
            }
export type TDataUpdatePasswordMe = {
                requestBody: UpdatePassword
                
            }
export type TDataRegisterUser = {
                requestBody: UserRegister
                
            }
export type TDataReadUserById = {
                userId: number
                
            }
export type TDataUpdateUser = {
                requestBody: UserUpdate
userId: number
                
            }
export type TDataDeleteUser = {
                userId: number
                
            }

export class UsersService {

	/**
	 * Read Users
	 * Retrieve users.
	 * @returns UsersPublic Successful Response
	 * @throws ApiError
	 */
	public static readUsers(data: TDataReadUsers = {}): CancelablePromise<UsersPublic> {
		const {
limit = 100,
skip = 0,
} = data;
		return __request(OpenAPI, {
			method: 'GET',
			url: '/api/v1/users/',
			query: {
				skip, limit
			},
			errors: {
				422: `Validation Error`,
			},
		});
	}

	/**
	 * Create User
	 * Create new user.
	 * @returns UserPublic Successful Response
	 * @throws ApiError
	 */
	public static createUser(data: TDataCreateUser): CancelablePromise<UserPublic> {
		const {
requestBody,
} = data;
		return __request(OpenAPI, {
			method: 'POST',
			url: '/api/v1/users/',
			body: requestBody,
			mediaType: 'application/json',
			errors: {
				422: `Validation Error`,
			},
		});
	}

	/**
	 * Read User Me
	 * Get current user.
	 * @returns UserPublic Successful Response
	 * @throws ApiError
	 */
	public static readUserMe(): CancelablePromise<UserPublic> {
				return __request(OpenAPI, {
			method: 'GET',
			url: '/api/v1/users/me',
		});
	}

	/**
	 * Delete User Me
	 * Delete own user.
	 * @returns Message Successful Response
	 * @throws ApiError
	 */
	public static deleteUserMe(): CancelablePromise<Message> {
				return __request(OpenAPI, {
			method: 'DELETE',
			url: '/api/v1/users/me',
		});
	}

	/**
	 * Update User Me
	 * Update own user.
	 * @returns UserPublic Successful Response
	 * @throws ApiError
	 */
	public static updateUserMe(data: TDataUpdateUserMe): CancelablePromise<UserPublic> {
		const {
requestBody,
} = data;
		return __request(OpenAPI, {
			method: 'PATCH',
			url: '/api/v1/users/me',
			body: requestBody,
			mediaType: 'application/json',
			errors: {
				422: `Validation Error`,
			},
		});
	}

	/**
	 * Update Password Me
	 * Update own password.
	 * @returns Message Successful Response
	 * @throws ApiError
	 */
	public static updatePasswordMe(data: TDataUpdatePasswordMe): CancelablePromise<Message> {
		const {
requestBody,
} = data;
		return __request(OpenAPI, {
			method: 'PATCH',
			url: '/api/v1/users/me/password',
			body: requestBody,
			mediaType: 'application/json',
			errors: {
				422: `Validation Error`,
			},
		});
	}

	/**
	 * Register User
	 * Create new user without the need to be logged in.
	 * @returns UserPublic Successful Response
	 * @throws ApiError
	 */
	public static registerUser(data: TDataRegisterUser): CancelablePromise<UserPublic> {
		const {
requestBody,
} = data;
		return __request(OpenAPI, {
			method: 'POST',
			url: '/api/v1/users/signup',
			body: requestBody,
			mediaType: 'application/json',
			errors: {
				422: `Validation Error`,
			},
		});
	}

	/**
	 * Read User By Id
	 * Get a specific user by id.
	 * @returns UserPublic Successful Response
	 * @throws ApiError
	 */
	public static readUserById(data: TDataReadUserById): CancelablePromise<UserPublic> {
		const {
userId,
} = data;
		return __request(OpenAPI, {
			method: 'GET',
			url: '/api/v1/users/{user_id}',
			path: {
				user_id: userId
			},
			errors: {
				422: `Validation Error`,
			},
		});
	}

	/**
	 * Update User
	 * Update a user.
	 * @returns UserPublic Successful Response
	 * @throws ApiError
	 */
	public static updateUser(data: TDataUpdateUser): CancelablePromise<UserPublic> {
		const {
requestBody,
userId,
} = data;
		return __request(OpenAPI, {
			method: 'PATCH',
			url: '/api/v1/users/{user_id}',
			path: {
				user_id: userId
			},
			body: requestBody,
			mediaType: 'application/json',
			errors: {
				422: `Validation Error`,
			},
		});
	}

	/**
	 * Delete User
	 * Delete a user.
	 * @returns Message Successful Response
	 * @throws ApiError
	 */
	public static deleteUser(data: TDataDeleteUser): CancelablePromise<Message> {
		const {
userId,
} = data;
		return __request(OpenAPI, {
			method: 'DELETE',
			url: '/api/v1/users/{user_id}',
			path: {
				user_id: userId
			},
			errors: {
				422: `Validation Error`,
			},
		});
	}

}

export type TDataTestEmail = {
                emailTo: string
                
            }

export class UtilsService {

	/**
	 * Test Email
	 * Test emails.
	 * @returns Message Successful Response
	 * @throws ApiError
	 */
	public static testEmail(data: TDataTestEmail): CancelablePromise<Message> {
		const {
emailTo,
} = data;
		return __request(OpenAPI, {
			method: 'POST',
			url: '/api/v1/utils/test-email/',
			query: {
				email_to: emailTo
			},
			errors: {
				422: `Validation Error`,
			},
		});
	}

}

export type TDataReadItems = {
                limit?: number
skip?: number
                
            }
export type TDataCreateItem = {
                requestBody: ItemCreate
                
            }
export type TDataReadItem = {
                id: number
                
            }
export type TDataUpdateItem = {
                id: number
requestBody: ItemUpdate
                
            }
export type TDataDeleteItem = {
                id: number
                
            }

export class ItemsService {

	/**
	 * Read Items
	 * Retrieve items.
	 * @returns ItemsPublic Successful Response
	 * @throws ApiError
	 */
	public static readItems(data: TDataReadItems = {}): CancelablePromise<ItemsPublic> {
		const {
limit = 100,
skip = 0,
} = data;
		return __request(OpenAPI, {
			method: 'GET',
			url: '/api/v1/items/',
			query: {
				skip, limit
			},
			errors: {
				422: `Validation Error`,
			},
		});
	}

	/**
	 * Create Item
	 * Create new item.
	 * @returns ItemPublic Successful Response
	 * @throws ApiError
	 */
	public static createItem(data: TDataCreateItem): CancelablePromise<ItemPublic> {
		const {
requestBody,
} = data;
		return __request(OpenAPI, {
			method: 'POST',
			url: '/api/v1/items/',
			body: requestBody,
			mediaType: 'application/json',
			errors: {
				422: `Validation Error`,
			},
		});
	}

	/**
	 * Read Item
	 * Get item by ID.
	 * @returns ItemPublic Successful Response
	 * @throws ApiError
	 */
	public static readItem(data: TDataReadItem): CancelablePromise<ItemPublic> {
		const {
id,
} = data;
		return __request(OpenAPI, {
			method: 'GET',
			url: '/api/v1/items/{id}',
			path: {
				id
			},
			errors: {
				422: `Validation Error`,
			},
		});
	}

	/**
	 * Update Item
	 * Update an item.
	 * @returns ItemPublic Successful Response
	 * @throws ApiError
	 */
	public static updateItem(data: TDataUpdateItem): CancelablePromise<ItemPublic> {
		const {
id,
requestBody,
} = data;
		return __request(OpenAPI, {
			method: 'PUT',
			url: '/api/v1/items/{id}',
			path: {
				id
			},
			body: requestBody,
			mediaType: 'application/json',
			errors: {
				422: `Validation Error`,
			},
		});
	}

	/**
	 * Delete Item
	 * Delete an item.
	 * @returns Message Successful Response
	 * @throws ApiError
	 */
	public static deleteItem(data: TDataDeleteItem): CancelablePromise<Message> {
		const {
id,
} = data;
		return __request(OpenAPI, {
			method: 'DELETE',
			url: '/api/v1/items/{id}',
			path: {
				id
			},
			errors: {
				422: `Validation Error`,
			},
		});
	}

}

export type TDataReadGroups = {
                _interface?: string
ip?: string
limit?: number
mac?: string
skip?: number
switchId?: number
                
            }
export type TDataCreateGroup = {
                requestBody: GroupCreate
                
            }
export type TDataReadGroup = {
                id: number
                
            }
export type TDataUpdateGroup = {
                id: number
requestBody: GroupUpdate
                
            }
export type TDataDeleteGroup = {
                id: number
                
            }

export class GroupsService {

	/**
	 * Read Groups
	 * Retrieve groups.
	 * @returns GroupsPublic Successful Response
	 * @throws ApiError
	 */
	public static readGroups(data: TDataReadGroups = {}): CancelablePromise<GroupsPublic> {
		const {
_interface = '',
ip = '',
limit = 200,
mac = '',
skip = 0,
switchId = 0,
} = data;
		return __request(OpenAPI, {
			method: 'GET',
			url: '/api/v1/groups/',
			query: {
				skip, limit, ip, mac, interface: _interface, switch_id: switchId
			},
			errors: {
				422: `Validation Error`,
			},
		});
	}

	/**
	 * Create Group
	 * Create new group.
	 * @returns unknown Successful Response
	 * @throws ApiError
	 */
	public static createGroup(data: TDataCreateGroup): CancelablePromise<unknown> {
		const {
requestBody,
} = data;
		return __request(OpenAPI, {
			method: 'POST',
			url: '/api/v1/groups/',
			body: requestBody,
			mediaType: 'application/json',
			errors: {
				422: `Validation Error`,
			},
		});
	}

	/**
	 * Read Group
	 * Get group by ID.
	 * @returns GroupPublic Successful Response
	 * @throws ApiError
	 */
	public static readGroup(data: TDataReadGroup): CancelablePromise<GroupPublic> {
		const {
id,
} = data;
		return __request(OpenAPI, {
			method: 'GET',
			url: '/api/v1/groups/{id}',
			path: {
				id
			},
			errors: {
				422: `Validation Error`,
			},
		});
	}

	/**
	 * Update Group
	 * Update an group.
	 * @returns GroupPublic Successful Response
	 * @throws ApiError
	 */
	public static updateGroup(data: TDataUpdateGroup): CancelablePromise<GroupPublic> {
		const {
id,
requestBody,
} = data;
		return __request(OpenAPI, {
			method: 'PUT',
			url: '/api/v1/groups/{id}',
			path: {
				id
			},
			body: requestBody,
			mediaType: 'application/json',
			errors: {
				422: `Validation Error`,
			},
		});
	}

	/**
	 * Delete Group
	 * Delete an group.
	 * @returns Message Successful Response
	 * @throws ApiError
	 */
	public static deleteGroup(data: TDataDeleteGroup): CancelablePromise<Message> {
		const {
id,
} = data;
		return __request(OpenAPI, {
			method: 'DELETE',
			url: '/api/v1/groups/{id}',
			path: {
				id
			},
			errors: {
				422: `Validation Error`,
			},
		});
	}

}

export type TDataReadSwitches = {
                hostname?: string
ipaddress?: string
limit?: number
skip?: number
                
            }
export type TDataCreateSwitch = {
                requestBody: SwitchCreate
                
            }
export type TDataReadSwitch = {
                id: number
                
            }
export type TDataUpdateSwitch = {
                id: number
requestBody: SwitchUpdate
                
            }
export type TDataDeleteSwitch = {
                id: number
                
            }
export type TDataUpdateSwitchMetadata = {
                id: number
                
            }

export class SwitchesService {

	/**
	 * Read Switches
	 * Retrieve switches.
	 * @returns SwitchesPublic Successful Response
	 * @throws ApiError
	 */
	public static readSwitches(data: TDataReadSwitches = {}): CancelablePromise<SwitchesPublic> {
		const {
hostname = '',
ipaddress = '',
limit = 200,
skip = 0,
} = data;
		return __request(OpenAPI, {
			method: 'GET',
			url: '/api/v1/switches/',
			query: {
				skip, limit, ipaddress, hostname
			},
			errors: {
				422: `Validation Error`,
			},
		});
	}

	/**
	 * Create Switch
	 * Create new switch.
	 * @returns unknown Successful Response
	 * @throws ApiError
	 */
	public static createSwitch(data: TDataCreateSwitch): CancelablePromise<unknown> {
		const {
requestBody,
} = data;
		return __request(OpenAPI, {
			method: 'POST',
			url: '/api/v1/switches/',
			body: requestBody,
			mediaType: 'application/json',
			errors: {
				422: `Validation Error`,
			},
		});
	}

	/**
	 * Read Switch
	 * Get switch by ID.
	 * @returns SwitchPublic Successful Response
	 * @throws ApiError
	 */
	public static readSwitch(data: TDataReadSwitch): CancelablePromise<SwitchPublic> {
		const {
id,
} = data;
		return __request(OpenAPI, {
			method: 'GET',
			url: '/api/v1/switches/{id}',
			path: {
				id
			},
			errors: {
				422: `Validation Error`,
			},
		});
	}

	/**
	 * Update Switch
	 * Update an switch.
	 * @returns SwitchPublic Successful Response
	 * @throws ApiError
	 */
	public static updateSwitch(data: TDataUpdateSwitch): CancelablePromise<SwitchPublic> {
		const {
id,
requestBody,
} = data;
		return __request(OpenAPI, {
			method: 'PUT',
			url: '/api/v1/switches/{id}',
			path: {
				id
			},
			body: requestBody,
			mediaType: 'application/json',
			errors: {
				422: `Validation Error`,
			},
		});
	}

	/**
	 * Delete Switch
	 * Delete an switch.
	 * @returns Message Successful Response
	 * @throws ApiError
	 */
	public static deleteSwitch(data: TDataDeleteSwitch): CancelablePromise<Message> {
		const {
id,
} = data;
		return __request(OpenAPI, {
			method: 'DELETE',
			url: '/api/v1/switches/{id}',
			path: {
				id
			},
			errors: {
				422: `Validation Error`,
			},
		});
	}

	/**
	 * Update Switch Metadata
	 * Update an switch.
	 * @returns unknown Successful Response
	 * @throws ApiError
	 */
	public static updateSwitchMetadata(data: TDataUpdateSwitchMetadata): CancelablePromise<unknown> {
		const {
id,
} = data;
		return __request(OpenAPI, {
			method: 'PUT',
			url: '/api/v1/switches/{id}/metadata',
			path: {
				id
			},
			errors: {
				422: `Validation Error`,
			},
		});
	}

}

export type TDataReadInterfaces = {
                limit?: number
port?: string
skip?: number
switchId?: number
                
            }
export type TDataCreateInterface = {
                requestBody: InterfaceCreate
                
            }
export type TDataReadInterface = {
                id: number
                
            }
export type TDataUpdateInterface = {
                id: number
requestBody: InterfaceUpdate
                
            }
export type TDataDeleteInterface = {
                id: number
                
            }
export type TDataReadInterfaceRunning = {
                id: number
                
            }

export class InterfacesService {

	/**
	 * Read Interfaces
	 * Retrieve interfaces.
	 * @returns InterfacesPublic Successful Response
	 * @throws ApiError
	 */
	public static readInterfaces(data: TDataReadInterfaces = {}): CancelablePromise<InterfacesPublic> {
		const {
limit = 200,
port = '',
skip = 0,
switchId = 0,
} = data;
		return __request(OpenAPI, {
			method: 'GET',
			url: '/api/v1/interfaces/',
			query: {
				skip, limit, port, switch_id: switchId
			},
			errors: {
				422: `Validation Error`,
			},
		});
	}

	/**
	 * Create Interface
	 * Create new interface.
	 * @returns InterfacePublic Successful Response
	 * @throws ApiError
	 */
	public static createInterface(data: TDataCreateInterface): CancelablePromise<InterfacePublic> {
		const {
requestBody,
} = data;
		return __request(OpenAPI, {
			method: 'POST',
			url: '/api/v1/interfaces/',
			body: requestBody,
			mediaType: 'application/json',
			errors: {
				422: `Validation Error`,
			},
		});
	}

	/**
	 * Read Interface
	 * Get interface by ID.
	 * @returns InterfacePublic Successful Response
	 * @throws ApiError
	 */
	public static readInterface(data: TDataReadInterface): CancelablePromise<InterfacePublic> {
		const {
id,
} = data;
		return __request(OpenAPI, {
			method: 'GET',
			url: '/api/v1/interfaces/{id}',
			path: {
				id
			},
			errors: {
				422: `Validation Error`,
			},
		});
	}

	/**
	 * Update Interface
	 * Update an interface.
	 * @returns InterfacePublic Successful Response
	 * @throws ApiError
	 */
	public static updateInterface(data: TDataUpdateInterface): CancelablePromise<InterfacePublic> {
		const {
id,
requestBody,
} = data;
		return __request(OpenAPI, {
			method: 'PUT',
			url: '/api/v1/interfaces/{id}',
			path: {
				id
			},
			body: requestBody,
			mediaType: 'application/json',
			errors: {
				422: `Validation Error`,
			},
		});
	}

	/**
	 * Delete Interface
	 * Delete an interface.
	 * @returns Message Successful Response
	 * @throws ApiError
	 */
	public static deleteInterface(data: TDataDeleteInterface): CancelablePromise<Message> {
		const {
id,
} = data;
		return __request(OpenAPI, {
			method: 'DELETE',
			url: '/api/v1/interfaces/{id}',
			path: {
				id
			},
			errors: {
				422: `Validation Error`,
			},
		});
	}

	/**
	 * Read Interface Running
	 * Get interface by ID.
	 * @returns unknown Successful Response
	 * @throws ApiError
	 */
	public static readInterfaceRunning(data: TDataReadInterfaceRunning): CancelablePromise<unknown> {
		const {
id,
} = data;
		return __request(OpenAPI, {
			method: 'GET',
			url: '/api/v1/interfaces/{id}/running',
			path: {
				id
			},
			errors: {
				422: `Validation Error`,
			},
		});
	}

}

export type TDataReadMacAddresses = {
                _interface?: string
limit?: number
mac?: string
skip?: number
switchId?: number
                
            }
export type TDataCreateMacAddress = {
                requestBody: MacAddressCreate
                
            }
export type TDataReadMacAddress = {
                id: number
                
            }
export type TDataUpdateMacAddress = {
                id: number
requestBody: MacAddressUpdate
                
            }
export type TDataDeleteMacAddress = {
                id: number
                
            }

export class MacAddressesService {

	/**
	 * Read Mac Addresses
	 * Retrieve mac_addresses.
	 * @returns MacAddressesPublic Successful Response
	 * @throws ApiError
	 */
	public static readMacAddresses(data: TDataReadMacAddresses = {}): CancelablePromise<MacAddressesPublic> {
		const {
_interface = '',
limit = 200,
mac = '',
skip = 0,
switchId = 0,
} = data;
		return __request(OpenAPI, {
			method: 'GET',
			url: '/api/v1/mac_addresses/',
			query: {
				skip, limit, mac, interface: _interface, switch_id: switchId
			},
			errors: {
				422: `Validation Error`,
			},
		});
	}

	/**
	 * Create Mac Address
	 * Create new mac_address.
	 * @returns unknown Successful Response
	 * @throws ApiError
	 */
	public static createMacAddress(data: TDataCreateMacAddress): CancelablePromise<unknown> {
		const {
requestBody,
} = data;
		return __request(OpenAPI, {
			method: 'POST',
			url: '/api/v1/mac_addresses/',
			body: requestBody,
			mediaType: 'application/json',
			errors: {
				422: `Validation Error`,
			},
		});
	}

	/**
	 * Read Mac Address
	 * Get mac_address by ID.
	 * @returns MacAddressPublic Successful Response
	 * @throws ApiError
	 */
	public static readMacAddress(data: TDataReadMacAddress): CancelablePromise<MacAddressPublic> {
		const {
id,
} = data;
		return __request(OpenAPI, {
			method: 'GET',
			url: '/api/v1/mac_addresses/{id}',
			path: {
				id
			},
			errors: {
				422: `Validation Error`,
			},
		});
	}

	/**
	 * Update Mac Address
	 * Update an mac_address.
	 * @returns MacAddressPublic Successful Response
	 * @throws ApiError
	 */
	public static updateMacAddress(data: TDataUpdateMacAddress): CancelablePromise<MacAddressPublic> {
		const {
id,
requestBody,
} = data;
		return __request(OpenAPI, {
			method: 'PUT',
			url: '/api/v1/mac_addresses/{id}',
			path: {
				id
			},
			body: requestBody,
			mediaType: 'application/json',
			errors: {
				422: `Validation Error`,
			},
		});
	}

	/**
	 * Delete Mac Address
	 * Delete an mac_address.
	 * @returns Message Successful Response
	 * @throws ApiError
	 */
	public static deleteMacAddress(data: TDataDeleteMacAddress): CancelablePromise<Message> {
		const {
id,
} = data;
		return __request(OpenAPI, {
			method: 'DELETE',
			url: '/api/v1/mac_addresses/{id}',
			path: {
				id
			},
			errors: {
				422: `Validation Error`,
			},
		});
	}

}

export type TDataReadArps = {
                _interface?: string
ip?: string
limit?: number
mac?: string
skip?: number
switchId?: number
                
            }
export type TDataCreateArp = {
                requestBody: ArpCreate
                
            }
export type TDataReadArp = {
                id: number
                
            }
export type TDataUpdateArp = {
                id: number
requestBody: ArpUpdate
                
            }
export type TDataDeleteArp = {
                id: number
                
            }

export class ArpsService {

	/**
	 * Read Arps
	 * Retrieve arps.
	 * @returns ArpsPublic Successful Response
	 * @throws ApiError
	 */
	public static readArps(data: TDataReadArps = {}): CancelablePromise<ArpsPublic> {
		const {
_interface = '',
ip = '',
limit = 200,
mac = '',
skip = 0,
switchId = 0,
} = data;
		return __request(OpenAPI, {
			method: 'GET',
			url: '/api/v1/arps/',
			query: {
				skip, limit, ip, mac, interface: _interface, switch_id: switchId
			},
			errors: {
				422: `Validation Error`,
			},
		});
	}

	/**
	 * Create Arp
	 * Create new arp.
	 * @returns unknown Successful Response
	 * @throws ApiError
	 */
	public static createArp(data: TDataCreateArp): CancelablePromise<unknown> {
		const {
requestBody,
} = data;
		return __request(OpenAPI, {
			method: 'POST',
			url: '/api/v1/arps/',
			body: requestBody,
			mediaType: 'application/json',
			errors: {
				422: `Validation Error`,
			},
		});
	}

	/**
	 * Read Arp
	 * Get arp by ID.
	 * @returns ArpPublic Successful Response
	 * @throws ApiError
	 */
	public static readArp(data: TDataReadArp): CancelablePromise<ArpPublic> {
		const {
id,
} = data;
		return __request(OpenAPI, {
			method: 'GET',
			url: '/api/v1/arps/{id}',
			path: {
				id
			},
			errors: {
				422: `Validation Error`,
			},
		});
	}

	/**
	 * Update Arp
	 * Update an arp.
	 * @returns ArpPublic Successful Response
	 * @throws ApiError
	 */
	public static updateArp(data: TDataUpdateArp): CancelablePromise<ArpPublic> {
		const {
id,
requestBody,
} = data;
		return __request(OpenAPI, {
			method: 'PUT',
			url: '/api/v1/arps/{id}',
			path: {
				id
			},
			body: requestBody,
			mediaType: 'application/json',
			errors: {
				422: `Validation Error`,
			},
		});
	}

	/**
	 * Delete Arp
	 * Delete an arp.
	 * @returns Message Successful Response
	 * @throws ApiError
	 */
	public static deleteArp(data: TDataDeleteArp): CancelablePromise<Message> {
		const {
id,
} = data;
		return __request(OpenAPI, {
			method: 'DELETE',
			url: '/api/v1/arps/{id}',
			path: {
				id
			},
			errors: {
				422: `Validation Error`,
			},
		});
	}

}

export type TDataReadIpInterfaces = {
                _interface?: string
ipv4?: string
limit?: number
skip?: number
switchId?: number
                
            }
export type TDataCreateIpInterface = {
                requestBody: IpInterfaceCreate
                
            }
export type TDataReadIpInterface = {
                id: number
                
            }
export type TDataUpdateIpInterface = {
                id: number
requestBody: IpInterfaceUpdate
                
            }
export type TDataDeleteIpInterface = {
                id: number
                
            }

export class IpInterfacesService {

	/**
	 * Read Ip Interfaces
	 * Retrieve ip_interfaces.
	 * @returns IpInterfacesPublic Successful Response
	 * @throws ApiError
	 */
	public static readIpInterfaces(data: TDataReadIpInterfaces = {}): CancelablePromise<IpInterfacesPublic> {
		const {
_interface = '',
ipv4 = '',
limit = 200,
skip = 0,
switchId = 0,
} = data;
		return __request(OpenAPI, {
			method: 'GET',
			url: '/api/v1/ip_interfaces/',
			query: {
				skip, limit, interface: _interface, ipv4, switch_id: switchId
			},
			errors: {
				422: `Validation Error`,
			},
		});
	}

	/**
	 * Create Ip Interface
	 * Create new ip_interface.
	 * @returns unknown Successful Response
	 * @throws ApiError
	 */
	public static createIpInterface(data: TDataCreateIpInterface): CancelablePromise<unknown> {
		const {
requestBody,
} = data;
		return __request(OpenAPI, {
			method: 'POST',
			url: '/api/v1/ip_interfaces/',
			body: requestBody,
			mediaType: 'application/json',
			errors: {
				422: `Validation Error`,
			},
		});
	}

	/**
	 * Read Ip Interface
	 * Get ip_interface by ID.
	 * @returns IpInterfacePublic Successful Response
	 * @throws ApiError
	 */
	public static readIpInterface(data: TDataReadIpInterface): CancelablePromise<IpInterfacePublic> {
		const {
id,
} = data;
		return __request(OpenAPI, {
			method: 'GET',
			url: '/api/v1/ip_interfaces/{id}',
			path: {
				id
			},
			errors: {
				422: `Validation Error`,
			},
		});
	}

	/**
	 * Update Ip Interface
	 * Update an ip_interface.
	 * @returns IpInterfacePublic Successful Response
	 * @throws ApiError
	 */
	public static updateIpInterface(data: TDataUpdateIpInterface): CancelablePromise<IpInterfacePublic> {
		const {
id,
requestBody,
} = data;
		return __request(OpenAPI, {
			method: 'PUT',
			url: '/api/v1/ip_interfaces/{id}',
			path: {
				id
			},
			body: requestBody,
			mediaType: 'application/json',
			errors: {
				422: `Validation Error`,
			},
		});
	}

	/**
	 * Delete Ip Interface
	 * Delete an ip_interface.
	 * @returns Message Successful Response
	 * @throws ApiError
	 */
	public static deleteIpInterface(data: TDataDeleteIpInterface): CancelablePromise<Message> {
		const {
id,
} = data;
		return __request(OpenAPI, {
			method: 'DELETE',
			url: '/api/v1/ip_interfaces/{id}',
			path: {
				id
			},
			errors: {
				422: `Validation Error`,
			},
		});
	}

}



export class LogsService {

	/**
	 * Read Logs
	 * @returns LogsPublic Successful Response
	 * @throws ApiError
	 */
	public static readLogs(): CancelablePromise<LogsPublic> {
				return __request(OpenAPI, {
			method: 'GET',
			url: '/api/v1/logs/',
		});
	}

}