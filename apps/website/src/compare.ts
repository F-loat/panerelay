import { initializeLocalePreference } from './locale-preference';

initializeLocalePreference();
document.documentElement.classList.add('js');

const compareNavigation = document.querySelector<HTMLElement>('[data-compare-navigation]');
const menuButton = document.querySelector<HTMLButtonElement>('[data-compare-menu-button]');

function setMenuOpen(open: boolean): void {
  if (!compareNavigation || !menuButton) {
    return;
  }

  compareNavigation.dataset.open = String(open);
  menuButton.setAttribute('aria-expanded', String(open));
  menuButton.setAttribute(
    'aria-label',
    document.documentElement.lang === 'zh-CN'
      ? open
        ? '关闭导航'
        : '打开导航'
      : open
        ? 'Close navigation'
        : 'Open navigation',
  );
}

menuButton?.addEventListener('click', () => {
  setMenuOpen(menuButton.getAttribute('aria-expanded') !== 'true');
});

for (const link of compareNavigation?.querySelectorAll<HTMLAnchorElement>('a') ?? []) {
  link.addEventListener('click', () => setMenuOpen(false));
}

document.addEventListener('keydown', event => {
  if (event.key !== 'Escape' || menuButton?.getAttribute('aria-expanded') !== 'true') {
    return;
  }

  setMenuOpen(false);
  menuButton.focus();
});

window.matchMedia('(min-width: 901px)').addEventListener('change', event => {
  if (event.matches) {
    setMenuOpen(false);
  }
});
