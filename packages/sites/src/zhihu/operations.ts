import type { SiteCommandContext } from '@panerelay/site-kit';
import {
  answerIdFrom,
  integer,
  numericId,
  object,
  parseAnswerTarget,
  parseTarget,
  payload,
  pick,
  requireExecute,
  requireKind,
  required,
  stripHtml,
  text,
  unixTime,
  userSlug,
  type Value,
  writeRow,
  ZhihuClient,
} from './client.js';

type Args = Record<string, unknown>;

const ARTICLE_TITLE_MAX_BYTES = 300;
const ARTICLE_CONTENT_MAX_BYTES = 1_000_000;

function inlineArticleField(
  value: unknown,
  name: 'title' | 'content',
  maximumBytes: number,
): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`zhihu article ${name} cannot be empty or whitespace only`);
  }
  if (new TextEncoder().encode(value).byteLength > maximumBytes) {
    throw new Error(`zhihu article ${name} exceeds ${maximumBytes} UTF-8 bytes`);
  }
  return name === 'title' ? value.trim() : value;
}

function optionalArticleField(
  args: Args,
  name: 'title' | 'content',
  maximumBytes: number,
): string | undefined {
  if (!Object.prototype.hasOwnProperty.call(args, name) || args[name] == null) return undefined;
  return inlineArticleField(args[name], name, maximumBytes);
}

function articleId(value: Value): string {
  const id = pick(value, 'id');
  if (typeof id === 'number' && Number.isSafeInteger(id) && id > 0) return String(id);
  if (typeof id === 'string' && /^\d+$/.test(id)) return id;
  const data = object(pick(value, 'data'));
  const dataId = pick(data, 'id');
  if (typeof dataId === 'number' && Number.isSafeInteger(dataId) && dataId > 0) {
    return String(dataId);
  }
  return typeof dataId === 'string' && /^\d+$/.test(dataId) ? dataId : '';
}

function draftAuthor(draft: Value): Value {
  return object(pick(draft, 'author'));
}

function requireOwnedDraft(draft: Value, me: Value, id: string): void {
  const author = draftAuthor(draft);
  const owned = ['url_token', 'uid', 'id'].some(key => {
    const currentIdentity = text(pick(me, key));
    const authorIdentity = text(pick(author, key));
    return Boolean(currentIdentity && authorIdentity && currentIdentity === authorIdentity);
  });
  if (!owned) {
    throw new Error(`zhihu article ${id} is not owned by the signed-in account`);
  }
}

function articleTableOfContents(draft: Value): boolean {
  const settings = object(pick(draft, 'settings'));
  return pick(object(pick(settings, 'table_of_contents')), 'enabled') === true;
}

function draftRow(draft: Value) {
  const id = articleId(draft);
  if (!id || !Object.prototype.hasOwnProperty.call(draft, 'content')) {
    throw new Error('zhihu article draft response is malformed');
  }
  const author = draftAuthor(draft);
  return {
    id,
    title: text(pick(draft, 'title')),
    content: String(pick(draft, 'content') ?? ''),
    state: text(pick(draft, 'state')),
    author_identity: text(pick(author, 'url_token') ?? pick(author, 'uid') ?? pick(author, 'id')),
    created_at: unixTime(pick(draft, 'created')),
    updated_at: unixTime(pick(draft, 'updated')),
    url: `https://zhuanlan.zhihu.com/p/${id}`,
    editor_url: `https://zhuanlan.zhihu.com/p/${id}/edit`,
  };
}

function peopleRow(item: Value, rank: number) {
  const slug = text(pick(item, 'url_token'));
  const name = text(pick(item, 'name'));
  if (!slug || !name) throw new Error('zhihu people response is missing identity fields');
  return {
    rank,
    name,
    url_token: slug,
    headline: text(pick(item, 'headline')),
    followers: pick(item, 'follower_count') ?? 0,
    url: `https://www.zhihu.com/people/${slug}`,
  };
}

function itemUrl(item: Value): string {
  const id = text(pick(item, 'id'));
  const type = text(pick(item, 'type'));
  if (type === 'answer') {
    const questionId = text(pick(pick(item, 'question'), 'id'));
    return questionId && id ? `https://www.zhihu.com/question/${questionId}/answer/${id}` : '';
  }
  if (type === 'article') return id ? `https://zhuanlan.zhihu.com/p/${id}` : '';
  if (type === 'question') return id ? `https://www.zhihu.com/question/${id}` : '';
  return '';
}

