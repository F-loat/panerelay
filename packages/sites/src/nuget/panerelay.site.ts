import { defineSite } from '@panerelay/site-kit';

export default defineSite({
  id: 'nuget',
  name: 'NuGet',
  version: '0.8.0',
  origins: ['https://api.nuget.org', 'https://azuresearch-usnc.nuget.org'],
  description: 'Public .NET package search and version history.',
});
