import { defineCommand } from '@panerelay/site-kit';
import { NowCoderClient, pick, selected, text } from '../client.js';
export default defineCommand({
  name: 'jobs',
  description: 'List NowCoder career categories.',
  access: 'read',
  args: [],
  output: ['id', 'career', 'learners'],
  examples: ['panerelay nowcoder jobs'],
  async run(context) {
    return selected(
      await new NowCoderClient(context).get('company-question/careerJobLevel1List'),
      'data',
      'careerJobSelectors',
    ).map(item => ({
      id: pick(item, 'id') ?? '',
      career: text(pick(item, 'name')),
      learners: pick(item, 'practiceCount') ?? '',
    }));
  },
});
