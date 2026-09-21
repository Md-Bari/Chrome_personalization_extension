/**
 * Privacy Mask - Popup
 */

const STORAGE_KEY = 'privacy_mask_rules_v3';

interface PMRule {
  id: string;
  hostname: string;
  pathname: string;
  matchScope: 'domain' | 'page';
  cssSelector: string;
  domPath: string;
  originalText: string;
  maskText: string;
  createdAt: number;
  enabled: boolean;
}

let currentTabId: number | null = null;
let isSelecting = false;

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getActiveTab(): Promise<chrome.tabs.Tab | null> {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => resolve(tabs[0] ?? null));
  });
}

function isRestricted(url?: string): boolean {
  if (!url) return true;
  return /^(chrome|edge|chrome-extension|about|view-source|chrome-search):/.test(url);
}

async function ensureScript(tabId: number): Promise<boolean> {
  try {
    // Ping the content script
    await new Promise<void>((resolve, reject) => {
      chrome.tabs.sendMessage(tabId, { type: 'GET_PAGE_STATUS' }, (res) => {
        if (chrome.runtime.lastError || !res) reject(chrome.runtime.lastError);
        else resolve();
      });
    });
    return true;
  } catch {
    // Inject it
    try {
      await chrome.scripting.insertCSS({ target: { tabId }, files: ['content/styles.css'] });
      await chrome.scripting.executeScript({ target: { tabId }, files: ['content/content.js'] });
      await new Promise((r) => setTimeout(r, 300));
      return true;
    } catch (e) {
      console.error('[PM Popup] Inject failed:', e);
      return false;
    }
  }
}

function sendMsg(tabId: number, msg: object): Promise<unknown> {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, msg, (res) => {
      if (chrome.runtime.lastError) {
        console.warn('[PM Popup] sendMsg error:', chrome.runtime.lastError.message);
        resolve(null);
      } else {
        resolve(res);
      }
    });
  });
}

function getRulesFromStorage(): Promise<PMRule[]> {
  return new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEY], (result) => {
      const rules = result[STORAGE_KEY];
      resolve(Array.isArray(rules) ? rules : []);
    });
  });
}

function deleteRuleFromStorage(ruleId: string): Promise<void> {
  return new Promise(async (resolve) => {
    const all = await getRulesFromStorage();
    const filtered = all.filter((r) => r.id !== ruleId);
    chrome.storage.local.set({ [STORAGE_KEY]: filtered }, () => resolve());
  });
}

// ─── Render ──────────────────────────────────────────────────────────────────

