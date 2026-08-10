import { defineCommand } from '@panerelay/site-kit';
import { DockerHubClient, parseImage, pick, text, trimDate } from '../client.js';

export default defineCommand({
  name: 'image',
  description: 'Fetch public Docker Hub repository metadata.',
  access: 'read',
  args: [
    {
      name: 'image',
      description: 'Image name, such as nginx or bitnami/redis',
      type: 'string',
      required: true,
      positional: true,
    },
  ],
  output: [
    'image',
    'official',
    'stars',
    'pulls',
    'description',
    'lastUpdated',
    'lastModified',
    'registered',
    'status',
    'url',
  ],
  examples: ['panerelay dockerhub image nginx'],
  async run(context, args) {
    const { owner, name } = parseImage(args.image);
    const body = await new DockerHubClient(context).json(`/repositories/${owner}/${name}/`);
    const namespace = text(pick(body, 'namespace')) || owner;
    const official = namespace === 'library' || namespace === '_';
    const image = official ? `library/${name}` : `${namespace}/${name}`;
    return [
      {
        image,
        official,
        stars: pick(body, 'star_count') == null ? null : Number(pick(body, 'star_count')),
        pulls: pick(body, 'pull_count') == null ? null : Number(pick(body, 'pull_count')),
        description: text(pick(body, 'description')),
        lastUpdated: trimDate(pick(body, 'last_updated')),
        lastModified: trimDate(pick(body, 'last_modified')),
        registered: trimDate(pick(body, 'date_registered')),
        status: text(pick(body, 'status_description')),
        url: `https://hub.docker.com/r/${image}`,
      },
    ];
  },
});
