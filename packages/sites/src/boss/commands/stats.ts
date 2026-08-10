import { defineCommand } from '@panerelay/site-kit';
import { array, BossClient, pick, text } from '../client.js';

export default defineCommand({
  name: 'stats',
  description: 'Show recruiter job and chat statistics.',
  access: 'read',
  args: [
    { name: 'job-id', description: 'Optional encrypted job ID.', type: 'string', default: '' },
  ],
  output: ['job_name', 'salary', 'city', 'status', 'total_chats', 'encrypt_job_id'],
  examples: ['panerelay boss stats'],
  async run(context, args) {
    const client = new BossClient(context);
    const jobsPayload = await client.request(
      'https://www.zhipin.com/wapi/zpjob/job/chatted/jobList',
    );
    let jobs = array(pick(jobsPayload, 'zpData'), 'job list');
    const filter = text(args['job-id']);
    if (filter) jobs = jobs.filter(job => text(pick(job, 'encryptJobId')) === filter);
    let total = 0;
    try {
      const payload = await client.request(
        'https://www.zhipin.com/wapi/zpchat/chatHelper/statistics',
        { allowNonZero: true },
      );
      total = Number(pick(pick(payload, 'zpData'), 'totalFriendCount')) || 0;
    } catch {
      // The aggregate is optional; per-job rows remain useful when it is unavailable.
    }
    const counts = new Map<string, number>();
    try {
      for (const friend of await client.friendList()) {
        const name = text(pick(friend, 'jobName')) || 'unknown';
        counts.set(name, (counts.get(name) ?? 0) + 1);
      }
    } catch {
      // Chat counts are optional and default to zero when the helper endpoint is unavailable.
    }
    const output = jobs.map(job => ({
      job_name: text(pick(job, 'jobName')),
      salary: text(pick(job, 'salaryDesc')),
      city: text(pick(job, 'address')),
      status: Number(pick(job, 'jobOnlineStatus')) === 1 ? '在线' : '已关闭',
      total_chats: String(counts.get(text(pick(job, 'jobName'))) ?? 0),
      encrypt_job_id: text(pick(job, 'encryptJobId')),
    }));
    if (!filter && output.length)
      output.push({
        job_name: '--- 总计 ---',
        salary: '',
        city: '',
        status: `${jobs.length} 个职位`,
        total_chats: String(total),
        encrypt_job_id: '',
      });
    return output;
  },
});
