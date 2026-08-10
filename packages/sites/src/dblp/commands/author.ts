import { defineCommand } from '@panerelay/site-kit';
import { DblpClient, limit, pick, required, text, xmlRow } from '../client.js';
export default defineCommand({
  name: 'author',
  description: 'List DBLP publications by an author or PID.',
  access: 'read',
  args: [
    { name: 'author', description: 'Author name', type: 'string', positional: true },
    { name: 'pid', description: 'Canonical DBLP PID', type: 'string' },
    { name: 'limit', description: 'Maximum publications', type: 'number', default: 20 },
  ],
  output: ['rank', 'key', 'title', 'authors', 'venue', 'year', 'type', 'doi', 'pid', 'url'],
  examples: ['panerelay dblp author Yoshua Bengio'],
  async run(context, args) {
    const take = limit(args.limit, 20, 200);
    let pid = text(args.pid).trim();
    if (pid && !/^[0-9a-z]+(?:\/[0-9a-z-]+)+$/i.test(pid))
      throw new Error(`dblp pid "${args.pid}" is not valid`);
    if (!pid) {
      const name = required(args.author, 'author');
      const body = await new DblpClient(context).json(
        `/search/author/api?q=${encodeURIComponent(name)}&format=json&h=20`,
      );
      const hits = pick(body, 'result.hits.hit');
      const top = Array.isArray(hits) ? hits[0] : hits;
      const url = text(pick(top, 'info.url'));
      pid = url.match(/\/pid\/([^/]+(?:\/[^/]+)+)$/)?.[1] ?? '';
      if (!pid) throw new Error(`No DBLP author matched "${name}"`);
    }
    const xml = await new DblpClient(context).xml(`/pid/${pid}.xml`);
    const records = [...xml.matchAll(/<r>\s*([\s\S]*?)\s*<\/r>/g)]
      .map(match => match[1] ?? '')
      .filter(record => !/^<crossref/.test(record));
    if (!records.length) throw new Error(`DBLP PID ${pid} has no publications`);
    return records.slice(0, take).map((record, index) => {
      const row = xmlRow(`<root>${record}</root>`);
      return {
        rank: index + 1,
        key: row.key,
        title: row.title,
        authors: row.authors,
        venue: row.venue,
        year: row.year,
        type: row.type,
        doi: row.doi,
        pid,
        url: row.openAccessUrl || row.dblpUrl,
      };
    });
  },
});
