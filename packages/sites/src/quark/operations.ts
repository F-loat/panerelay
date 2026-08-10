import type { SiteCommandContext } from '@panerelay/site-kit';
import {
  bounded,
  confirm,
  extractPwdId,
  fidList,
  flag,
  formatDate,
  formatSize,
  pick,
  QuarkClient,
  required,
  text,
  type JsonObject,
} from './client.js';

type Args = Record<string, unknown>;

function fileRow(file: JsonObject, path: string, level = 0) {
  const name = text(pick(file, 'file_name'));
  return {
    name: `${'  '.repeat(level)}${name}`,
    is_dir: flag(pick(file, 'dir')),
    size: formatSize(pick(file, 'size')),
    fid: text(pick(file, 'fid')),
    path: path ? `${path}/${name}` : name,
  };
}

async function driveTree(
  client: QuarkClient,
  parentFid: string,
  path: string,
  level: number,
  maxDepth: number,
  directoriesOnly: boolean,
): Promise<ReturnType<typeof fileRow>[]> {
  const result: ReturnType<typeof fileRow>[] = [];
  for (const file of await client.listDrive(parentFid)) {
    const row = fileRow(file, path, level);
    if (!directoriesOnly || row.is_dir) result.push(row);
    if (row.is_dir && level < maxDepth) {
      result.push(
        ...(await driveTree(client, row.fid, row.path, level + 1, maxDepth, directoriesOnly)),
      );
    }
  }
  return result;
}

export async function list(context: SiteCommandContext, args: Args) {
  const client = new QuarkClient(context);
  const path = text(args.path);
  const root = path ? await client.findFolder(path) : '0';
  return driveTree(client, root, path, 0, bounded(args.depth, 0, 10), flag(args['dirs-only']));
}

async function shareTreeNodes(
  client: QuarkClient,
  pwdId: string,
  stoken: string,
  parentFid: string,
  level: number,
  maxDepth: number,
): Promise<JsonObject[]> {
  const nodes: JsonObject[] = [];
  for (const file of await client.listShare(pwdId, stoken, parentFid)) {
    const node: JsonObject = {
      fid: text(pick(file, 'fid')),
      name: text(pick(file, 'file_name')),
      size: pick(file, 'size') ?? 0,
      is_dir: flag(pick(file, 'dir')),
      created_at: formatDate(pick(file, 'created_at')),
      updated_at: formatDate(pick(file, 'updated_at')),
    };
    if (node.is_dir && level < maxDepth) {
      node.children = await shareTreeNodes(
        client,
        pwdId,
        stoken,
        text(node.fid),
        level + 1,
        maxDepth,
      );
    }
    nodes.push(node);
  }
  return nodes;
}

export async function shareTree(context: SiteCommandContext, args: Args) {
  const client = new QuarkClient(context);
  const pwdId = extractPwdId(args.url);
  const stoken = await client.shareToken(pwdId, text(args.passcode));
  return [
    {
      pwd_id: pwdId,
      stoken,
      tree: await shareTreeNodes(client, pwdId, stoken, '0', 0, bounded(args.depth, 10, 10)),
    },
  ];
}

export async function whoami(context: SiteCommandContext) {
  const data = await new QuarkClient(context).account();
  const nickname = text(pick(data, 'nickname') ?? pick(data, 'nick_name') ?? pick(data, 'name'));
  if (!nickname) throw new Error('quark account response did not contain a nickname');
  return [{ logged_in: true, site: 'quark', nickname }];
}

async function destination(
  client: QuarkClient,
  args: Args,
): Promise<{ fid: string; label: string }> {
  const path = text(args.to ?? args.parent);
  const direct = text(args['to-fid'] ?? args['parent-fid']);
  if (path && direct) throw new Error('quark accepts either a destination path or fid, not both');
  if (direct) return { fid: direct, label: direct };
  if (path) return { fid: await client.findFolder(path), label: path };
  return { fid: '0', label: '/' };
}

