import { defineCommand } from '@panerelay/site-kit';
import { array, BossClient, pick, text } from '../client.js';

export default defineCommand({
  name: 'joblist',
  description: 'List jobs published by the recruiter account.',
  access: 'read',
  args: [],
  output: ['job_name', 'salary', 'city', 'status', 'encrypt_job_id'],
  examples: ['panerelay boss joblist'],
  async run(context) {
    const payload = await new BossClient(context).request(
      'https://www.zhipin.com/wapi/zpjob/job/chatted/jobList',
    );
    return array(pick(payload, 'zpData'), 'job list').map(job => ({
      job_name: text(pick(job, 'jobName')),
      salary: text(pick(job, 'salaryDesc')),
      city: text(pick(job, 'address')),
      status: Number(pick(job, 'jobOnlineStatus')) === 1 ? '在线' : '已关闭',
      encrypt_job_id: text(pick(job, 'encryptJobId')),
    }));
  },
});
