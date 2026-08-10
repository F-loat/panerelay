import { defineCommand } from '@panerelay/site-kit';
import { WereadClient, object, pick, positive, required, text } from '../client.js';

export default defineCommand({
  name: 'ai-outline',
  description: 'Get the AI-generated outline for a WeRead book.',
  access: 'read',
  args: [
    { name: 'book-id', description: 'Book ID.', type: 'string', required: true, positional: true },
    {
      name: 'limit',
      description: 'Maximum outline rows or chapters.',
      type: 'number',
      default: 200,
    },
    {
      name: 'depth',
      description: 'Maximum outline depth from 2 to 4.',
      type: 'number',
      default: 4,
    },
    {
      name: 'raw',
      description: 'Return structured outline rows.',
      type: 'boolean',
      default: false,
    },
  ],
  output: ['chapter', 'idx', 'level', 'text', 'outline'],
  examples: ['panerelay weread ai-outline 123456 --raw'],
  async run(context, args) {
    const client = new WereadClient(context);
    const bookId = required(args['book-id'], 'book-id');
    const limit = positive(args.limit, 200, 10_000, 'limit');
    const depth = positive(args.depth, 4, 4, 'depth');
    if (depth < 2) throw new Error('weread depth must be between 2 and 4');
    const chapterData = await client.postJson(
      'book/chapterInfos',
      { bookIds: [bookId], sinces: [0] },
      true,
    );
    const first = Array.isArray(pick(chapterData, 'data'))
      ? object((pick(chapterData, 'data') as unknown[])[0])
      : {};
    const chapters = pick(first, 'updated');
    if (!Array.isArray(chapters) || chapters.length === 0)
      throw new Error('weread returned no chapters for this book');
    const chapterNames = new Map<string, string>();
    const chapterUids: unknown[] = [];
    for (const raw of chapters) {
      const chapter = object(raw);
      const uid = pick(chapter, 'chapterUid');
      chapterUids.push(uid);
      chapterNames.set(text(uid), text(pick(chapter, 'title')));
    }
    const outlineData = await client.postJson('book/outline', { bookId, chapterUids }, false);
    const entries = pick(outlineData, 'itemsArray');
    const rows: Array<{ chapter: string; idx: string; level: number; text: string }> = [];
    for (const rawEntry of Array.isArray(entries) ? entries : []) {
      const entry = object(rawEntry);
      const chapter =
        chapterNames.get(text(pick(entry, 'chapterUid'))) ||
        `Chapter ${text(pick(entry, 'chapterUid'))}`;
      const items = pick(entry, 'items');
      let lastLevelThree = '';
      let levelFour = 0;
      for (const rawItem of Array.isArray(items) ? items : []) {
        const item = object(rawItem);
        const level = Number(pick(item, 'level') ?? 1);
        if (level <= 1 || level > depth) continue;
        let idx = text(pick(item, 'uiIdx'));
        if (level === 3 && idx) {
          lastLevelThree = idx;
          levelFour = 0;
        } else if (level === 4 && !idx && lastLevelThree) {
          levelFour += 1;
          idx = `${lastLevelThree}.${levelFour}`;
        }
        rows.push({ chapter, idx, level, text: text(pick(item, 'text')) });
      }
    }
    if (args.raw === true || text(args.raw).toLowerCase() === 'true') return rows.slice(0, limit);
    const grouped = new Map<string, typeof rows>();
    for (const row of rows) grouped.set(row.chapter, [...(grouped.get(row.chapter) ?? []), row]);
    return [...grouped].slice(0, limit).map(([chapter, chapterRows]) => ({
      outline: [
        `📖 ${chapter}`,
        ...chapterRows.map(
          row => `${'  '.repeat(row.level - 2)}${row.idx}${row.idx ? ' ' : ''}${row.text}`,
        ),
      ].join('\n'),
    }));
  },
});