function renderRules(rules: PMRule[], hostname: string): void {
  const list = document.getElementById('rules-list')!;
  const empty = document.getElementById('empty-state')!;
  const count = document.getElementById('active-mask-count')!;

  // Filter to current site
  const siteRules = rules.filter((r) => {
    const rh = r.hostname.toLowerCase();
    const ch = hostname.toLowerCase();
    return rh === ch || ch.endsWith('.' + rh) || rh.endsWith('.' + ch);
  });

  count.textContent = siteRules.filter((r) => r.enabled).length.toString();

  // Clear old rule items (keep empty-state)
  list.querySelectorAll('.rule-item').forEach((el) => el.remove());

  if (siteRules.length === 0) {
    empty.style.display = 'block';
    return;
  }

  empty.style.display = 'none';

  siteRules.forEach((rule) => {
    const item = document.createElement('div');
    item.className = 'rule-item';
    item.dataset.ruleId = rule.id;

    const preview = rule.originalText?.slice(0, 35) || rule.cssSelector?.slice(0, 35) || 'Element';
    const displayText = preview + (preview.length >= 35 ? '…' : '');

    item.innerHTML = `
      <div class="rule-info">
        <span class="rule-name">📝 ${rule.matchScope === 'page' ? 'Page' : 'Site'} Mask</span>
        <span class="rule-selector" title="${escHtml(rule.originalText || rule.cssSelector)}">"${escHtml(displayText)}"</span>
      </div>
      <div class="rule-actions">
        <button class="icon-btn reveal-btn" title="Temporarily reveal">👁</button>
        <button class="icon-btn delete-btn" title="Delete mask">🗑</button>
      </div>
    `;

    item.querySelector('.reveal-btn')?.addEventListener('click', async () => {
      if (currentTabId) {
        await sendMsg(currentTabId, { type: 'TEMPORARY_REVEAL', payload: { ruleId: rule.id } });
      }
    });

    item.querySelector('.delete-btn')?.addEventListener('click', async () => {
      await deleteRuleFromStorage(rule.id);
      if (currentTabId) {
        await sendMsg(currentTabId, { type: 'REMOVE_RULE', payload: { ruleId: rule.id } });
      }
      item.remove();
      const remaining = list.querySelectorAll('.rule-item').length;
      count.textContent = Math.max(0, parseInt(count.textContent || '1') - 1).toString();
      if (remaining === 0) empty.style.display = 'block';
    });

    list.appendChild(item);
  });
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

// ─── Init ─────────────────────────────────────────────────────────────────────

async function init(): Promise<void> {
  const tab = await getActiveTab();
  const domainEl = document.getElementById('site-domain')!;
  const startBtn = document.getElementById('btn-start-masking') as HTMLButtonElement;
  const btnText = document.getElementById('masking-btn-text')!;
  const ctaHint = document.getElementById('cta-hint')!;

  if (!tab?.id || !tab.url || isRestricted(tab.url)) {
    domainEl.textContent = 'Not available on this page';
    domainEl.style.color = '#ff9500';
    startBtn.disabled = true;
    return;
  }

  currentTabId = tab.id;
  const hostname = new URL(tab.url).hostname;
  domainEl.textContent = hostname;

  // Load and render saved rules (from storage directly — no content script needed)
  const allRules = await getRulesFromStorage();
  renderRules(allRules, hostname);

  // Try to get live status from content script
  const isReady = await ensureScript(tab.id);
  if (isReady) {
    const status = await sendMsg(tab.id, { type: 'GET_PAGE_STATUS' }) as {
      activeCount?: number; isSelecting?: boolean; rules?: PMRule[];
    } | null;

    if (status) {
      if (status.activeCount !== undefined) {
        document.getElementById('active-mask-count')!.textContent = status.activeCount.toString();
      }
      if (status.isSelecting) {
        isSelecting = true;
        btnText.textContent = 'Cancel Selection';
        startBtn.classList.add('selecting');
      }
    }
  }

  // ── Start Masking button ─────────────────────────────────────────────────
  startBtn.addEventListener('click', async () => {
    if (!currentTabId) return;

    if (isSelecting) {
      await sendMsg(currentTabId, { type: 'CANCEL_SELECTION' });
      isSelecting = false;
      btnText.textContent = 'Start Masking';
      startBtn.classList.remove('selecting');
      ctaHint.textContent = 'Click elements or select text on the page to mask';
    } else {
      const ready = await ensureScript(currentTabId);
      if (!ready) {
        ctaHint.textContent = '⚠️ Please refresh the page and try again.';
        return;
      }

      await sendMsg(currentTabId, { type: 'START_MASKING' });
      isSelecting = true;
      btnText.textContent = 'Cancel Selection';
      startBtn.classList.add('selecting');
      ctaHint.textContent = '🎯 Switch to the page — hover & click elements to mask them.';

      // Close popup so user can interact with page
      setTimeout(() => window.close(), 350);
    }
  });

  // ── Pause toggle ────────────────────────────────────────────────────────
  const pauseToggle = document.getElementById('pause-toggle') as HTMLInputElement;
  pauseToggle?.addEventListener('change', async () => {
    if (!currentTabId) return;
    await sendMsg(currentTabId, { type: 'TOGGLE_PAUSE' });
    document.getElementById('paused-banner')!.style.display =
      pauseToggle.checked ? 'flex' : 'none';
  });

  // ── Manage / Settings ────────────────────────────────────────────────────
  document.getElementById('btn-manage-masks')?.addEventListener('click', () => {
    chrome.runtime.openOptionsPage?.() ?? window.open(chrome.runtime.getURL('options/options.html'));
  });
  document.getElementById('btn-open-settings')?.addEventListener('click', () => {
    chrome.runtime.openOptionsPage?.() ?? window.open(chrome.runtime.getURL('options/options.html'));
  });

  // ── Listen for rule updates from content script ──────────────────────────
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'PAGE_STATUS_RESPONSE' && msg.payload) {
      const p = msg.payload as { activeCount: number; rules: PMRule[] };
      document.getElementById('active-mask-count')!.textContent = p.activeCount.toString();
      renderRules(p.rules, hostname);
    }
  });
}

document.addEventListener('DOMContentLoaded', () => init());
