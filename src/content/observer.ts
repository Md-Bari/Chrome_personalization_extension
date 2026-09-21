import { UI_PREFIX } from '../shared/constants';

let mutationObserver: MutationObserver | null = null;
let debounceTimeout: number | null = null;

export function startDomObserver(onMutations: () => void, debounceMs: number = 100): void {
  stopDomObserver();

  if (typeof MutationObserver === 'undefined') return;

  mutationObserver = new MutationObserver((mutations) => {
    // Filter out our own UI changes to prevent infinite loops
    let hasExternalChanges = false;
    for (const mutation of mutations) {
      const target = mutation.target as HTMLElement;
      if (
        target &&
        (target.id?.startsWith(UI_PREFIX) ||
          target.className?.toString().includes(UI_PREFIX))
      ) {
        continue;
      }
      hasExternalChanges = true;
      break;
    }

    if (!hasExternalChanges) return;

    if (debounceTimeout !== null) {
      window.clearTimeout(debounceTimeout);
    }

    debounceTimeout = window.setTimeout(() => {
      onMutations();
      debounceTimeout = null;
    }, debounceMs);
  });

  mutationObserver.observe(document.body || document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
  });
}

export function stopDomObserver(): void {
  if (debounceTimeout !== null) {
    window.clearTimeout(debounceTimeout);
    debounceTimeout = null;
  }
  if (mutationObserver) {
    mutationObserver.disconnect();
    mutationObserver = null;
  }
}
