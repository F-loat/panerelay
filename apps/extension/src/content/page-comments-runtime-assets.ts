export const PAGE_COMMENT_STYLE_PROPERTIES = [
  'color',
  'backgroundColor',
  'opacity',
  'fontFamily',
  'fontSize',
  'fontWeight',
  'lineHeight',
  'letterSpacing',
  'textAlign',
  'borderRadius',
  'borderColor',
  'borderWidth',
  'width',
  'height',
  'padding',
  'margin',
] as const;

export type PageCommentStyleProperty = (typeof PAGE_COMMENT_STYLE_PROPERTIES)[number];
export type PageCommentChangeProperty = PageCommentStyleProperty | 'textContent';

interface PageCommentRuntimeLabels {
  properties: Readonly<Record<PageCommentChangeProperty, string>>;
  ui: Readonly<{
    add: string;
    cancel: string;
    edit: string;
    move: string;
    placeholder: string;
    save: string;
    style: string;
    touchHint: string;
  }>;
}

export interface PageCommentRuntimeAssets {
  editorCss: string;
  icons: Readonly<{
    confirm: string;
    edit: string;
    settings: string;
  }>;
  locales: Readonly<{
    en: PageCommentRuntimeLabels;
    'zh-CN': PageCommentRuntimeLabels;
  }>;
  styleProperties: readonly PageCommentStyleProperty[];
}