export async function mkdir(context: SiteCommandContext, args: Args) {
  confirm(args);
  const name = required(args.name, 'name');
  const client = new QuarkClient(context);
  const parent = await destination(client, args);
  const data = await client.post('https://drive-pc.quark.cn/1/clouddrive/file?pr=ucpro&fr=pc', {
    pdir_fid: parent.fid,
    file_name: name,
    dir_path: '',
    dir_init_lock: false,
  });
  return [{ status: 'ok', fid: text(pick(data, 'fid')), name, parent: parent.label }];
}

export async function rename(context: SiteCommandContext, args: Args) {
  confirm(args);
  const fid = required(args.fid, 'fid');
  const name = required(args.name, 'name');
  await new QuarkClient(context).post(
    'https://drive-pc.quark.cn/1/clouddrive/file/rename?pr=ucpro&fr=pc',
    { fid, file_name: name },
  );
  return [{ status: 'ok', fid, new_name: name }];
}

export async function remove(context: SiteCommandContext, args: Args) {
  confirm(args);
  const fids = fidList(args.fids);
  await new QuarkClient(context).post(
    'https://drive-pc.quark.cn/1/clouddrive/file/delete?pr=ucpro&fr=pc',
    { filelist: fids },
  );
  return [{ status: 'ok', count: fids.length, deleted_fids: fids.join(',') }];
}

function taskAttempts(value: unknown): number {
  const seconds = value == null || value === '' ? 120 : Number(value);
  if (!Number.isInteger(seconds) || seconds < 1 || seconds > 120) {
    throw new Error('quark timeout must be between 1 and 120 seconds');
  }
  return seconds * 2;
}

export async function move(context: SiteCommandContext, args: Args) {
  confirm(args);
  const fids = fidList(args.fids);
  if (!text(args.to) && !text(args['to-fid']))
    throw new Error('quark mv requires --to or --to-fid');
  const client = new QuarkClient(context);
  const target = await destination(client, args);
  const data = await client.post(
    'https://drive-pc.quark.cn/1/clouddrive/file/move?pr=ucpro&fr=pc',
    { filelist: fids, to_pdir_fid: target.fid },
  );
  const taskId = text(pick(data, 'task_id'));
  if (taskId) await client.waitForTask(taskId, taskAttempts(args.timeout));
  return [
    {
      status: 'ok',
      count: fids.length,
      destination: target.label,
      task_id: taskId,
      completed: true,
    },
  ];
}

export async function save(context: SiteCommandContext, args: Args) {
  confirm(args);
  if (!text(args.to) && !text(args['to-fid']))
    throw new Error('quark save requires --to or --to-fid');
  const client = new QuarkClient(context);
  const pwdId = extractPwdId(args.url);
  const target = await destination(client, args);
  const rawFids = text(args.fids);
  const saveAll = !rawFids;
  const stoken =
    text(args.stoken) || (saveAll ? await client.shareToken(pwdId, text(args.passcode)) : '');
  if (!stoken) throw new Error('quark save requires --stoken when --fids is used');
  const fids = saveAll ? [] : fidList(rawFids);
  const data = await client.post(
    'https://drive-h.quark.cn/1/clouddrive/share/sharepage/save?pr=ucpro&fr=pc',
    {
      pwd_id: pwdId,
      stoken,
      pdir_fid: '0',
      to_pdir_fid: target.fid,
      fid_list: fids,
      pdir_save_all: saveAll,
      scene: 'link',
    },
  );
  const taskId = text(pick(data, 'task_id'));
  const task = taskId ? await client.waitForTask(taskId, taskAttempts(args.timeout)) : {};
  return [
    {
      success: true,
      task_id: taskId,
      saved_to: target.label,
      target_fid: target.fid,
      fids: fids.join(','),
      save_count: pick(pick(task, 'save_as'), 'save_as_sum_num') ?? '',
    },
  ];
}