function collectionItemRow(item: Value, rank: number) {
  const content = object(pick(item, 'content'));
  const type = text(pick(content, 'type'));
  const id = text(pick(content, 'id'));
  let title: string;
  let excerpt: string;
  let url = text(pick(content, 'url'));
  let votes: unknown;
  if (type === 'answer') {
    const question = object(pick(content, 'question'));
    title = text(pick(question, 'title'));
    excerpt = stripHtml(pick(content, 'content')).slice(0, 150);
    url ||= `https://www.zhihu.com/question/${text(pick(question, 'id'))}/answer/${id}`;
    votes = pick(content, 'voteup_count') ?? 0;
  } else if (type === 'article') {
    title = text(pick(content, 'title'));
    excerpt = stripHtml(pick(content, 'content')).slice(0, 150);
    url ||= `https://zhuanlan.zhihu.com/p/${id}`;
    votes = pick(content, 'voteup_count') ?? 0;
  } else if (type === 'pin') {
    title = '想法';
    const blocks = pick(content, 'content');
    excerpt = stripHtml(
      Array.isArray(blocks) ? blocks.map(block => text(pick(block, 'content'))).join(' ') : '',
    ).slice(0, 150);
    url ||= `https://www.zhihu.com/pin/${id}`;
    votes = pick(content, 'reaction_count') ?? 0;
  } else {
    throw new Error(`zhihu collection returned unsupported content type: ${type || 'missing'}`);
  }
  if (!title || !url || url.includes('undefined')) {
    throw new Error('zhihu collection returned a malformed item');
  }
  return {
    rank,
    type,
    title: stripHtml(title).slice(0, 100),
    author: text(pick(pick(content, 'author'), 'name')) || '匿名用户',
    votes,
    excerpt,
    url,
  };
}

export async function answerDetail(context: SiteCommandContext, args: Args) {
  const client = new ZhihuClient(context);
  const target = parseAnswerTarget(args.id);
  const maxContent = integer(args['max-content'], 0, 0, 10_000_000, 'max-content');
  const data = object(
    await client.get(
      `/api/v4/answers/${target.answerId}?include=content,voteup_count,comment_count,author,created_time,updated_time,question`,
    ),
  );
  if (!Object.prototype.hasOwnProperty.call(data, 'content')) {
    throw new Error('zhihu answer detail response has no content');
  }
  const question = object(pick(data, 'question'));
  let questionId = target.questionId;
  if (!questionId) {
    try {
      questionId =
        new URL(text(pick(question, 'url'))).pathname.match(/\/questions?\/(\d+)/)?.[1] ?? '';
    } catch {
      // Fall back to the question id field below.
    }
  }
  questionId ||= text(pick(question, 'id'));
  let content = stripHtml(pick(data, 'content'), true);
  if (maxContent > 0) content = content.slice(0, maxContent);
  return [
    {
      id: target.answerId,
      author: text(pick(pick(data, 'author'), 'name')) || 'anonymous',
      votes: pick(data, 'voteup_count') ?? 0,
      comments: pick(data, 'comment_count') ?? 0,
      question_id: questionId,
      question_title: text(pick(question, 'title')),
      url: questionId
        ? `https://www.zhihu.com/question/${questionId}/answer/${target.answerId}`
        : `https://www.zhihu.com/answer/${target.answerId}`,
      created_at: unixTime(pick(data, 'created_time')),
      updated_at: unixTime(pick(data, 'updated_time')),
      content,
    },
  ];
}

