import { defineCommand } from '@panerelay/site-kit';
import { language, title, WikipediaClient } from '../client.js';

export default defineCommand({
  name: 'page',
  description: 'Get a full plain-text Wikipedia article.',
  access: 'read',
  args: [
    {
      name: 'title',
      description: 'Article title',
      type: 'string',
      required: true,
      positional: true,
    },
    { name: 'lang', description: 'Wikipedia language code', type: 'string', default: 'en' },
    {
      name: 'paragraphs',
      description: 'Cap to first N paragraphs, 0 means full article',
      type: 'number',
      default: 0,
    },
  ],
  output: ['title', 'description', 'pageId', 'paragraphs', 'extract', 'url'],
  examples: ['panerelay wikipedia page "Machine learning" --paragraphs 3'],
  async run(context, args) {
    const articleTitle = title(args.title);
    const lang = language(args.lang);
    const paragraphsCap =
      args.paragraphs == null || args.paragraphs === '' ? 0 : Number(args.paragraphs);
    if (!Number.isInteger(paragraphsCap) || paragraphsCap < 0)
      throw new Error('paragraphs must be a non-negative integer (0 = full article)');
    const body = (await new WikipediaClient(context).json(lang, '/w/api.php', {
      action: 'query',
      format: 'json',
      formatversion: 2,
      prop: 'extracts|info|description',
      inprop: 'url',
      explaintext: 1,
      redirects: 1,
      titles: articleTitle,
    })) as Record<string, unknown>;
    const query = body.query as Record<string, unknown> | undefined;
    const pages = Array.isArray(query?.pages) ? query.pages : [];
    const page = pages[0] as Record<string, unknown> | undefined;
    if (!page || page.missing)
      throw new Error(`No article "${articleTitle}" on ${lang}.wikipedia.org`);
    const fullExtract = String(page.extract ?? '');
    if (!fullExtract.trim()) throw new Error(`Article "${articleTitle}" has no plain-text extract`);
    const allParagraphs = fullExtract
      .split(/\n{2,}/)
      .map(item => item.trim())
      .filter(Boolean);
    const selected = paragraphsCap > 0 ? allParagraphs.slice(0, paragraphsCap) : allParagraphs;
    const pageTitle = String(page.title ?? articleTitle);
    return [
      {
        title: pageTitle,
        description: String(page.description ?? ''),
        pageId: page.pageid ?? null,
        paragraphs: selected.length,
        extract: selected.join('\n\n'),
        url: String(
          page.fullurl ??
            `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(pageTitle.replace(/ /g, '_'))}`,
        ),
      },
    ];
  },
});
