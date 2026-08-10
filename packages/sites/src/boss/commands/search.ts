import { defineCommand } from '@panerelay/site-kit';
import {
  array,
  BossClient,
  bounded,
  city,
  DEGREE,
  EXPERIENCE,
  INDUSTRY,
  JOB_TYPE,
  mapped,
  object,
  pick,
  SALARY,
  text,
} from '../client.js';

export default defineCommand({
  name: 'search',
  description: 'Search BOSS Zhipin jobs.',
  access: 'read',
  args: [
    { name: 'query', description: 'Optional search keyword.', type: 'string', positional: true },
    { name: 'city', description: 'City name or code.', type: 'string', default: '北京' },
    { name: 'experience', description: 'Experience filter.', type: 'string', default: '' },
    { name: 'degree', description: 'Degree filter.', type: 'string', default: '' },
    { name: 'salary', description: 'Salary filter.', type: 'string', default: '' },
    { name: 'industry', description: 'Industry code or name.', type: 'string', default: '' },
    { name: 'job-type', description: '全职, 兼职, 实习, or 不限.', type: 'string', default: '' },
    { name: 'page', description: 'Starting page.', type: 'number', default: 1 },
    { name: 'limit', description: 'Maximum rows.', type: 'number', default: 15 },
  ],
  output: [
    'name',
    'salary',
    'company',
    'area',
    'experience',
    'degree',
    'skills',
    'boss',
    'bossOnline',
    'security_id',
    'url',
  ],
  examples: ['panerelay boss search 前端 --city 杭州 --limit 15'],
  async run(context, args) {
    const client = new BossClient(context);
    const limit = bounded(args.limit, 15, 100);
    let page = bounded(args.page, 1, 10_000);
    const found: Record<string, unknown>[] = [];
    const seen = new Set<string>();
    while (found.length < limit) {
      const query = new URLSearchParams({
        scene: '1',
        query: text(args.query),
        city: city(args.city),
        page: String(page),
        pageSize: '15',
      });
      const filters: Array<[string, string]> = [
        ['experience', mapped(args.experience, EXPERIENCE)],
        ['degree', mapped(args.degree, DEGREE)],
        ['salary', mapped(args.salary, SALARY)],
        ['industry', mapped(args.industry, INDUSTRY)],
        ['jobType', mapped(args['job-type'], JOB_TYPE)],
      ];
      for (const [name, value] of filters) if (value) query.set(name, value);
      const payload = await client.request(
        `https://www.zhipin.com/wapi/zpgeek/search/joblist.json?${query}`,
      );
      const data = object(pick(payload, 'zpData'));
      const jobs = array(pick(data, 'jobList'), 'job search');
      let added = 0;
      for (const job of jobs) {
        const id = text(pick(job, 'encryptJobId'));
        if (!id || seen.has(id)) continue;
        seen.add(id);
        const skills = pick(job, 'skills');
        found.push({
          name: text(pick(job, 'jobName')),
          salary: text(pick(job, 'salaryDesc')),
          company: text(pick(job, 'brandName')),
          area: [pick(job, 'cityName'), pick(job, 'areaDistrict'), pick(job, 'businessDistrict')]
            .map(text)
            .filter(Boolean)
            .join('·'),
          experience: text(pick(job, 'jobExperience')),
          degree: text(pick(job, 'jobDegree')),
          skills: Array.isArray(skills) ? skills.map(text).join(',') : '',
          boss: `${text(pick(job, 'bossName'))} · ${text(pick(job, 'bossTitle'))}`,
          bossOnline:
            pick(job, 'bossOnline') === true ? 'Y' : pick(job, 'bossOnline') === false ? 'N' : '',
          security_id: text(pick(job, 'securityId')),
          url: `https://www.zhipin.com/job_detail/${id}.html`,
        });
        added += 1;
        if (found.length >= limit) break;
      }
      if (!added || !pick(data, 'hasMore')) break;
      page += 1;
    }
    return found;
  },
});
