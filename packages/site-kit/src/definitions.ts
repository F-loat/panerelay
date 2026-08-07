import type {
  BrowserFetchRequest,
  BrowserFetchResponse,
  FetchAdapterCommand,
  FetchAdapterInvocationRequest,
} from '@panerelay/protocol';

export type {
  BrowserFetchRequest,
  BrowserFetchResponse,
  FetchAdapterInvocationRequest,
} from '@panerelay/protocol';

export interface SiteDefinition {
  id: string;
  name: string;
  version: string;
  description: string;
}

export interface SiteCommandContext {
  invocation: FetchAdapterInvocationRequest;
  fetch(request: BrowserFetchRequest): Promise<BrowserFetchResponse>;
}

export interface SiteCommandDefinition extends FetchAdapterCommand {
  run(context: SiteCommandContext, args: FetchAdapterInvocationRequest['args']): Promise<unknown>;
}

export function defineSite<const T extends SiteDefinition>(definition: T): T {
  return definition;
}

export function defineCommand<const T extends SiteCommandDefinition>(definition: T): T {
  return definition;
}
