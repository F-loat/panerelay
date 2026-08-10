import { defineCommand } from '@panerelay/site-kit';
type JsonObject = Record<string, unknown>;
function object(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonObject) : {};
}
function text(value: unknown) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}
export default defineCommand({
  name: 'search',
  description: 'Search PowerChina procurement announcements.',
  access: 'read',
  args: [
    {
      name: 'query',
      description: 'Search keyword.',
      type: 'string',
      positional: true,
      required: true,
    },
    { name: 'limit', description: 'Maximum announcements.', type: 'number', default: 20 },
  ],
  output: [
    'rank',
    'content_type',
    'title',
    'publish_time',
    'project_code',
    'budget_or_limit',
    'url',
  ],
  examples: ['panerelay powerchina search procurement --limit 20'],
  async run(context, args) {
    const query = text(args.query);
    if (!query) throw new Error('powerchina query is required');
    const take = Number(args.limit ?? 20);
    if (!Number.isInteger(take) || take < 1 || take > 50)
      throw new Error('powerchina limit must be between 1 and 50');
    const payload = {
      pageNum: 1,
      pageSize: Math.max(20, Math.min(100, take * 3)),
      announcementType: '招采公告',
      companyType: '3',
      time: Date.now(),
      keyWords: query,
    };
    const response = await context.fetch({
      url: 'https://bid.powerchina.cn/newcbs/recpro-newmember/BidAnnouncementSummary/list',
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json;charset=utf-8',
        origin: 'https://bid.powerchina.cn',
        referer: 'https://bid.powerchina.cn/',
      },
      body: { encoding: 'utf8', data: JSON.stringify(payload) },
      responseType: 'json',
      withCookies: true,
    });
    if (response.status < 200 || response.status >= 300 || response.bodyType !== 'json')
      throw new Error(`powerchina request failed: HTTP ${response.status}`);
    const body = object(response.body);
    if (Number(body.code ?? 200) !== 200)
      throw new Error(text(body.msg) || `powerchina API error ${body.code}`);
    const rows = Array.isArray(body.rows) ? body.rows.map(object) : [];
    return rows
      .filter(row => text(row.id) && text(row.title))
      .slice(0, take)
      .map((row, index) => ({
        rank: index + 1,
        content_type: text(row.announcementType ?? row.titleTypeName),
        title: text(row.title),
        publish_time: text(row.publishTime ?? row.bidOpenTime ?? row.submissionDeadline),
        project_code: text(row.projectCode ?? row.projectNo ?? row.projectNumber),
        budget_or_limit: text(row.budget ?? row.limitPrice ?? row.maxPrice),
        url: `https://bid.powerchina.cn/newcbs/recpro-newmember/BidAnnouncementSummary/getInfo/${encodeURIComponent(text(row.id))}`,
      }));
  },
});
