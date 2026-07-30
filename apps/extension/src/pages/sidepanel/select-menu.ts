import { Check, createElement as createLucideElement } from 'lucide';

type SelectMenuAlignment = 'start' | 'end';

export interface SelectMenuOptions {
  alignment?: SelectMenuAlignment;
  minWidth?: number;
  selectedLabel?: HTMLElement;
  select: HTMLSelectElement;
  trigger: HTMLButtonElement;
}

let activeMenuElement: HTMLElement | null = null;
let closeActiveMenu: (() => void) | null = null;
let menuSequence = 0;

function enabledOptions(menu: HTMLElement): HTMLButtonElement[] {
  return [...menu.querySelectorAll<HTMLButtonElement>('[role="option"]:not(:disabled)')];
}

export class SelectMenu {
  readonly menu: HTMLDivElement;
  readonly select: HTMLSelectElement;
  readonly trigger: HTMLButtonElement;
  private readonly alignment: SelectMenuAlignment;
  private readonly minWidth: number;
  private readonly selectedLabel?: HTMLElement;

  constructor({
    alignment = 'start',
    minWidth = 160,
    selectedLabel,
    select,
    trigger,
  }: SelectMenuOptions) {
    this.alignment = alignment;
    this.minWidth = minWidth;
    this.selectedLabel = selectedLabel;
    this.select = select;
    this.trigger = trigger;

    menuSequence += 1;
    this.menu = document.createElement('div');
    this.menu.className = 'select-menu';
    this.menu.id = `panerelay-select-menu-${menuSequence}`;
    this.menu.hidden = true;
    this.menu.setAttribute('role', 'listbox');
    document.body.append(this.menu);

    this.select.classList.add('native-select');
    this.select.tabIndex = -1;
    this.select.setAttribute('aria-hidden', 'true');
    this.trigger.setAttribute('aria-controls', this.menu.id);
    this.trigger.setAttribute('aria-expanded', 'false');
    this.trigger.setAttribute('aria-haspopup', 'listbox');

    this.trigger.addEventListener('click', () => this.toggle());
    this.trigger.addEventListener('keydown', event => {
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
      event.preventDefault();
      this.open(event.key === 'ArrowUp' ? 'last' : 'selected');
    });
    this.menu.addEventListener('keydown', event => this.handleMenuKeydown(event));
    this.select.addEventListener('change', () => this.sync());
    document.addEventListener('pointerdown', event => {
      if (
        !this.menu.hidden &&
        !this.menu.contains(event.target as Node) &&
        !this.trigger.contains(event.target as Node)
      ) {
        this.close();
      }
    });
    window.addEventListener('resize', () => {
      if (!this.menu.hidden) this.position();
    });
    window.addEventListener(
      'scroll',
      () => {
        if (!this.menu.hidden) this.position();
      },
      true,
    );

    this.sync();
  }

  sync(): void {
    const selected = this.select.selectedOptions[0];
    const label = selected?.label.trim() || selected?.textContent?.trim() || '';
    if (this.selectedLabel && selected) this.selectedLabel.textContent = label;
    this.trigger.disabled = this.select.disabled;
    if (this.trigger.disabled) this.close();
    const baseLabel =
      this.select.getAttribute('aria-label') || this.trigger.getAttribute('aria-label') || '';
    this.trigger.setAttribute('aria-label', label ? `${baseLabel}: ${label}` : baseLabel);
    if (!this.menu.hidden) {
      this.renderOptions();
      this.position();
    }
  }

  close({ restoreFocus = false } = {}): void {
    if (this.menu.hidden) return;
    this.menu.hidden = true;
    this.trigger.setAttribute('aria-expanded', 'false');
    if (activeMenuElement === this.menu) {
      activeMenuElement = null;
      closeActiveMenu = null;
    }
    if (restoreFocus) this.trigger.focus();
  }

  private toggle(): void {
    if (this.menu.hidden) this.open();
    else this.close({ restoreFocus: true });
  }

  private open(focus: 'selected' | 'last' = 'selected'): void {
    if (this.trigger.disabled) return;
    closeActiveMenu?.();
    activeMenuElement = this.menu;
    closeActiveMenu = () => this.close();
    this.renderOptions();
    this.menu.hidden = false;
    this.trigger.setAttribute('aria-expanded', 'true');
    this.position();
    requestAnimationFrame(() => {
      const options = enabledOptions(this.menu);
      const selected = options.find(option => option.getAttribute('aria-selected') === 'true');
      (focus === 'last' ? options.at(-1) : selected || options[0])?.focus();
    });
  }

  private renderOptions(): void {
    this.menu.replaceChildren();
    for (const option of this.select.options) {
      if (option.hidden) continue;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'select-menu-option';
      button.disabled = option.disabled;
      button.setAttribute('role', 'option');
      button.setAttribute('aria-selected', String(option.value === this.select.value));

      const label = document.createElement('span');
      label.textContent = option.textContent?.trim() || option.label;
      button.append(label);
      if (option.value === this.select.value) {
        button.append(
          createLucideElement(Check, {
            'aria-hidden': 'true',
            class: 'select-menu-check',
          }),
        );
      }
      button.addEventListener('click', () => {
        if (this.select.value !== option.value) {
          this.select.value = option.value;
          this.select.dispatchEvent(new Event('change', { bubbles: true }));
        }
        this.close({ restoreFocus: true });
      });
      this.menu.append(button);
    }
  }

  private position(): void {
    const triggerRect = this.trigger.getBoundingClientRect();
    const viewportPadding = 8;
    const gap = 5;
    const width = Math.min(
      Math.max(triggerRect.width, this.minWidth),
      window.innerWidth - viewportPadding * 2,
    );
    this.menu.style.width = `${width}px`;

    const preferredLeft = this.alignment === 'end' ? triggerRect.right - width : triggerRect.left;
    const left = Math.min(
      Math.max(preferredLeft, viewportPadding),
      window.innerWidth - width - viewportPadding,
    );
    this.menu.style.left = `${left}px`;

    const menuHeight = this.menu.getBoundingClientRect().height;
    const below = triggerRect.bottom + gap;
    const top =
      below + menuHeight <= window.innerHeight - viewportPadding
        ? below
        : Math.max(viewportPadding, triggerRect.top - menuHeight - gap);
    this.menu.style.top = `${top}px`;
  }

  private handleMenuKeydown(event: KeyboardEvent): void {
    const options = enabledOptions(this.menu);
    const currentIndex = options.indexOf(document.activeElement as HTMLButtonElement);
    let next: HTMLButtonElement | undefined;
    if (event.key === 'ArrowDown') next = options[(currentIndex + 1) % options.length];
    if (event.key === 'ArrowUp') {
      next = options[(currentIndex - 1 + options.length) % options.length];
    }
    if (event.key === 'Home') next = options[0];
    if (event.key === 'End') next = options.at(-1);
    if (next) {
      event.preventDefault();
      next.focus();
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      this.close({ restoreFocus: true });
    }
    if (event.key === 'Tab') this.close();
  }
}
