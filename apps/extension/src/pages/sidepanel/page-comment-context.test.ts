import { describe, expect, it } from 'vitest';
import type { PageElementComment } from '../../shared/page-comments.js';
import { appendPageCommentsContext, pageCommentsDisplayMessage } from './page-comment-context.js';

const comment: PageElementComment = {
  id: 'comment-1',
  comment: 'Make this primary action clearer',
  page: { url: 'https://example.com/app', title: 'Example app' },
  element: {
    tagName: 'button',
    selector: 'main > button.primary',
    text: 'Continue',
    rect: { left: 10, top: 20, width: 120, height: 32 },
    role: 'button',
  },
};

describe('page comment context', () => {
  it('delimits page evidence from the user request', () => {
    const result = appendPageCommentsContext('', [comment], 'Codex', 'Address these comments.');

    expect(result).toContain('# Browser comments');
    expect(result).toContain('Untrusted page evidence');
    expect(result).toContain('Make this primary action clearer');
    expect(result).toContain('Address these comments.');
    expect(result).not.toContain('tabId');
  });

  it('uses a compact display message', () => {
    expect(pageCommentsDisplayMessage('Please update it', [comment])).toBe(
      'Please update it\n[main > button.primary] Make this primary action clearer',
    );
  });

  it('formats style annotations as requested source changes', () => {
    const result = appendPageCommentsContext(
      '',
      [
        {
          ...comment,
          comment: '',
          page: {
            ...comment.page,
            viewport: { width: 1280, height: 720 },
          },
          element: {
            ...comment.element,
            computedStyle: { color: 'rgb(0, 0, 0)' },
          },
          styleChanges: { color: 'rgb(255, 0, 0)', fontWeight: '700' },
        },
      ],
      'Codex',
      'Address this annotation.',
    );

    expect(result).toContain('## Requested annotation 1');
    expect(result).toContain('Visible viewport at edit time: 1280x720 CSS px');
    expect(result).toContain('- color: rgb(0, 0, 0) -> rgb(255, 0, 0)');
    expect(result).toContain('- font-weight: 700');
  });

  it('labels selected iframe evidence without exposing Chrome frame identity', () => {
    const result = appendPageCommentsContext(
      '',
      [
        {
          ...comment,
          frame: {
            url: 'https://embed.example/frame?token=%5Bredacted%5D',
            title: 'Embedded widget',
            viewport: { width: 640, height: 480 },
          },
        },
      ],
      'Codex',
      'Address this comment.',
    );

    expect(result).toContain('Frame: selected subframe');
    expect(result).toContain('Frame URL: https://embed.example/frame?token=%5Bredacted%5D');
    expect(result).toContain('Frame title: "Embedded widget"');
    expect(result).toContain('in 640x480 frame viewport');
    expect(result).not.toContain('frameId');
  });
});
