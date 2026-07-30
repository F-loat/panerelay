export interface PageCommentRect {
  height: number;
  left: number;
  top: number;
  width: number;
}

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
export type PageCommentStyleChanges = Partial<Record<PageCommentChangeProperty, string>>;

export interface PageCommentElementEvidence {
  ariaLabel?: string;
  computedStyle?: Partial<Record<PageCommentStyleProperty, string>>;
  id?: string;
  role?: string;
  selector: string;
  tagName: string;
  text: string;
  rect: PageCommentRect;
  xpath?: string;
}

export interface PageCommentDocumentEvidence {
  title: string;
  url: string;
  viewport?: {
    height: number;
    width: number;
  };
}

export interface PageElementComment {
  comment: string;
  element: PageCommentElementEvidence;
  frame?: PageCommentDocumentEvidence;
  id: string;
  page: PageCommentDocumentEvidence;
  styleChanges?: PageCommentStyleChanges;
}

export type PageCommentRuntimeMessage =
  | {
      type: 'panerelay.page-comment.changed';
      source: 'panerelay-page-comments';
      comment: PageElementComment;
    }
  | {
      type: 'panerelay.page-comment.removed';
      source: 'panerelay-page-comments';
      commentId: string;
    }
  | {
      type: 'panerelay.page-comment.mode';
      source: 'panerelay-page-comments';
      active: boolean;
      continuous?: boolean;
    }
  | {
      type: 'panerelay.page-comment.reset';
    };
