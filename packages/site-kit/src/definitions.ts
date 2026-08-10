import type {
  BrowserFetchRequest,
  BrowserFetchResponse,
  BrowserFetchBindingPolicy,
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
  origins: string[];
  bindings?: BrowserFetchBindingPolicy[];
}

export interface SiteArtifact {
  id: string;
  basename: string;
  mediaType: string;
  size: number;
  bytes: Uint8Array;
}

export interface SiteCommandContext {
  invocation: FetchAdapterInvocationRequest;
  fetch(request: BrowserFetchRequest): Promise<BrowserFetchResponse>;
  artifact(argumentName: string): SiteArtifact;
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