export async function answerComments(context: SiteCommandContext, args: Args) {
  const client = new ZhihuClient(context);
  const target = parseAnswerTarget(args.id);
  const limit = integer(args.limit, 20, 1, 1000, 'limit');
  const repliesLimit = integer(args['replies-limit'], 3, 0, 100, 'replies-limit');
  let questionId = target.questionId;
  if (!questionId) {
    const answer = object(await client.get(`/api/v4/answers/${target.answerId}?include=question`));
    questionId = text(pick(pick(answer, 'question'), 'id'));
  }
  const comments = await client.list(
    `https://www.zhihu.com/api/v4/answers/${target.answerId}/comments?order=normal&limit=20&offset=0&status=open`,
    Math.min(20_000, limit * Math.max(repliesLimit + 1, 2)),
    'answer comments',
  );
  const rows: Value[] = [];
  let commentRank = 0;
  let replyRank = 0;
  for (const comment of comments) {
    const replyTo = text(pick(pick(comment, 'reply_to_author'), 'name'));
    if (!replyTo) {
      if (commentRank >= limit) break;
      commentRank += 1;
      replyRank = 0;
    } else {
      if (commentRank === 0 || replyRank >= repliesLimit) continue;
      replyRank += 1;
    }
    const id = text(pick(comment, 'id'));
    if (!id) throw new Error('zhihu answer comments returned a row without an id');
    rows.push({
      rank: rows.length + 1,
      comment_rank: commentRank,
      reply_rank: replyTo ? replyRank : 0,
      depth: 0,
      id,
      parent_id: '',
      author:
        text(pick(pick(pick(comment, 'author'), 'member'), 'name')) ||
        text(pick(pick(comment, 'author'), 'name')) ||
        'anonymous',
      reply_to: replyTo,
      likes: pick(comment, 'vote_count') ?? 0,
      created_at: unixTime(pick(comment, 'created_time')),
      url:
        questionId && id
          ? `https://www.zhihu.com/question/${questionId}/answer/${target.answerId}#comment-${id}`
          : text(pick(comment, 'url')),
      content: stripHtml(pick(comment, 'content'), true),
    });
  }
  return rows;
}

export async function collection(context: SiteCommandContext, args: Args) {
  const client = new ZhihuClient(context);
  const id = numericId(args.id, 'collection id');
  const offset = integer(args.offset, 0, 0, 1_000_000_000, 'offset');
  const limit = integer(args.limit, 20, 1, 1000, 'limit');
  const items: Value[] = [];
  let nextOffset = offset;
  while (items.length < limit) {
    const pageLimit = Math.min(20, limit - items.length);
    const data = object(
      await client.get(`/api/v4/collections/${id}/items?offset=${nextOffset}&limit=${pageLimit}`),
    );
    const page = pick(data, 'data');
    if (!Array.isArray(page)) throw new Error('zhihu collection response is malformed');
    for (const item of page) items.push(object(item));
    if (page.length === 0 || pick(pick(data, 'paging'), 'is_end') === true) break;
    nextOffset += page.length;
  }
  return items.slice(0, limit).map((item, index) => collectionItemRow(item, offset + index + 1));
}

export async function collections(context: SiteCommandContext, args: Args) {
  const client = new ZhihuClient(context);
  const limit = integer(args.limit, 20, 1, 1000, 'limit');
  const me = await client.me();
  const slug = text(pick(me, 'url_token'));
  const items = await client.list(
    `https://www.zhihu.com/api/v4/people/${encodeURIComponent(slug)}/collections?include=data%5B*%5D.updated_time&offset=0&limit=20`,
    limit,
    'collections',
  );
  return items.map((item, index) => ({
    rank: index + 1,
    title: text(pick(item, 'title')) || '未命名',
    item_count: pick(item, 'item_count') ?? pick(item, 'answer_count') ?? 0,
    description: text(pick(item, 'description')),
    collection_id: text(pick(item, 'id')),
  }));
}

export async function followers(context: SiteCommandContext, args: Args) {
  const client = new ZhihuClient(context);
  const slug = userSlug(args.user);
  const limit = integer(args.limit, 20, 1, 1000, 'limit');
  const include = encodeURIComponent('data[*].follower_count,headline,answer_count,articles_count');
  const items = await client.list(
    `https://www.zhihu.com/api/v4/members/${encodeURIComponent(slug)}/followers?limit=20&offset=0&include=${include}`,
    limit,
    'followers',
  );
  return items.map((item, index) => peopleRow(item, index + 1));
}

export async function following(context: SiteCommandContext, args: Args) {
  const client = new ZhihuClient(context);
  const slug = userSlug(args.user);
  const limit = integer(args.limit, 20, 1, 1000, 'limit');
  const include = encodeURIComponent('data[*].follower_count,headline,answer_count,articles_count');
  const items = await client.list(
    `https://www.zhihu.com/api/v4/members/${encodeURIComponent(slug)}/followees?limit=20&offset=0&include=${include}`,
    limit,
    'following',
  );
  return items.map((item, index) => peopleRow(item, index + 1));
}

