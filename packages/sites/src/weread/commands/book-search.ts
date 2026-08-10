import { defineCommand } from '@panerelay/site-kit';
import {
  WereadClient,
  info,
  object,
  pick,
  positive,
  required,
  resolveUrl,
  text,
} from '../client.js';

interface Book {
  bookId: string;
  title: string;
  author: string;
  url: string | null;
}

async function resolveBook(client: WereadClient, target: string, rank: number): Promise<Book> {
  if (/^\d+$/.test(target)) return { bookId: target, title: '', author: '', url: null };
  if (/^https:\/\/weread\.qq\.com\/web\/reader\//.test(target)) {
    const html = await client.html(target);
    const state = html.match(/window\.__INITIAL_STATE__=([\s\S]*?);\(function\(\)\{var s;/)?.[1];
    if (!state) throw new Error('weread reader page contained no initial state');
    let payload: unknown;
    try {
      payload = JSON.parse(state);
    } catch {
      throw new Error('weread reader page contained invalid initial state');
    }
    const reader = object(pick(payload, 'reader'));
    const book = object(pick(reader, 'bookInfo'));
    const bookId = text(pick(book, 'bookId') || pick(reader, 'bookId'));
    if (!bookId) throw new Error('weread reader URL did not resolve to a book ID');
    return {
      bookId,
      title: text(pick(book, 'title')),
      author: text(pick(book, 'author')),
      url: target,
    };
  }
  const books = await client.searchBooks(target);
  const selected = books[rank - 1];
  if (!selected) throw new Error(`weread book-rank ${rank} exceeds the search results`);
  const book = info(selected);
  const bookId = text(pick(book, 'bookId'));
  const title = text(pick(book, 'title'));
  const author = text(pick(book, 'author'));
  if (!bookId) throw new Error('weread selected book has no book ID');
  return {
    bookId,
    title,
    author,
    url: resolveUrl(title, author, await client.searchEntries(target)),
  };
}

export default defineCommand({
  name: 'book-search',
  description: 'Search for matching text inside a public WeRead book.',
  access: 'read',
  args: [
    {
      name: 'book',
      description: 'Book title, numeric book ID, or reader URL.',
      type: 'string',
      required: true,
      positional: true,
    },
    {
      name: 'query',
      description: 'Text to search inside the book.',
      type: 'string',
      required: true,
      positional: true,
    },
    {
      name: 'book-rank',
      description: 'Book result to select for title lookup.',
      type: 'number',
      default: 1,
    },
    { name: 'limit', description: 'Maximum in-book matches.', type: 'number', default: 20 },
    {
      name: 'fragment-size',
      description: 'Snippet length around each match.',
      type: 'number',
      default: 150,
    },
  ],
  output: [
    'rank',
    'bookTitle',
    'author',
    'chapterIndex',
    'snippet',
    'searchIndex',
    'chapterUid',
    'bookId',
    'url',
  ],
  examples: ['panerelay weread book-search 三体 地球 --limit 10'],
  async run(context, args) {
    const target = required(args.book, 'book');
    const query = required(args.query, 'query');
    const rank = positive(args['book-rank'], 1, 100, 'book-rank');
    const take = positive(args.limit, 20, 100, 'limit');
    const fragmentSize = positive(args['fragment-size'], 150, 500, 'fragment-size');
    const client = new WereadClient(context);
    const book = await resolveBook(client, target, rank);
    const matches = [];
    let maxIndex = 0;
    while (matches.length < take) {
      const count = Math.min(50, take - matches.length);
      const data = await client.json('/web/book/search', {
        bookId: book.bookId,
        keyword: query,
        maxIdx: String(maxIndex),
        count: String(count),
        fragmentSize: String(fragmentSize),
        onlyCount: '0',
      });
      const result = pick(data, 'result');
      if (!Array.isArray(result))
        throw new Error('weread in-book search returned an unexpected result payload');
      if (!result.length) break;
      for (const item of result) {
        const snippet = text(pick(item, 'abstract'));
        const searchIndex = Number(pick(item, 'searchIdx'));
        if (!snippet || !Number.isFinite(searchIndex) || searchIndex <= 0)
          throw new Error('weread in-book search returned a malformed match');
        matches.push({ item, snippet, searchIndex });
      }
      const next = matches.at(-1)?.searchIndex ?? 0;
      if (next <= maxIndex) throw new Error('weread in-book pagination did not advance');
      maxIndex = next;
      const hasMore = pick(data, 'hasMore');
      if (hasMore === false || hasMore === 0 || hasMore === '0' || result.length < count) break;
    }
    const rows = matches.slice(0, take).map(({ item, snippet, searchIndex }, index) => ({
      rank: index + 1,
      bookTitle: book.title || null,
      author: book.author || null,
      chapterIndex: Number(pick(item, 'chapterIdx')) || null,
      snippet,
      searchIndex,
      chapterUid: Number(pick(item, 'chapterUid')) || null,
      bookId: book.bookId,
      url: book.url,
    }));
    if (!rows.length)
      throw new Error(`weread returned no matches for "${query}" in book ${book.bookId}`);
    return rows;
  },
});
