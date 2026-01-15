import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';

export type ResourceHandler = {
	resource: string;
	runOnceOperations?: Set<string>;
	execute: (
		ctx: IExecuteFunctions,
		items: INodeExecutionData[],
		itemIndex: number,
		operation: string,
	) => Promise<any>;
};