export async function hot(context: SiteCommandContext, args: Args) {
  const client = new ZhihuClient(context);
  const limit = integer(args.limit, 20, 1, 50, 'limit');
  const data = object(await client.get('/api/v3/feed/topstory/hot-lists/total?limit=50'));
  const items = pick(data, 'data');
  if (!Array.isArray(items)) throw new Error('zhihu hot response is malformed');
  return items.slice(0, limit).map((raw, index) => {
    const item = object(raw);
    const target = object(pick(item, 'target'));
    return {
      rank: index + 1,
      title: text(pick(target, 'title')),
      heat: text(pick(item, 'detail_text')),
      answers: pick(target, 'answer_count') ?? 0,
    };
  });
}

export async function pins(context: SiteCommandContext, args: Args) {
  const client = new ZhihuClient(context);
  const slug = userSlug(args.user);
  const limit = integer(args.limit, 20, 1, 1000, 'limit');
  const items = await client.list(
    `https://www.zhihu.com/api/v4/members/${encodeURIComponent(slug)}/pins?limit=20&offset=0`,
    limit,
    'pins',
  );
  return items.map((item, index) => {
    const blocks = pick(item, 'content');
    const first = Array.isArray(blocks) ? object(blocks[0]) : {};
    const id = text(pick(item, 'id'));
    if (!id) throw new Error('zhihu pins response is missing an id');
    return {
      rank: index + 1,
      excerpt: text(pick(item, 'excerpt_title')),
      type: text(pick(first, 'type')),
      likes: pick(item, 'like_count') ?? pick(item, 'reaction_count') ?? 0,
      comments: pick(item, 'comment_count') ?? 0,
      reposts: pick(item, 'repin_count') ?? 0,
      created: pick(item, 'created') ?? pick(item, 'updated') ?? 0,
      url: `https://www.zhihu.com/pin/${id}`,
    };
  });
}

export async function question(context: SiteCommandContext, args: Args) {
  const client = new ZhihuClient(context);
  const questionId = numericId(args.id, 'question id');
  const limit = integer(args.limit, 5, 1, 1000, 'limit');
  const sort = text(args.sort) || 'default';
  if (!['default', 'created'].includes(sort)) {
    throw new Error('zhihu --sort must be default or created');
  }
  const include = 'data[*].content,url,voteup_count,comment_count,author';
  const items = await client.list(
    `https://www.zhihu.com/api/v4/questions/${questionId}/answers?limit=20&offset=0&sort_by=${sort}&include=${encodeURIComponent(include)}`,
    limit,
    'question answers',
  );
  const seen = new Set<string>();
  const rows: Value[] = [];
  for (const item of items) {
    const id = answerIdFrom(item);
    const key = id || `${text(pick(pick(item, 'author'), 'name'))}:${text(pick(item, 'content'))}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({
      rank: rows.length + 1,
      id,
      author: text(pick(pick(item, 'author'), 'name')) || 'anonymous',
      votes: pick(item, 'voteup_count') ?? 0,
      url: id ? `https://www.zhihu.com/question/${questionId}/answer/${id}` : '',
      content: stripHtml(pick(item, 'content')).slice(0, 200),
    });
  }
  return rows;
}

export async function recommend(context: SiteCommandContext, args: Args) {
  const client = new ZhihuClient(context);
  const limit = integer(args.limit, 20, 1, 1000, 'limit');
  const items = await client.list(
    'https://www.zhihu.com/api/v3/feed/topstory/recommend?limit=10&desktop=true',
    limit,
    'recommendations',
  );
  const seen = new Set<string>();
  const rows: Value[] = [];
  for (const item of items) {
    const target = object(pick(item, 'target'));
    const key = `${text(pick(target, 'type'))}:${text(pick(target, 'id')) || text(pick(item, 'id'))}`;
    if (key !== ':' && seen.has(key)) continue;
    if (key !== ':') seen.add(key);
    const type = text(pick(target, 'type')) || text(pick(item, 'type'));
    rows.push({
      rank: rows.length + 1,
      type,
      title:
        type === 'answer'
          ? text(pick(pick(target, 'question'), 'title'))
          : text(pick(target, 'title')) || text(pick(pick(target, 'question'), 'title')),
      author: text(pick(pick(target, 'author'), 'name')),
      votes:
        pick(target, 'voteup_count') ??
        pick(pick(pick(target, 'reaction'), 'statistics'), 'like_count') ??
        0,
      url: itemUrl(target),
    });
  }
  return rows;
}

