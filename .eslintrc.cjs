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
		},
		{
			files: ['credentials/**/*.ts'],
			extends: ['plugin:n8n-nodes-base/credentials'],
		},
	],
};
