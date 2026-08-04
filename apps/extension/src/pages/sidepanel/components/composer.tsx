import {
  ArrowUp,
  FolderOpen,
  LoaderCircle,
  MessageSquarePlus,
  MessageSquareText,
  ShieldCheck,
  X,
} from 'lucide-react';
import { useEffect, useRef } from 'react';
import { selectedAgentName, type SidepanelController } from '../sidepanel-controller.js';
import { useCopy } from './presentation.js';

export function Composer({ controller }: { controller: SidepanelController }) {
  const { state } = controller;
  const { t, tf } = useCopy(state);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const provider = state.providers.find(item => item.id === state.currentProviderId);
  const ready = state.extensionStatus?.bridgeConnected && provider?.status === 'ready';
  const disabled = state.initializing || !ready || state.submitting;
  const projectName = state.workspace?.cwd?.split(/[\\/]/).filter(Boolean).at(-1) || t('project');
  const projectBound = state.workspace?.kind === 'conversation';

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.style.height = 'auto';
    input.style.height = `${Math.min(input.scrollHeight, 130)}px`;
  }, [state.composerText]);

  return (
    <footer className="composer-area border-t border-panel-border bg-panel-surface p-2">
      <form
        className="composer"
        onSubmit={event => {
          event.preventDefault();
          void controller.sendMessage();
        }}
      >
        {state.pastedImages.length > 0 && (
          <div
            aria-label={tf('attachedImages', { count: state.pastedImages.length })}
            className="pasted-image-list"
          >
            {state.pastedImages.map(image => (
              <div className="pasted-image-preview" key={image.id}>
                <img
                  alt={image.name || image.mimeType}
                  src={`data:${image.mimeType};base64,${image.data}`}
                />
                <button
                  aria-label={t('removeImage')}
                  onClick={() => controller.removePastedImage(image.id)}
                  title={t('removeImage')}
                  type="button"
                >
                  <X aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
        )}
        {state.pageComments.length > 0 && (
          <div aria-label={t('pageComments')} className="pending-page-comments">
            {state.pageComments.map((comment, index) => (
              <div className="pending-page-comment" key={comment.id}>
                <button
                  className="page-comment-pill-main"
                  aria-label={t('editPageComment')}
                  onClick={() => void controller.editPageComment(comment.id)}
                  title={`${comment.element.selector || comment.element.tagName}\n${
                    comment.comment || Object.entries(comment.styleChanges ?? {}).join(', ')
                  }`}
                  type="button"
                >
                  <MessageSquareText aria-hidden="true" />
                  <span>{tf('annotation', { count: index + 1 })}</span>
                </button>
                <button
                  className="page-comment-pill-remove"
                  aria-label={t('removePageComment')}
                  onClick={() => void controller.removePageComment(comment.id)}
                  title={t('removePageComment')}
                  type="button"
                >
                  <X aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
        )}
        <textarea
          aria-label={tf('composerPlaceholder', { agent: selectedAgentName(state) })}
          disabled={disabled}
          onChange={event => controller.setComposerText(event.target.value)}
          onPaste={event => {
            const files = Array.from(event.clipboardData.items).flatMap(item => {
              if (item.kind !== 'file' || !item.type.startsWith('image/')) return [];
              const file = item.getAsFile();
              return file ? [file] : [];
            });
            if (files.length === 0) return;
            event.preventDefault();
            void controller.addPastedImages(files);
          }}
          onKeyDown={event => {
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              void controller.sendMessage();
            }
          }}
          placeholder={tf('composerPlaceholder', { agent: selectedAgentName(state) })}
          ref={inputRef}
          rows={2}
          value={state.composerText}
        />
        <div className="composer-footer flex items-center">
          <div className="composer-tools">
            <div className="project-control">
              <button
                aria-label={projectBound ? t('projectBound') : t('selectProject')}
                className="composer-tool project-button"
                disabled={disabled || projectBound || state.selectingProject || !state.workspace}
                onClick={() => void controller.selectProject()}
                title={
                  state.workspace?.cwd
                    ? `${t('project')}: ${state.workspace.cwd}`
                    : t('selectProject')
                }
                type="button"
              >
                {state.selectingProject ? (
                  <LoaderCircle aria-hidden="true" className="spin" />
                ) : (
                  <FolderOpen aria-hidden="true" />
                )}
                <span>{state.workspace?.cwd ? projectName : t('selectProject')}</span>
              </button>
              {state.workspace?.kind === 'draft' && state.workspace.cwd && (
                <button
                  aria-label={t('clearProject')}
                  className="composer-tool project-clear"
                  disabled={disabled || state.selectingProject}
                  onClick={() => void controller.clearProject()}
                  title={t('clearProject')}
                  type="button"
                >
                  <X aria-hidden="true" />
                </button>
              )}
            </div>
            <button
              aria-label={state.commentMode ? t('stopPageComments') : t('addPageComment')}
              className="composer-tool composer-action"
              data-active={state.commentMode || undefined}
              disabled={disabled || state.pageCommentsPending}
              onClick={event => {
                if (event.detail > 1) return;
                void controller.togglePageComments();
              }}
              onDoubleClick={() => void controller.startContinuousPageComments()}
              title={state.commentMode ? t('stopPageComments') : t('addPageComment')}
              type="button"
            >
              {state.pageCommentsPending ? (
                <LoaderCircle aria-hidden="true" className="spin" />
              ) : (
                <MessageSquarePlus aria-hidden="true" />
              )}
              {state.pageComments.length > 0 && (
                <span className="composer-tool-count">{state.pageComments.length}</span>
              )}
            </button>
            <button
              aria-label={state.autoApprove ? t('disableAutoApprove') : t('enableAutoApprove')}
              className="composer-tool composer-action"
              data-active={state.autoApprove || undefined}
              onClick={() => void controller.setAutoApprove(!state.autoApprove)}
              title={state.autoApprove ? t('disableAutoApprove') : t('enableAutoApprove')}
              type="button"
            >
              <ShieldCheck aria-hidden="true" />
            </button>
          </div>
          {state.imageError && (
            <span className="composer-image-error" role="alert">
              {state.imageError}
            </span>
          )}
          <span className="composer-hint">{t('sendHint')}</span>
          {state.runningTurnId ? (
            <button
              className="stop-button"
              onClick={() => void controller.interrupt()}
              type="button"
            >
              {t('stop')}
            </button>
          ) : (
            <button
              aria-label={t('send')}
              className="send-button"
              disabled={
                disabled ||
                (state.composerText.trim().length === 0 &&
                  state.pageComments.length === 0 &&
                  state.pastedImages.length === 0)
              }
              type="submit"
            >
              <ArrowUp aria-hidden="true" />
            </button>
          )}
        </div>
      </form>
    </footer>
  );
}