export async function search(context: SiteCommandContext, args: Args) {
  const client = new ZhihuClient(context);
  const query = required(args.query, 'query');
  const limit = integer(args.limit, 10, 1, 1000, 'limit');
  const resultType = text(args.type) || 'all';
  if (!['all', 'answer', 'article', 'question'].includes(resultType)) {
    throw new Error('zhihu --type must be all, answer, article, or question');
  }
  const fetched = await client.list(
    `https://www.zhihu.com/api/v4/search_v3?q=${encodeURIComponent(query)}&t=general&offset=0&limit=20`,
    Math.min(1000, resultType === 'all' ? limit : limit * 5),
    'search',
  );
  const seen = new Set<string>();
  const rows: Value[] = [];
  for (const item of fetched) {
    if (text(pick(item, 'type')) !== 'search_result') continue;
    const result = object(pick(item, 'object'));
    const type = text(pick(result, 'type'));
    if (!['answer', 'article', 'question'].includes(type)) continue;
    if (resultType !== 'all' && type !== resultType) continue;
    const url = itemUrl(result);
    const key = `${type}:${text(pick(result, 'id')) || url}`;
    if (!url || seen.has(key)) continue;
    seen.add(key);
    const questionData = object(pick(result, 'question'));
    const title = stripHtml(
      pick(result, 'title') ?? pick(questionData, 'name') ?? pick(questionData, 'title'),
    );
    if (!title) continue;
    rows.push({
      rank: rows.length + 1,
      title,
      type,
      author: text(pick(pick(result, 'author'), 'name')),
      votes: pick(result, 'voteup_count') ?? 0,
      url,
    });
    if (rows.length >= limit) break;
  }
  return rows;
}

export async function user(context: SiteCommandContext, args: Args) {
  const client = new ZhihuClient(context);
  const slug = userSlug(args.user);
  const include = encodeURIComponent(
    'follower_count,following_count,answer_count,articles_count,question_count,voteup_count,thanked_count,favorited_count,headline,gender',
  );
  const data = object(
    await client.get(`/api/v4/members/${encodeURIComponent(slug)}?include=${include}`),
  );
  const urlToken = text(pick(data, 'url_token'));
  if (!urlToken || !text(pick(data, 'name'))) {
    throw new Error('zhihu user response is missing identity fields');
  }
  return [
    {
      url_token: urlToken,
      name: text(pick(data, 'name')),
      headline: text(pick(data, 'headline')),
      followers: pick(data, 'follower_count') ?? 0,
      following: pick(data, 'following_count') ?? 0,
      answers: pick(data, 'answer_count') ?? 0,
      articles: pick(data, 'articles_count') ?? 0,
      voteup: pick(data, 'voteup_count') ?? 0,
      url: `https://www.zhihu.com/people/${urlToken}`,
    },
  ];
}

export async function userAnswers(context: SiteCommandContext, args: Args) {
  const client = new ZhihuClient(context);
  const slug = userSlug(args.user);
  const limit = integer(args.limit, 20, 1, 1000, 'limit');
  const include = encodeURIComponent('data[*].voteup_count,comment_count,created_time,question');
  const items = await client.list(
    `https://www.zhihu.com/api/v4/members/${encodeURIComponent(slug)}/answers?limit=20&offset=0&include=${include}`,
    limit,
    'user answers',
  );
  return items.map((item, index) => {
    const answerId = answerIdFrom(item);
    const questionData = object(pick(item, 'question'));
    const questionId = text(pick(questionData, 'id'));
    return {
      rank: index + 1,
      question: text(pick(questionData, 'title')),
      votes:
        pick(item, 'voteup_count') ??
        pick(pick(pick(item, 'reaction'), 'statistics'), 'like_count') ??
        0,
      comments: pick(item, 'comment_count') ?? 0,
      created: pick(item, 'created_time') ?? pick(item, 'created') ?? 0,
      url:
        questionId && answerId
          ? `https://www.zhihu.com/question/${questionId}/answer/${answerId}`
          : text(pick(item, 'url')),
    };
  });
}

