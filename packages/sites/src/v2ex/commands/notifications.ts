import { defineCommand } from '@panerelay/site-kit';
import { htmlText, limit, V2exClient } from '../client.js';

export default defineCommand({
  name: 'notifications',
  description: 'List notifications for the logged-in V2EX account.',
  access: 'read',
  args: [{ name: 'limit', description: 'Maximum notifications.', type: 'number', default: 20 }],
  output: ['type', 'content', 'time'],
  examples: ['panerelay v2ex notifications --limit 20'],
  async run(context, args) {
    const html = await new V2exClient(context).html('/notifications');
    const chunks = [
      ...html.matchAll(
        /<div[^>]+class=["'][^"']*cell[^"']*["'][^>]+id=["']n_[^"']+["'][^>]*>([\s\S]*?)(?=<div[^>]+class=["'][^"']*cell|<div[^>]+class=["'][^"']*inner|<\/div>\s*<\/div>)/gi,
      ),
    ];
    return chunks.slice(0, limit(args.limit, 20, 100)).map(match => {
      const chunk = match[1] ?? '';
      const all = htmlText(chunk);
      const time = htmlText(
        chunk.match(/<[^>]+class=["'][^"']*snow[^"']*["'][^>]*>([\s\S]*?)<\//i)?.[1],
      );
      const payload = htmlText(
        chunk.match(/<[^>]+class=["'][^"']*payload[^"']*["'][^>]*>([\s\S]*?)<\//i)?.[1],
      );
      const type = all.includes('回复了你')
        ? '回复'
        : all.includes('感谢了你')
          ? '感谢'
          : all.includes('收藏了你')
            ? '收藏'
            : all.includes('提及你')
              ? '提及'
              : '通知';
      return { type, content: payload || (time ? all.replace(time, '').trim() : all), time };
    });
  },
});
