import { defineCommand } from '@panerelay/site-kit';
import { BossClient, bounded, object, pick, text } from '../client.js';

export default defineCommand({
  name: 'recommend',
  description: 'List recruiter-side recommended candidates.',
  access: 'read',
  args: [{ name: 'limit', description: 'Maximum rows.', type: 'number', default: 20 }],
  output: [
    'name',
    'job_name',
    'last_time',
    'labels',
    'encrypt_uid',
    'security_id',
    'encrypt_job_id',
  ],
  examples: ['panerelay boss recommend --limit 20'],
  async run(context, args) {
    const client = new BossClient(context);
    const labels = new Map<string, string>();
    const labelPayload = await client.request(
      'https://www.zhipin.com/wapi/zprelation/friend/label/get',
      { allowNonZero: true },
    );
    const rawLabels = pick(pick(labelPayload, 'zpData'), 'labels');
    if (Array.isArray(rawLabels))
      for (const value of rawLabels) {
        const label = object(value);
        labels.set(text(pick(label, 'labelId')), text(pick(label, 'label')));
      }
    return (await client.recommends()).slice(0, bounded(args.limit, 20, 100)).map(friend => {
      const raw = pick(friend, 'relationLabelList');
      return {
        name: text(pick(friend, 'name')),
        job_name: text(pick(friend, 'jobName')),
        last_time: text(pick(friend, 'lastTime')),
        labels: Array.isArray(raw)
          ? raw.map(id => labels.get(text(id)) || text(id)).join(', ')
          : '',
        encrypt_uid: text(pick(friend, 'encryptUid')),
        security_id: text(pick(friend, 'securityId')),
        encrypt_job_id: text(pick(friend, 'encryptJobId')),
      };
    });
  },
});