export async function userArticles(context: SiteCommandContext, args: Args) {
  const client = new ZhihuClient(context);
  const slug = userSlug(args.user);
  const limit = integer(args.limit, 20, 1, 1000, 'limit');
  const include = encodeURIComponent('data[*].voteup_count,comment_count');
  const items = await client.list(
    `https://www.zhihu.com/api/v4/members/${encodeURIComponent(slug)}/articles?limit=20&offset=0&include=${include}`,
    limit,
    'user articles',
  );
  return items.map((item, index) => {
    const id = text(pick(item, 'id'));
    return {
      rank: index + 1,
      title: text(pick(item, 'title')),
      votes: pick(item, 'voteup_count') ?? 0,
      comments: pick(item, 'comment_count') ?? 0,
      created: pick(item, 'created') ?? pick(item, 'updated') ?? 0,
      url: id ? `https://zhuanlan.zhihu.com/p/${id}` : '',
    };
  });
}

export async function whoami(context: SiteCommandContext) {
  const data = await new ZhihuClient(context).me();
  return [
    {
      logged_in: true,
      site: 'zhihu',
      url_token: text(pick(data, 'url_token')),
      name: text(pick(data, 'name')),
      uid: text(pick(data, 'uid') ?? pick(data, 'id')),
    },
  ];
}

export async function articleDraft(context: SiteCommandContext, args: Args) {
  const target = requireKind(parseTarget(required(args.target, 'target')), 'article-draft', [
    'article',
  ]);
  const client = new ZhihuClient(context);
  const [me, draft] = await Promise.all([client.me(), client.articleDraft(target.id)]);
  if (!draft) throw new Error(`zhihu article draft not found: ${target.id}`);
  requireOwnedDraft(draft, me, target.id);
  return [draftRow(draft)];
}

export async function articleCreate(context: SiteCommandContext, args: Args) {
  requireExecute(args);
  const title = inlineArticleField(args.title, 'title', ARTICLE_TITLE_MAX_BYTES);
  const content = inlineArticleField(args.content, 'content', ARTICLE_CONTENT_MAX_BYTES);
  const client = new ZhihuClient(context);
  const me = await client.me();
  const created = await client.createArticleDraft({
    title,
    content,
    delta_time: 1,
    table_of_contents: false,
  });
  const id = articleId(created);
  if (!id) throw new Error('zhihu draft creation response did not include an article id');
  const draft = await client.articleDraft(id);
  if (!draft) throw new Error(`zhihu created draft ${id} could not be read back`);
  requireOwnedDraft(draft, me, id);
  if (text(pick(draft, 'title')) !== title || String(pick(draft, 'content') ?? '') !== content) {
    throw new Error(`zhihu created draft ${id} did not match the requested fields`);
  }
  return [
    {
      status: 'success',
      outcome: 'created',
      message: `Created private article draft ${id}`,
      ...draftRow(draft),
    },
  ];
}

export async function articleUpdate(context: SiteCommandContext, args: Args) {
  requireExecute(args);
  const target = requireKind(parseTarget(required(args.target, 'target')), 'article-update', [
    'article',
  ]);
  const title = optionalArticleField(args, 'title', ARTICLE_TITLE_MAX_BYTES);
  const content = optionalArticleField(args, 'content', ARTICLE_CONTENT_MAX_BYTES);
  if (title === undefined && content === undefined) {
    throw new Error('zhihu article-update requires --title or --content');
  }
  const client = new ZhihuClient(context);
  const [me, current] = await Promise.all([client.me(), client.articleDraft(target.id)]);
  if (!current) throw new Error(`zhihu article draft not found: ${target.id}`);
  requireOwnedDraft(current, me, target.id);
  const nextTitle =
    title ?? inlineArticleField(pick(current, 'title'), 'title', ARTICLE_TITLE_MAX_BYTES);
  const nextContent =
    content ?? inlineArticleField(pick(current, 'content'), 'content', ARTICLE_CONTENT_MAX_BYTES);
  const canReward = pick(current, 'can_reward');
  await client.updateArticleDraft(target.id, {
    title: nextTitle,
    content: nextContent,
    delta_time: 1,
    table_of_contents: articleTableOfContents(current),
    ...(typeof canReward === 'boolean' ? { can_reward: canReward } : {}),
  });
  const updated = await client.articleDraft(target.id);
  if (!updated) throw new Error(`zhihu updated draft ${target.id} could not be read back`);
  requireOwnedDraft(updated, me, target.id);
  if (
    text(pick(updated, 'title')) !== nextTitle ||
    String(pick(updated, 'content') ?? '') !== nextContent
  ) {
    throw new Error(`zhihu updated draft ${target.id} did not match the requested fields`);
  }
  return [
    {
      status: 'success',
      outcome: 'applied',
      message: `Updated article draft ${target.id}`,
      ...draftRow(updated),
    },
  ];
}

