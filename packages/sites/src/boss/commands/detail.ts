import { defineCommand } from '@panerelay/site-kit';
import { BossClient, object, pick, required, text } from '../client.js';

export default defineCommand({
  name: 'detail',
  description: 'Show BOSS Zhipin job details.',
  access: 'read',
  args: [
    {
      name: 'security-id',
      description: 'Security ID from search.',
      type: 'string',
      required: true,
      positional: true,
    },
  ],
  output: [
    'name',
    'salary',
    'experience',
    'degree',
    'city',
    'district',
    'description',
    'skills',
    'welfare',
    'boss_name',
    'boss_title',
    'active_time',
    'company',
    'industry',
    'scale',
    'stage',
    'address',
    'url',
  ],
  examples: ['panerelay boss detail security-id'],
  async run(context, args) {
    const payload = await new BossClient(context).request(
      `https://www.zhipin.com/wapi/zpgeek/job/detail.json?securityId=${encodeURIComponent(required(args['security-id'], 'security-id'))}`,
    );
    const data = object(pick(payload, 'zpData'));
    const job = object(pick(data, 'jobInfo'));
    const boss = object(pick(data, 'bossInfo'));
    const company = object(pick(data, 'brandComInfo'));
    if (!text(pick(job, 'jobName'))) throw new Error('boss job does not exist or is offline');
    const joined = (value: unknown) => (Array.isArray(value) ? value.map(text).join(', ') : '');
    return [
      {
        name: text(pick(job, 'jobName')),
        salary: text(pick(job, 'salaryDesc')),
        experience: text(pick(job, 'experienceName')),
        degree: text(pick(job, 'degreeName')),
        city: text(pick(job, 'locationName')),
        district: [pick(job, 'areaDistrict'), pick(job, 'businessDistrict')]
          .map(text)
          .filter(Boolean)
          .join('·'),
        description: text(pick(job, 'postDescription')),
        skills: joined(pick(job, 'showSkills')),
        welfare: joined(pick(company, 'labels')),
        boss_name: text(pick(boss, 'name')),
        boss_title: text(pick(boss, 'title')),
        active_time: text(pick(boss, 'activeTimeDesc')),
        company: text(pick(company, 'brandName')) || text(pick(boss, 'brandName')),
        industry: text(pick(company, 'industryName')),
        scale: text(pick(company, 'scaleName')),
        stage: text(pick(company, 'stageName')),
        address: text(pick(job, 'address')),
        url: pick(job, 'encryptId')
          ? `https://www.zhipin.com/job_detail/${text(pick(job, 'encryptId'))}.html`
          : '',
      },
    ];
  },
});
