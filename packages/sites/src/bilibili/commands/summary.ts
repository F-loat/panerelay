import { defineCommand, SiteError } from '@panerelay/site-kit';
import {
  type AdapterArgs,
  BilibiliClient,
  arrayValue,
  objectValue,
  positiveInteger,
  requiredString,
  stringValue,
} from '../client.js';
import { viewData } from './_shared/video.js';

export default defineCommand({
  name: 'summary',
  description: "Get Bilibili's official AI-generated video summary and outline.",
  access: 'read',
  args: [
    {
      name: 'bvid',
      description: 'Video BV ID, URL, or b23.tv short link',
      type: 'string',
      required: true,
      positional: true,
    },
  ],
  output: ['time', 'content'],
  examples: ['panerelay bilibili summary BV1xx411c7mD'],
  async run(context, args) {
    return commandSummary(new BilibiliClient(context), args);
  },
});

function summaryTime(value: unknown): string {
  const seconds = Math.max(0, Math.floor(Number(value) || 0));
  const hours = Math.floor(seconds / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  const remaining = seconds % 60;
  return hours
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remaining).padStart(2, '0')}`
    : `${String(minutes).padStart(2, '0')}:${String(remaining).padStart(2, '0')}`;
}

export async function commandSummary(client: BilibiliClient, args: AdapterArgs): Promise<unknown> {
  const bvid = await client.resolveBvid(requiredString(args, 'bvid'));
  const view = await viewData(client, bvid);
  const cid = positiveInteger(view.cid, 'Bilibili summary cid');
  const owner = objectValue(view.owner, 'video owner');
  const upMid = positiveInteger(owner.mid, 'Bilibili video owner');
  const conclusion = objectValue(
    await client.data('/x/web-interface/view/conclusion/get', { bvid, cid, up_mid: upMid }, true),
    'conclusion data',
  );
  if (conclusion.code !== 0)
    throw new SiteError('empty-result', `No Bilibili AI summary found for ${bvid}`);
  let model: unknown = conclusion.model_result;
  if (typeof model === 'string') {
    try {
      model = JSON.parse(model) as unknown;
    } catch {
      throw new SiteError('shape-drift', 'Bilibili summary model is malformed');
    }
  }
  const result = objectValue(model, 'summary model');
  const summary = stringValue(result.summary).trim();
  if (!summary) throw new SiteError('empty-result', `No Bilibili AI summary found for ${bvid}`);
  const rows = [{ time: '', content: summary }];
  for (const value of arrayValue(result.outline ?? [], 'summary outline')) {
    const section = objectValue(value, 'summary section');
    const title = stringValue(section.title).trim();
    if (title) rows.push({ time: summaryTime(section.timestamp), content: `# ${title}` });
    for (const pointValue of arrayValue(section.part_outline ?? [], 'summary points')) {
      const point = objectValue(pointValue, 'summary point');
      const content = stringValue(point.content).trim();
      if (content) rows.push({ time: summaryTime(point.timestamp), content });
    }
  }
  return rows;
}