export async function articleDelete(context: SiteCommandContext, args: Args) {
  requireExecute(args);
  const target = requireKind(parseTarget(required(args.target, 'target')), 'article-delete', [
    'article',
  ]);
  const client = new ZhihuClient(context);
  const [me, draft] = await Promise.all([client.me(), client.articleDraft(target.id)]);
  if (!draft) throw new Error(`zhihu article draft not found: ${target.id}`);
  requireOwnedDraft(draft, me, target.id);
  const state = text(pick(draft, 'state'));
  if (state !== 'draft') {
    throw new Error(
      `zhihu article-delete only supports private drafts; article ${target.id} is ${state || 'unknown'}`,
    );
  }
  await client.deleteArticleDraft(target.id);
  if (await client.articleDraft(target.id)) {
    throw new Error(`zhihu deleted draft ${target.id} is still readable`);
  }
  return [
    {
      status: 'success',
      outcome: 'applied',
      message: `Deleted private article draft ${target.id}`,
      id: target.id,
    },
  ];
}

export async function answer(context: SiteCommandContext, args: Args) {
  requireExecute(args);
  const rawTarget = required(args.target, 'target');
  const target = requireKind(parseTarget(rawTarget), 'answer', ['question']);
  const client = new ZhihuClient(context);
  const author = await client.me();
  const result = object(
    await client.post(`/api/v4/questions/${target.id}/answers`, {
      content: payload(args),
      reshipment_settings: 'disallowed',
    }),
  );
  const id = text(pick(result, 'id'));
  if (!id) throw new Error('zhihu answer response did not include a created answer id');
  return writeRow(`Answered question ${target.id}`, target.kind, rawTarget, 'created', {
    created_target: `answer:${target.id}:${id}`,
    created_url:
      text(pick(result, 'url')) || `https://www.zhihu.com/question/${target.id}/answer/${id}`,
    author_identity: text(pick(author, 'url_token')),
  });
}

export async function comment(context: SiteCommandContext, args: Args) {
  requireExecute(args);
  const rawTarget = required(args.target, 'target');
  const target = requireKind(parseTarget(rawTarget), 'comment', ['answer', 'article']);
  const client = new ZhihuClient(context);
  const author = await client.me();
  const resource = target.kind === 'answer' ? 'answers' : 'articles';
  const result = object(
    await client.post(`/api/v4/${resource}/${target.id}/comments`, { content: payload(args) }),
  );
  if (!text(pick(result, 'id'))) {
    throw new Error('zhihu comment response did not include a created comment id');
  }
  return writeRow(`Commented on ${target.kind} ${target.id}`, target.kind, rawTarget, 'created', {
    author_identity: text(pick(author, 'url_token')),
    created_url: text(pick(result, 'url')),
  });
}

function normalizedCollectionName(value: unknown): string {
  return text(value)
    .replace(/\s+/g, ' ')
    .replace(/\s+\d+\s*(条内容|个内容|items?)$/i, '')
    .replace(/\s+(公开|私密|默认)$/i, '')
    .trim()
    .toLowerCase();
}

export async function favorite(context: SiteCommandContext, args: Args) {
  requireExecute(args);
  const rawTarget = required(args.target, 'target');
  const target = requireKind(parseTarget(rawTarget), 'favorite', ['answer', 'article']);
  const collectionName = text(args.collection);
  let collectionId = text(args['collection-id']);
  if (Number(Boolean(collectionName)) + Number(Boolean(collectionId)) !== 1) {
    throw new Error('zhihu favorite requires exactly one of --collection or --collection-id');
  }
  const client = new ZhihuClient(context);
  if (!collectionId) {
    const data = object(await client.get('/api/v4/people/self/collections?limit=50'));
    const rawItems = pick(data, 'data');
    const items = Array.isArray(rawItems) ? rawItems.map(object) : [];
    const matches = items.filter(
      item =>
        normalizedCollectionName(pick(item, 'title')) === normalizedCollectionName(collectionName),
    );
    if (matches.length === 0) throw new Error(`zhihu collection not found: ${collectionName}`);
    if (matches.length > 1)
      throw new Error(`zhihu collection name is ambiguous: ${collectionName}`);
    collectionId = text(pick(matches[0], 'id'));
  }
  if (!/^\d+$/.test(collectionId)) throw new Error('zhihu collection id must be numeric');
  await client.post(`/api/v4/favlists/${collectionId}/items`, {
    item_id: target.id,
    item_type: target.kind,
  });
  return writeRow(`Favorited ${target.kind} ${target.id}`, target.kind, rawTarget, 'applied', {
    collection_name: collectionName,
    collection_id: collectionId,
  });
}

