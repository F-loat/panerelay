import { defineCommand } from '@panerelay/site-kit';
import { aliases, BASE, entityId, language, localised, pick, WikidataClient } from '../client.js';

export default defineCommand({
  name: 'entity',
  description: 'Fetch Wikidata entity metadata by Q/P/L id.',
  access: 'read',
  args: [
    {
      name: 'id',
      description: 'Q, P, or L entity id',
      type: 'string',
      required: true,
      positional: true,
    },
    { name: 'language', description: 'Display language', type: 'string', default: 'en' },
  ],
  output: [
    'qid',
    'type',
    'label',
    'description',
    'aliases',
    'claimPropertyCount',
    'sitelinkCount',
    'enwikiTitle',
    'modified',
    'url',
  ],
  examples: ['panerelay wikidata entity Q937 --language zh'],
  async run(context, args) {
    const qid = entityId(args.id);
    const lang = language(args.language);
    const body = await new WikidataClient(context).request(
      `/wiki/Special:EntityData/${encodeURIComponent(qid)}.json`,
    );
    const entity = pick(pick(body, 'entities'), qid);
    if (!entity) throw new Error(`wikidata entity ${qid} returned no payload`);
    const claims = pick(entity, 'claims');
    const sitelinks = pick(entity, 'sitelinks');
    const enwiki = pick(pick(sitelinks, 'enwiki'), 'title');
    return [
      {
        qid,
        type: typeof pick(entity, 'type') === 'string' ? pick(entity, 'type') : null,
        label: localised(pick(entity, 'labels'), lang),
        description: localised(pick(entity, 'descriptions'), lang),
        aliases: aliases(pick(entity, 'aliases'), lang),
        claimPropertyCount: claims && typeof claims === 'object' ? Object.keys(claims).length : 0,
        sitelinkCount:
          sitelinks && typeof sitelinks === 'object' ? Object.keys(sitelinks).length : 0,
        enwikiTitle: typeof enwiki === 'string' && enwiki.trim() ? enwiki : null,
        modified: typeof pick(entity, 'modified') === 'string' ? pick(entity, 'modified') : null,
        url: `${BASE}/wiki/${qid}`,
      },
    ];
  },
});
