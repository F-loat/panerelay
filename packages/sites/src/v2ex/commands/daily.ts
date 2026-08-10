import { defineCommand } from '@panerelay/site-kit';
import { accountFromHtml, htmlText, V2exClient } from '../client.js';

export default defineCommand({
  name: 'daily',
  description: 'Claim the logged-in V2EX daily reward.',
  access: 'write',
  args: [],
  output: ['status', 'message'],
  examples: ['panerelay v2ex daily'],
  async run(context) {
    const client = new V2exClient(context);
    const page = await client.html('/mission/daily');
    const button = [...page.matchAll(/<input\b[^>]*>/gi)].find(tag =>
      /value=["'][^"']*领取[^"']*["']/i.test(tag[0]),
    )?.[0];
    if (!button) return [{ status: '✅ 已签到', message: '今日奖励已发/无需领取' }];
    const once = button.match(/once=(\d+)/)?.[1];
    if (!once)
      throw new Error(`v2ex daily could not extract the once token from ${htmlText(button)}`);
    const result = await client.html(`/mission/daily/redeem?once=${once}`);
    if (
      [...result.matchAll(/<input\b[^>]*>/gi)].some(tag =>
        /value=["'][^"']*领取[^"']*["']/i.test(tag[0]),
      )
    ) {
      return [{ status: '❌ 签到失败', message: '未能确认签到结果，请手动检查' }];
    }
    let balance = '未知';
    try {
      balance = accountFromHtml(result).balance || balance;
    } catch {
      // A successful claim can be reported even if the balance widget changed.
    }
    return [{ status: '🎉 签到成功', message: `当前余额: ${balance}` }];
  },
});
