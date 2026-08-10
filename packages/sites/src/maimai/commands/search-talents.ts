import { defineCommand } from '@panerelay/site-kit';
import { searchTalents } from '../operations.js';
export default defineCommand({
  name: 'search-talents',
  description: 'Search Maimai recruiter candidates.',
  access: 'read',
  args: [
    {
      name: 'query',
      description: 'Search keyword.',
      type: 'string',
      positional: true,
      required: true,
    },
    { name: 'page', description: 'Zero-based page.', type: 'number', default: 0 },
    { name: 'size', description: 'Results per page.', type: 'number', default: 20 },
    { name: 'positions', description: 'Position filters.', type: 'string' },
    { name: 'companies', description: 'Company filters.', type: 'string' },
    { name: 'schools', description: 'School filters.', type: 'string' },
    { name: 'provinces', description: 'Province filters.', type: 'string' },
    { name: 'cities', description: 'City filters.', type: 'string' },
    { name: 'worktimes', description: 'Work-year filters.', type: 'string' },
    { name: 'degrees', description: 'Education filters.', type: 'string' },
    { name: 'professions', description: 'Industry filters.', type: 'string' },
    { name: 'is-211', description: 'Require a 211 university.', type: 'number', default: 0 },
    { name: 'is-985', description: 'Require a 985 university.', type: 'number', default: 0 },
    { name: 'sortby', description: 'Sort mode 0-3.', type: 'number', default: 0 },
    { name: 'is-direct-chat', description: 'Require direct chat.', type: 'number', default: 0 },
  ],
  output: [
    'name',
    'job_title',
    'company',
    'historical_companies',
    'location',
    'work_year',
    'school',
    'degree',
    'active_status',
    'age',
    'tags',
    'mutual_friends',
  ],
  examples: ['panerelay maimai search-talents Java --size 20'],
  async run(context, args) {
    return searchTalents(context, args);
  },
});
