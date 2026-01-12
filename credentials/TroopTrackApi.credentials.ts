import type { ICredentialType, INodeProperties, Icon } from 'n8n-workflow';

export class TroopTrackApi implements ICredentialType {
	name = 'troopTrackApi';
	displayName = 'TroopTrack API';
	icon: Icon = { light: 'file:trooptrack.png', dark: 'file:trooptrack.png' };

	documentationUrl = 'https://trooptrack.com';

	properties: INodeProperties[] = [
		{
			displayName: 'TroopTrack Subdomain',
			name: 'subdomain',
			type: 'string',
			default: '',
			required: true,
			description: 'Only the subdomain part. Example: troop457zelie',
		},
		{
			displayName: 'Username',
			name: 'username',
			type: 'string',
			default: '',
			required: true,
		},
		{
			displayName: 'Password',
			name: 'password',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
		},
		{
			displayName: 'Partner Token',
			name: 'partnerToken',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description: 'TroopTrack developer program API token',
		},
	];
}
