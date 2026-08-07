import type { FetchAdapterCommand, FetchAdapterInvocationRequest } from '@panerelay/protocol';
import { BilibiliClient, type AdapterArgs, type BilibiliAdapterDependencies } from '../client.js';
import { commandComment, commandMetadata as commentMetadata } from './comment.js';
import { commandComments, commandMetadata as commentsMetadata } from './comments.js';
import { commandDynamic, commandMetadata as dynamicMetadata } from './dynamic.js';
import { commandFavorite, commandMetadata as favoriteMetadata } from './favorite.js';
import { commandFeedDetail, commandMetadata as feedDetailMetadata } from './feed-detail.js';
import { commandFeed, commandMetadata as feedMetadata } from './feed.js';
import { commandFollow, commandMetadata as followMetadata } from './follow.js';
import { commandFollowing, commandMetadata as followingMetadata } from './following.js';
import { commandHistory, commandMetadata as historyMetadata } from './history.js';
import { commandHot, commandMetadata as hotMetadata } from './hot.js';
import { commandMe, commandMetadata as meMetadata } from './me.js';
import { commandRanking, commandMetadata as rankingMetadata } from './ranking.js';
import { commandSearch, commandMetadata as searchMetadata } from './search.js';
import { commandSubtitle, commandMetadata as subtitleMetadata } from './subtitle.js';
import { commandSummary, commandMetadata as summaryMetadata } from './summary.js';
import { commandUnfollow, commandMetadata as unfollowMetadata } from './unfollow.js';
import { commandUserVideos, commandMetadata as userVideosMetadata } from './user-videos.js';
import { commandVideo, commandMetadata as videoMetadata } from './video.js';
import { commandWhoami, commandMetadata as whoamiMetadata } from './whoami.js';

export type { BilibiliAdapterDependencies } from '../client.js';
export { signWbiQuery } from './_shared/wbi.js';

type CommandHandler = (client: BilibiliClient, args: AdapterArgs) => Promise<unknown>;

const COMMAND_DEFINITIONS: Array<{
  metadata: FetchAdapterCommand;
  handler: CommandHandler;
}> = [
  { metadata: whoamiMetadata, handler: commandWhoami },
  { metadata: meMetadata, handler: commandMe },
  { metadata: videoMetadata, handler: commandVideo },
  { metadata: searchMetadata, handler: commandSearch },
  { metadata: hotMetadata, handler: commandHot },
  { metadata: rankingMetadata, handler: commandRanking },
  { metadata: dynamicMetadata, handler: commandDynamic },
  { metadata: feedMetadata, handler: commandFeed },
  { metadata: feedDetailMetadata, handler: commandFeedDetail },
  { metadata: favoriteMetadata, handler: commandFavorite },
  { metadata: historyMetadata, handler: commandHistory },
  { metadata: followingMetadata, handler: commandFollowing },
  { metadata: userVideosMetadata, handler: commandUserVideos },
  { metadata: commentsMetadata, handler: commandComments },
  { metadata: subtitleMetadata, handler: commandSubtitle },
  { metadata: summaryMetadata, handler: commandSummary },
  { metadata: commentMetadata, handler: commandComment },
  { metadata: followMetadata, handler: commandFollow },
  { metadata: unfollowMetadata, handler: commandUnfollow },
];

const COMMANDS = Object.fromEntries(
  COMMAND_DEFINITIONS.map(definition => [definition.metadata.name, definition.handler]),
) as Record<string, CommandHandler>;

export const BILIBILI_COMMAND_NAMES = Object.freeze(Object.keys(COMMANDS).sort());
export const BILIBILI_COMMAND_METADATA = Object.freeze(
  COMMAND_DEFINITIONS.map(definition => definition.metadata),
);

export async function executeBilibiliCommand(
  invocation: FetchAdapterInvocationRequest,
  dependencies: BilibiliAdapterDependencies = {},
): Promise<unknown> {
  const handler = COMMANDS[invocation.command];
  if (!handler) throw new Error(`Unknown Bilibili command: ${invocation.command}`);
  return handler(new BilibiliClient(invocation, dependencies), invocation.args);
}
