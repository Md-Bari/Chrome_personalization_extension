let lastUrl = window.location.href;
let spaCallback: (() => void) | null = null;
let isInitialized = false;

function checkUrlChange() {
  const currentUrl = window.location.href;
  if (currentUrl !== lastUrl) {
    lastUrl = currentUrl;
    if (spaCallback) {
      spaCallback();
    }
  }
}

export function initSpaDetector(onRouteChange: () => void): () => void {
  spaCallback = onRouteChange;

  if (!isInitialized) {
    isInitialized = true;

    // Monkey-patch pushState & replaceState safely
    const originalPushState = history.pushState;
    history.pushState = function (...args) {
      const result = originalPushState.apply(this, args);
      window.dispatchEvent(new Event('privacy-mask-locationchange'));
      return result;
    };

    const originalReplaceState = history.replaceState;
    history.replaceState = function (...args) {
      const result = originalReplaceState.apply(this, args);
      window.dispatchEvent(new Event('privacy-mask-locationchange'));
      return result;
    };

    window.addEventListener('popstate', checkUrlChange);
    window.addEventListener('hashchange', checkUrlChange);
    window.addEventListener('privacy-mask-locationchange', checkUrlChange);
  }

  return () => {
    window.removeEventListener('popstate', checkUrlChange);
    window.removeEventListener('hashchange', checkUrlChange);
    window.removeEventListener('privacy-mask-locationchange', checkUrlChange);
  };
}