export const PAGE_COMMENT_RUNTIME_ASSETS = {
  styleProperties: PAGE_COMMENT_STYLE_PROPERTIES,
  locales: {
    en: {
      properties: {
        textContent: 'Text content',
        color: 'Color',
        backgroundColor: 'Background',
        opacity: 'Opacity',
        fontFamily: 'Font',
        fontSize: 'Font size',
        fontWeight: 'Weight',
        lineHeight: 'Line height',
        letterSpacing: 'Letter spacing',
        textAlign: 'Text align',
        margin: 'Margin',
        padding: 'Padding',
        borderRadius: 'Radius',
        borderColor: 'Border color',
        borderWidth: 'Border width',
        width: 'Width',
        height: 'Height',
      },
      ui: {
        add: 'Add comment',
        cancel: 'Cancel',
        edit: 'Edit page comment',
        move: 'Move annotation panel',
        placeholder: 'Describe what should change…',
        save: 'Save comment',
        style: 'Style changes',
        touchHint: 'Drag to highlight · Release to select',
      },
    },
    'zh-CN': {
      properties: {
        textContent: '文本内容',
        color: '文字颜色',
        backgroundColor: '背景颜色',
        opacity: '透明度',
        fontFamily: '字体',
        fontSize: '字号',
        fontWeight: '字重',
        lineHeight: '行高',
        letterSpacing: '字间距',
        textAlign: '对齐方式',
        margin: '外边距',
        padding: '内边距',
        borderRadius: '圆角',
        borderColor: '边框颜色',
        borderWidth: '边框宽度',
        width: '宽度',
        height: '高度',
      },
      ui: {
        add: '添加评论',
        cancel: '取消',
        edit: '编辑页面评论',
        move: '移动批注面板',
        placeholder: '描述希望如何修改…',
        save: '保存评论',
        style: '样式修改',
        touchHint: '拖动高亮元素 · 松手确认选取',
      },
    },
  },
  icons: {
    edit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/></svg>',
    settings:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 21v-7"/><path d="M4 10V3"/><path d="M12 21v-9"/><path d="M12 8V3"/><path d="M20 21v-5"/><path d="M20 12V3"/><path d="M1 14h6"/><path d="M9 8h6"/><path d="M17 16h6"/></svg>',
    confirm: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>',
  },
  editorCss: `
    *,*::before,*::after{box-sizing:border-box}
    .anchor{position:fixed;pointer-events:none;border:2px solid var(--accent);border-radius:4px;
      background:var(--accent-soft);transition:top 120ms ease,left 120ms ease,
      width 120ms ease,height 120ms ease}
    .card{position:fixed;display:flex;width:316px;max-width:calc(100vw - 16px);
      max-height:calc(100vh - 16px);max-height:calc(100dvh - 16px);
      flex-direction:column;overflow:hidden;border:1px solid var(--border);border-radius:24px;
      background:var(--bg);color:var(--text);box-shadow:var(--shadow);
      pointer-events:auto;font:12px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
      transition:border-radius 120ms ease,left 120ms ease,top 120ms ease}
    .card[data-expanded=true]{border-radius:14px}
    .composer{display:flex;min-height:48px;align-items:center;gap:5px;padding:7px 8px}
    button{font:inherit}
    .icon{display:grid;width:34px;height:34px;flex:none;place-items:center;border:0;
      border-radius:50%;background:transparent;color:var(--muted);cursor:pointer;outline:0}
    .icon:hover,.icon:focus-visible{background:var(--hover);color:var(--text)}
    .settings[aria-expanded=true]{background:var(--accent-soft);color:var(--accent)}
    svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.8;
      stroke-linecap:round;stroke-linejoin:round}
    textarea{display:block;flex:1;width:100%;min-width:0;height:28px;min-height:28px;
      max-height:76px;overflow:hidden;resize:none;border:0;outline:0;padding:4px 0;
      background:transparent;color:var(--text);font:13px/20px inherit;scrollbar-width:none}
    textarea::placeholder{color:var(--muted);opacity:.72}
    .confirm{background:var(--accent);color:var(--accent-contrast)}
    .confirm svg{stroke-width:2}
    .confirm:hover,.confirm:focus-visible{background:var(--accent-hover);
      color:var(--accent-contrast)}
    .confirm:disabled{background:var(--hover);color:var(--muted);opacity:.5;cursor:default}
    .expanded{display:none;min-height:0;flex-direction:column}
    .card[data-expanded=true] .expanded{display:flex}
    .card[data-expanded=true] .composer>.confirm{display:none}
    .element-bar{display:flex;min-height:34px;align-items:center;padding:0 13px;
      border-block:1px solid var(--border);background:var(--toolbar)}
    .element-name{min-width:0;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
      font:600 12px/1.2 ui-monospace,SFMono-Regular,Menlo,monospace}
    .grip{display:grid;grid-template-columns:repeat(2,3px);gap:3px;border:0;border-radius:5px;
      padding:4px;background:transparent;cursor:grab;opacity:.65;touch-action:none}
    .grip i{width:3px;height:3px;border-radius:50%;background:var(--muted)}
    .properties{min-height:0;max-height:min(260px,calc(100vh - 154px));
      max-height:min(260px,calc(100dvh - 154px));overflow:auto;padding:5px 10px 7px}
    label{display:grid;grid-template-columns:92px minmax(0,1fr);min-height:35px;
      align-items:center;gap:6px}
    label.group{margin-top:4px;padding-top:5px;border-top:1px solid var(--border)}
    label>span{overflow:hidden;color:var(--muted);font-size:11px;text-overflow:ellipsis;
      white-space:nowrap}
    input,select{width:100%;min-width:0;height:28px;border:1px solid var(--border);
      border-radius:7px;outline:0;background:var(--strong);color:var(--text);padding:0 8px;
      font:11px/1.2 ui-monospace,SFMono-Regular,Menlo,monospace}
    input:focus-visible,select:focus-visible,button:focus-visible{outline:2px solid var(--accent);
      outline-offset:1px}
    input[data-dirty=true],select[data-dirty=true]{border-color:var(--accent);
      background:var(--accent-soft)}
    .color-field{display:grid;grid-template-columns:30px minmax(0,1fr);gap:5px}
    .color-field[data-dirty=true]{border-radius:8px;background:var(--accent-soft)}
    .color-picker{width:30px;padding:3px;cursor:pointer}
    .color-picker::-webkit-color-swatch-wrapper{padding:0}
    .color-picker::-webkit-color-swatch{border:0;border-radius:4px}
    .footer{display:flex;min-height:46px;align-items:center;justify-content:space-between;
      padding:6px 8px 6px 10px;border-top:1px solid var(--border);background:var(--toolbar)}
    .cancel{min-height:28px;border:1px solid var(--border);border-radius:6px;padding:0 9px;
      background:transparent;color:var(--muted);cursor:pointer}
    .cancel:hover,.cancel:focus-visible{background:var(--hover);color:var(--text)}
    .footer .confirm{display:grid}
    @media (pointer:coarse) {
      .card{border-radius:18px}
      .card[data-expanded=true]{border-radius:12px}
      .composer{min-height:54px;padding:7px}
      .icon{width:40px;height:40px}
      textarea{min-height:36px;padding:7px 0;font-size:16px;line-height:22px}
      .element-bar{min-height:42px;padding-inline:12px}
      .grip{padding:8px}
      .properties{max-height:min(280px,calc(100dvh - 164px));padding:6px 8px 8px}
      label{grid-template-columns:82px minmax(0,1fr);min-height:44px;gap:8px}
      label>span{font-size:12px}
      input,select{height:36px;font-size:16px}
      .color-field{grid-template-columns:38px minmax(0,1fr);gap:7px}
      .color-picker{width:38px}
      .footer{min-height:52px;padding:6px 8px}
      .cancel{min-height:36px;padding-inline:12px}
    }
    @media (prefers-reduced-motion:reduce) {
      .anchor,.card{transition:none}
    }
  `,
} as const satisfies PageCommentRuntimeAssets;
