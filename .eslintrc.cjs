module.exports = {
	root: true,
	env: {
		es2021: true,
		node: true,
	},
	parser: '@typescript-eslint/parser',
	parserOptions: {
		ecmaVersion: 'latest',
		sourceType: 'module',
	},
	plugins: ['@typescript-eslint', 'n8n-nodes-base'],
	ignorePatterns: ['dist/**', 'node_modules/**', 'builds/**'],
	overrides: [
		{
			files: ['nodes/**/*.ts'],
			extends: ['plugin:n8n-nodes-base/nodes'],
			rules: {
				// Stop casing nags for node UI strings
				'n8n-nodes-base/node-param-display-name-miscased': 'off',
				'n8n-nodes-base/node-param-description-lowercase-first-char': 'off',

				// Optional: if you see casing nags on option names too
				'n8n-nodes-base/node-param-display-name-miscased-id': 'off',
				'n8n-nodes-base/node-param-operation-option-action-miscased': 'off',
			},
		},
		{
			files: ['credentials/**/*.ts'],
			extends: ['plugin:n8n-nodes-base/credentials'],
			rules: {
				// Stop casing nags for credential UI strings
				'n8n-nodes-base/cred-class-field-display-name-miscased': 'off',
			},
		},
	],
};