import { Check } from 'lucide-react';
import {
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';

export interface SelectMenuOption {
  value: string;
  label: string;
  disabled?: boolean;
  title?: string;
}

interface TriggerProps {
  'aria-controls': string;
  'aria-expanded': boolean;
  'aria-haspopup': 'listbox';
  disabled: boolean;
  onClick(): void;
  onKeyDown(event: KeyboardEvent<HTMLButtonElement>): void;
  ref: React.Ref<HTMLButtonElement>;
}

export interface SelectMenuProps {
  alignment?: 'start' | 'end';
  disabled?: boolean;
  minWidth?: number;
  onChange(value: string): void;
  options: SelectMenuOption[];
  renderTrigger(props: TriggerProps): ReactNode;
  value: string;
}

export function SelectMenu({
  alignment = 'start',
  disabled = false,
  minWidth = 160,
  onChange,
  options,
  renderTrigger,
  value,
}: SelectMenuProps) {
  const menuId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: 8, top: 8, width: minWidth });

  const close = useCallback((restoreFocus = false) => {
    setOpen(false);
    if (restoreFocus) requestAnimationFrame(() => triggerRef.current?.focus());
  }, []);

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const viewportPadding = 8;
    const width = Math.min(Math.max(rect.width, minWidth), window.innerWidth - viewportPadding * 2);
    const preferredLeft = alignment === 'end' ? rect.right - width : rect.left;
    const left = Math.min(
      Math.max(preferredLeft, viewportPadding),
      window.innerWidth - width - viewportPadding,
    );
    const menuHeight = menuRef.current?.getBoundingClientRect().height ?? 0;
    const below = rect.bottom + 5;
    const top =
      below + menuHeight <= window.innerHeight - viewportPadding
        ? below
        : Math.max(viewportPadding, rect.top - menuHeight - 5);
    setPosition({ left, top, width });
  }, [alignment, minWidth]);

  useEffect(() => {
    if (!open) return;
    updatePosition();
    const selected =
      menuRef.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]') ??
      menuRef.current?.querySelector<HTMLButtonElement>('[role="option"]:not(:disabled)');
    requestAnimationFrame(() => selected?.focus());

    const pointerListener = (event: PointerEvent) => {
      if (
        !menuRef.current?.contains(event.target as Node) &&
        !triggerRef.current?.contains(event.target as Node)
      ) {
        close();
      }
    };
    const positionListener = () => updatePosition();
    document.addEventListener('pointerdown', pointerListener);
    window.addEventListener('resize', positionListener);
    window.addEventListener('scroll', positionListener, true);
    return () => {
      document.removeEventListener('pointerdown', pointerListener);
      window.removeEventListener('resize', positionListener);
      window.removeEventListener('scroll', positionListener, true);
    };
  }, [close, open, updatePosition]);

  useEffect(() => {
    if (disabled) close();
  }, [close, disabled]);

  const moveFocus = (direction: 1 | -1) => {
    const enabled = [
      ...(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="option"]:not(:disabled)') ??
        []),
    ];
    if (!enabled.length) return;
    const currentIndex = enabled.indexOf(document.activeElement as HTMLButtonElement);
    enabled[(currentIndex + direction + enabled.length) % enabled.length]?.focus();
  };

  const triggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    setOpen(true);
  };

  const menuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      moveFocus(event.key === 'ArrowDown' ? 1 : -1);
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      const enabled = menuRef.current?.querySelectorAll<HTMLButtonElement>(
        '[role="option"]:not(:disabled)',
      );
      (event.key === 'Home' ? enabled?.[0] : enabled?.[enabled.length - 1])?.focus();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      close(true);
    } else if (event.key === 'Tab') {
      close();
    }
  };

  return (
    <>
      {renderTrigger({
        'aria-controls': menuId,
        'aria-expanded': open,
        'aria-haspopup': 'listbox',
        disabled,
        onClick: () => setOpen(current => !current),
        onKeyDown: triggerKeyDown,
        ref: triggerRef,
      })}
      {open &&
        createPortal(
          <div
            className="select-menu"
            id={menuId}
            onKeyDown={menuKeyDown}
            ref={menuRef}
            role="listbox"
            style={position}
          >
            {options.map(option => (
              <button
                aria-selected={option.value === value}
                className="select-menu-option"
                disabled={option.disabled}
                key={option.value}
                onClick={() => {
                  if (option.value !== value) onChange(option.value);
                  close(true);
                }}
                role="option"
                title={option.title}
                type="button"
              >
                <span>{option.label}</span>
                {option.value === value && (
                  <Check aria-hidden="true" className="select-menu-check" />
                )}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}
