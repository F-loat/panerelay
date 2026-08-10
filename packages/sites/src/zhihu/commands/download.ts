import { defineCommand } from '@panerelay/site-kit';
import { download } from '../operations.js';

export default defineCommand({
  name: 'download',
  description: 'Export a Zhihu article as inline Markdown.',
  access: 'read',
  args: [
    { name: 'url', description: 'Zhihu article URL.', type: 'string', required: true },
    {
      name: 'output',
      description: 'Compatibility placeholder; content is returned inline.',
      type: 'string',
      default: './zhihu-articles',
    },
    {
      name: 'download-images',
      description: 'Image binary download is unsupported; image URLs are returned.',
      type: 'boolean',
      default: false,
    },
  ],
  output: ['title', 'author', 'publish_time', 'status', 'size', 'markdown', 'image_urls'],
  examples: ['panerelay zhihu download --url https://zhuanlan.zhihu.com/p/123456'],
  async run(context, args) {
    return download(context, args);
  },
});
