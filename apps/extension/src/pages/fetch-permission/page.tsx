import { normalizeBrowserFetchDomain } from '@panerelay/protocol';
import { Globe2, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { fetchPermissionPatterns } from '../../shared/fetch-permissions.js';

const copy = {
  en: {
    title: 'Allow browser fetch?',
    description: 'An Agent is asking Panerelay to send browser-backed requests to:',
    warning:
      'This can use cookies from your current browser profile. Only allow domains you trust.',
    deny: 'Deny',
    allowDomain: 'Allow this domain',
    requesting: 'Waiting for browser permission…',
    browserDenied: 'Chrome did not grant site access. Choose an option to try again.',
    invalid: 'Invalid or expired authorization request.',
  },
  'zh-CN': {
    title: '允许浏览器 Fetch？',
    description: 'Agent 正在申请让 Panerelay 向以下域名发送浏览器请求：',
    warning: '请求可能使用当前浏览器配置中的 Cookie，请仅授权你信任的域名。',
    deny: '拒绝',
    allowDomain: '允许此域名',
    requesting: '正在等待浏览器授权…',
    browserDenied: 'Chrome 未授予站点访问权限，请选择授权范围后重试。',
    invalid: '授权申请无效或已过期。',
  },
} as const;

function params(): { domain: string; requestId: string } | null {
  const query = new URLSearchParams(window.location.search);
  const requested = query.get('domain') ?? '';
  const domain = normalizeBrowserFetchDomain(requested);
  const requestId = query.get('requestId') ?? '';
  if (!domain || domain !== requested || !requestId || requestId.length > 128) return null;
  return { domain, requestId };
}

export function FetchPermissionPage() {
  const request = params();
  const language = navigator.language.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en';
  const t = copy[language];
  const [status, setStatus] = useState<'idle' | 'requesting' | 'browser-denied'>('idle');

  if (!request) return <main className="permission-invalid">{t.invalid}</main>;

  const decide = async (granted: boolean) => {
    await chrome.runtime
      .sendMessage({
        type: 'panerelay.fetch-permission.decision',
        requestId: request.requestId,
        granted,
        ...(granted ? { scope: 'domain' } : {}),
      })
      .catch(() => undefined);
    window.close();
  };

  const allow = async () => {
    setStatus('requesting');
    try {
      const granted = await chrome.permissions.request({
        origins: fetchPermissionPatterns('domain', request.domain),
      });
      if (!granted) {
        setStatus('browser-denied');
        return;
      }
      await decide(true);
    } catch {
      setStatus('browser-denied');
    }
  };

  return (
    <main className="permission-shell">
      <section className="permission-content">
        <header>
          <ShieldCheck aria-hidden="true" />
          <h1>{t.title}</h1>
        </header>
        <p>{t.description}</p>
        <div className="permission-domain">
          <Globe2 aria-hidden="true" />
          <strong>{request.domain}</strong>
        </div>
        <p className="permission-warning">{t.warning}</p>
        {status !== 'idle' && (
          <p className={status === 'browser-denied' ? 'permission-error' : 'permission-status'}>
            {status === 'browser-denied' ? t.browserDenied : t.requesting}
          </p>
        )}
        <div className="permission-actions">
          <button
            disabled={status === 'requesting'}
            onClick={() => void decide(false)}
            type="button"
          >
            {t.deny}
          </button>
          <button
            disabled={status === 'requesting'}
            className="primary"
            onClick={() => void allow()}
            type="button"
          >
            {t.allowDomain}
          </button>
        </div>
      </section>
    </main>
  );
}