export async function follow(context: SiteCommandContext, args: Args) {
  requireExecute(args);
  const rawTarget = required(args.target, 'target');
  const target = requireKind(parseTarget(rawTarget), 'follow', ['user', 'question']);
  const client = new ZhihuClient(context);
  const id = target.kind === 'user' ? target.slug : target.id;
  const path =
    target.kind === 'user'
      ? `/api/v4/members/${encodeURIComponent(id)}/followers`
      : `/api/v4/questions/${id}/followers`;
  await client.post(path);
  return writeRow(`Followed ${target.kind} ${id}`, target.kind, rawTarget, 'applied');
}

export async function like(context: SiteCommandContext, args: Args) {
  requireExecute(args);
  const rawTarget = required(args.target, 'target');
  const target = requireKind(parseTarget(rawTarget), 'like', ['answer', 'article']);
  const resource = target.kind === 'answer' ? 'answers' : 'articles';
  const result = object(
    await new ZhihuClient(context).post(`/api/v4/${resource}/${target.id}/voters`, {
      type: 'up',
    }),
  );
  if (pick(result, 'success') === false) throw new Error('zhihu like API reported success=false');
  return writeRow(`Liked ${target.kind} ${target.id}`, target.kind, rawTarget, 'applied');
}

function articleMarkdown(html: string): { markdown: string; images: string[] } {
  const images: string[] = [];
  let result = html
    .replace(
      /<img\b[^>]*(?:data-original|data-actualsrc|src)=["']([^"']+)["'][^>]*>/gi,
      (_, src: string) => {
        if (!src.startsWith('data:image')) images.push(src);
        return src.startsWith('data:image') ? '' : `\n![](${src})\n`;
      },
    )
    .replace(
      /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,
      (_, href: string, label: string) => `[${stripHtml(label)}](${href})`,
    )
    .replace(
      /<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi,
      (_, level: string, body: string) => `\n${'#'.repeat(Number(level))} ${stripHtml(body)}\n`,
    )
    .replace(
      /<blockquote\b[^>]*>([\s\S]*?)<\/blockquote>/gi,
      (_, body: string) => `\n> ${stripHtml(body, true).replace(/\n/g, '\n> ')}\n`,
    )
    .replace(/<li\b[^>]*>([\s\S]*?)<\/li>/gi, (_, body: string) => `\n- ${stripHtml(body)}`)
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<\/(p|div|pre)>/gi, '\n\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#x27;|&#39;/gi, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (result) result += '\n';
  return { markdown: result, images: [...new Set(images)] };
}

export async function download(context: SiteCommandContext, args: Args) {
  if (args['download-images'] === true || text(args['download-images']).toLowerCase() === 'true') {
    throw new Error(
      'zhihu image batch download is unavailable; use the returned image_urls instead',
    );
  }
  const target = requireKind(parseTarget(required(args.url, 'url')), 'download', ['article']);
  const data = object(
    await new ZhihuClient(context).get(
      `/api/v4/articles/${target.id}?include=content,title,author,created,updated`,
    ),
  );
  const converted = articleMarkdown(String(pick(data, 'content') ?? ''));
  const title = text(pick(data, 'title')) || 'untitled';
  const author = text(pick(pick(data, 'author'), 'name'));
  const header = [
    `# ${title}`,
    '',
    ...(author ? [`- Author: ${author}`] : []),
    `- Source: ${target.url}`,
    '',
  ].join('\n');
  const markdown = `${header}${converted.markdown}`;
  return [
    {
      title,
      author,
      publish_time: unixTime(pick(data, 'created')),
      status: 'inline',
      size: new TextEncoder().encode(markdown).byteLength,
      markdown,
      image_urls: converted.images,
    },
  ];
}
