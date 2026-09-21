/**
 * Privacy Mask - Complete Self-Contained Content Script
 *
 * This is a single-file content script that handles:
 * - Selection mode (hover highlight + click to pick)
 * - Confirm modal (mask text input + scope)
 * - Masking (text node wrapping)
 * - Storage (chrome.storage.local)
 * - Re-applying saved masks on load
 * - Temporary reveal
 */

// ═══════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════
const PM = 'pm'; // Short prefix for all our DOM markers
const ATTR_HOST = 'data-pm-host'; // marks masked element
const ATTR_WRAP = 'data-pm-wrap'; // marks text wrapper span
const ATTR_ORIG = 'data-pm-orig'; // stores original text
const STORAGE_KEY = 'privacy_mask_rules_v2';
const DEFAULT_MASK = '████';

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════
interface PMRule {
  id: string;
  hostname: string;
  pathname: string; // exact path, used when scope=page
  matchScope: 'domain' | 'page';
  cssSelector: string; // primary selector
  domPath: string; // fallback path selector
  originalText: string; // for text matching
  maskText: string;
  createdAt: number;
  enabled: boolean;
}

// ═══════════════════════════════════════════════════════════════════
// STORAGE
// ═══════════════════════════════════════════════════════════════════
async function loadAllRules(): Promise<PMRule[]> {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.get([STORAGE_KEY], (result) => {
        if (chrome.runtime.lastError) {
          console.error('[PM] Storage read error:', chrome.runtime.lastError);
          resolve([]);
          return;
        }
        const rules = result[STORAGE_KEY];
        resolve(Array.isArray(rules) ? rules : []);
      });
    } catch (e) {
      console.error('[PM] Storage exception:', e);
      resolve([]);
    }
  });
}

async function saveRule(rule: PMRule): Promise<void> {
  return new Promise(async (resolve, reject) => {
    try {
      const all = await loadAllRules();
      const idx = all.findIndex((r) => r.id === rule.id);
      if (idx >= 0) {
        all[idx] = rule;
      } else {
        all.push(rule);
      }
      chrome.storage.local.set({ [STORAGE_KEY]: all }, () => {
        if (chrome.runtime.lastError) {
          console.error('[PM] Storage write error:', chrome.runtime.lastError);
          reject(chrome.runtime.lastError);
        } else {
          console.log('[PM] Rule saved. Total rules:', all.length);
          resolve();
        }
      });
    } catch (e) {
      reject(e);
    }
  });
}

async function deleteRule(ruleId: string): Promise<void> {
  return new Promise(async (resolve) => {
    try {
      const all = await loadAllRules();
      const filtered = all.filter((r) => r.id !== ruleId);
      chrome.storage.local.set({ [STORAGE_KEY]: filtered }, () => {
        resolve();
      });
    } catch {
      resolve();
    }
  });
}

async function getRulesForCurrentPage(): Promise<PMRule[]> {
  const all = await loadAllRules();
  const hostname = location.hostname;
  const pathname = location.pathname;
  return all.filter((r) => {
    // Hostname match (exact or subdomain)
    const rh = r.hostname.toLowerCase();
    const ch = hostname.toLowerCase();
    const hostMatch = rh === ch || ch.endsWith('.' + rh) || rh.endsWith('.' + ch);
    if (!hostMatch) return false;

    // Page scope
    if (r.matchScope === 'page') {
      return r.pathname === pathname;
    }
    return true;
  });
}

// ═══════════════════════════════════════════════════════════════════
// SELECTOR GENERATION
// ═══════════════════════════════════════════════════════════════════
function getDomPath(el: Element): string {
  const parts: string[] = [];
  let curr: Element | null = el;
  while (curr && curr !== document.body && curr !== document.documentElement) {
    const tag = curr.tagName.toLowerCase();
    const parent = curr.parentElement;
    if (!parent) break;

    // If element has stable ID, use it and stop
    if (curr.id && !isDynamicId(curr.id)) {
      parts.unshift(`#${CSS.escape(curr.id)}`);
      break;
    }

    // Count siblings of same tag
    const siblings = Array.from(parent.children).filter(
      (c) => c.tagName === curr!.tagName
    );
    const idx = siblings.indexOf(curr) + 1;
    const part = siblings.length > 1 ? `${tag}:nth-of-type(${idx})` : tag;
    parts.unshift(part);
    curr = parent;
  }
  return parts.join(' > ');
}

function isDynamicId(id: string): boolean {
  return /^(:r|ember|react-aria|uid-|mui-|\d)/.test(id) || /\d{4,}/.test(id);
}

function getCssSelector(el: Element): string {
  // 1. Stable ID
  if (el.id && !isDynamicId(el.id)) {
    return `#${CSS.escape(el.id)}`;
  }

  // 2. Data attributes
  for (const attr of ['data-testid', 'data-test', 'data-qa', 'data-cy']) {
    const val = el.getAttribute(attr);
    if (val) return `[${attr}="${CSS.escape(val)}"]`;
  }

  // 3. Fall back to DOM path
  return getDomPath(el);
}

// ═══════════════════════════════════════════════════════════════════
// MASKING ENGINE
// ═══════════════════════════════════════════════════════════════════
const revealTimers = new Map<string, ReturnType<typeof setTimeout>>();

function findElement(rule: PMRule): HTMLElement | null {
  // 1. CSS selector
  try {
    const el = document.querySelector(rule.cssSelector) as HTMLElement | null;
    if (el) return el;
  } catch {}

  // 2. DOM path
  try {
    const el = document.querySelector(rule.domPath) as HTMLElement | null;
    if (el) return el;
  } catch {}

  // 3. Text content match
  if (rule.originalText && rule.originalText.length > 0) {
    const candidates = document.querySelectorAll('span, p, td, th, div, h1, h2, h3, h4, h5, h6, li, label, strong, b, a');
    for (const c of candidates) {
      if ((c.textContent || '').trim() === rule.originalText.trim()) {
        return c as HTMLElement;
      }
    }
    // Partial match for longer text
    for (const c of candidates) {
      if (rule.originalText.length > 10 && (c.textContent || '').trim().includes(rule.originalText.trim())) {
        return c as HTMLElement;
      }
    }
  }

  return null;
}

function maskElement(el: HTMLElement, rule: PMRule): boolean {
  // Already masked for this rule?
  if (el.getAttribute(ATTR_HOST) === rule.id) return true;

  el.setAttribute(ATTR_HOST, rule.id);

  // Find all text nodes to wrap
  const textNodes = getTextNodes(el);

  if (textNodes.length === 0) {
    // Non-text element: use CSS block mask
    el.setAttribute('data-pm-block', 'true');
    el.setAttribute('data-pm-masktext', rule.maskText || DEFAULT_MASK);
    return true;
  }

  for (const tn of textNodes) {
    const orig = tn.textContent || '';
    if (!orig.trim()) continue;

    const wrapper = document.createElement('span');
    wrapper.className = `${PM}-wrapper`;
    wrapper.setAttribute(ATTR_WRAP, rule.id);
    wrapper.setAttribute(ATTR_ORIG, orig);

    const maskedSpan = document.createElement('span');
    maskedSpan.className = `${PM}-text`;
    maskedSpan.textContent = rule.maskText || DEFAULT_MASK;

    const revealBtn = document.createElement('button');
    revealBtn.className = `${PM}-eye`;
    revealBtn.type = 'button';
    revealBtn.title = 'Reveal temporarily';
    revealBtn.textContent = '👁';
    revealBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      temporarilyReveal(rule);
    });

    wrapper.appendChild(maskedSpan);
    wrapper.appendChild(revealBtn);
    tn.parentNode?.replaceChild(wrapper, tn);
  }

  return true;
}

function getTextNodes(el: HTMLElement): Text[] {
  const result: Text[] = [];
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      // Skip if already wrapped
      if ((node.parentElement)?.closest(`[${ATTR_WRAP}]`)) {
        return NodeFilter.FILTER_REJECT;
      }
      if (!(node.textContent || '').trim()) {
        return NodeFilter.FILTER_SKIP;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  let n: Node | null;
  while ((n = walker.nextNode())) result.push(n as Text);
  return result;
}

function unmaskElement(ruleId: string): void {
  // Restore text wrappers
  document.querySelectorAll(`[${ATTR_WRAP}="${ruleId}"]`).forEach((w) => {
    const orig = w.getAttribute(ATTR_ORIG) || '';
    w.parentNode?.replaceChild(document.createTextNode(orig), w);
  });

  // Remove host markers
  document.querySelectorAll(`[${ATTR_HOST}="${ruleId}"]`).forEach((el) => {
    el.removeAttribute(ATTR_HOST);
    el.removeAttribute('data-pm-block');
    el.removeAttribute('data-pm-masktext');
  });

  const timer = revealTimers.get(ruleId);
  if (timer) { clearTimeout(timer); revealTimers.delete(ruleId); }
}

function unmaskAll(): void {
  document.querySelectorAll(`[${ATTR_WRAP}]`).forEach((w) => {
    const orig = w.getAttribute(ATTR_ORIG) || '';
    w.parentNode?.replaceChild(document.createTextNode(orig), w);
  });
  document.querySelectorAll(`[${ATTR_HOST}]`).forEach((el) => {
    el.removeAttribute(ATTR_HOST);
    el.removeAttribute('data-pm-block');
    el.removeAttribute('data-pm-masktext');
  });
  revealTimers.forEach(clearTimeout);
  revealTimers.clear();
}

function temporarilyReveal(rule: PMRule, durationSecs = 5): void {
  const existing = revealTimers.get(rule.id);
  if (existing) { clearTimeout(existing); revealTimers.delete(rule.id); }

  // Show original text
  document.querySelectorAll(`[${ATTR_WRAP}="${rule.id}"]`).forEach((w) => {
    const orig = w.getAttribute(ATTR_ORIG) || '';
    const textSpan = w.querySelector(`.${PM}-text`);
    if (textSpan) textSpan.textContent = orig;
    (w as HTMLElement).setAttribute('data-pm-revealed', 'true');
  });

  const timer = setTimeout(() => {
    document.querySelectorAll(`[${ATTR_WRAP}="${rule.id}"]`).forEach((w) => {
      const textSpan = w.querySelector(`.${PM}-text`);
      if (textSpan) textSpan.textContent = rule.maskText || DEFAULT_MASK;
      (w as HTMLElement).removeAttribute('data-pm-revealed');
    });
    revealTimers.delete(rule.id);
  }, durationSecs * 1000);

  revealTimers.set(rule.id, timer);
}

// ═══════════════════════════════════════════════════════════════════
// APPLY SAVED MASKS
// ═══════════════════════════════════════════════════════════════════
let currentRules: PMRule[] = [];

async function applyAllSavedMasks(): Promise<void> {
  currentRules = await getRulesForCurrentPage();
  console.log('[PM] Applying', currentRules.length, 'rules for', location.hostname);

  for (const rule of currentRules) {
    if (!rule.enabled) continue;
    // Skip if already masked
    if (document.querySelector(`[${ATTR_HOST}="${rule.id}"]`)) {
      console.log('[PM] Rule already applied:', rule.id);
      continue;
    }
    const el = findElement(rule);
    if (el) {
      console.log('[PM] Found element for rule', rule.id, '→', el.tagName);
      maskElement(el, rule);
    } else {
      console.warn('[PM] Element not found for rule:', rule.id, rule.cssSelector);
    }
  }

  notifyPopup();
}

// ═══════════════════════════════════════════════════════════════════
// SELECTION MODE
// ═══════════════════════════════════════════════════════════════════
let selectionActive = false;
let hoveredEl: HTMLElement | null = null;
let hoverBox: HTMLDivElement | null = null;
let banner: HTMLDivElement | null = null;
let confirmDialog: HTMLDivElement | null = null;

function startSelection(): void {
  if (selectionActive) stopSelection();
  selectionActive = true;

  console.log('[PM] Selection mode started');
  document.body.classList.add(`${PM}-selecting`);
  showBanner();

  document.addEventListener('mousemove', onMouseMove, true);
  document.addEventListener('scroll', onScroll, { capture: true, passive: true });
  document.addEventListener('click', onClick, true);
  document.addEventListener('mouseup', onMouseUp, true);
  document.addEventListener('keydown', onKeyDown, true);
}

function stopSelection(): void {
  if (!selectionActive) return;
  selectionActive = false;
  hoveredEl = null;

  console.log('[PM] Selection mode stopped');
  document.body.classList.remove(`${PM}-selecting`);
  removeBanner();
  removeHoverBox();
  removeConfirmDialog();

  document.removeEventListener('mousemove', onMouseMove, true);
  document.removeEventListener('scroll', onScroll, true);
  document.removeEventListener('click', onClick, true);
  document.removeEventListener('mouseup', onMouseUp, true);
  document.removeEventListener('keydown', onKeyDown, true);
}

function isOurUI(el: Element | null): boolean {
  if (!el) return false;
  return !!(
    el.closest(`#${PM}-banner`) ||
    el.closest(`#${PM}-hover-box`) ||
    el.closest(`.${PM}-confirm-dialog`) ||
    el.closest(`[${ATTR_WRAP}]`)
  );
}

function getBestEl(target: Element): HTMLElement | null {
  if (!target || !(target instanceof HTMLElement)) return null;
  if (target.tagName === 'HTML' || target.tagName === 'BODY') return null;
  if (isOurUI(target)) return null;

  const tag = target.tagName.toLowerCase();
  const good = ['span', 'p', 'a', 'button', 'strong', 'em', 'b', 'i', 'label',
    'td', 'th', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'code', 'pre',
    'input', 'textarea', 'div'];

  if (good.includes(tag)) return target;

  // Try single-child drill-down
  if (target.children.length === 1 && target.children[0] instanceof HTMLElement) {
    return getBestEl(target.children[0]) || target;
  }
  return target;
}

// ── Event Handlers ───────────────────────────────────────────────

function onMouseMove(e: MouseEvent): void {
  if (!selectionActive || confirmDialog) return;
  const under = document.elementFromPoint(e.clientX, e.clientY);
  if (!under || isOurUI(under)) return;

  const best = getBestEl(under);
  if (best && best !== hoveredEl) {
    hoveredEl = best;
    showHoverBox(best);
  }
}

function onScroll(): void {
  if (hoveredEl && !confirmDialog) showHoverBox(hoveredEl);
}

function onMouseUp(e: MouseEvent): void {
  if (!selectionActive || confirmDialog) return;
  const sel = window.getSelection();
  if (sel && !sel.isCollapsed) {
    const text = sel.toString().trim();
    if (text.length > 0) {
      const range = sel.getRangeAt(0);
      let container: Node | null = range.commonAncestorContainer;
      if (container.nodeType === Node.TEXT_NODE) container = container.parentElement;
      if (container instanceof HTMLElement && !isOurUI(container)) {
        e.stopPropagation();
        showConfirm(container, text);
      }
    }
  }
}

function onClick(e: MouseEvent): void {
  if (!selectionActive) return;
  const target = e.target as Element;
  if (isOurUI(target)) return;

  // If text is selected, let mouseup handle it
  const sel = window.getSelection();
  if (sel && !sel.isCollapsed && sel.toString().trim().length > 0) {
    e.preventDefault();
    e.stopPropagation();
    return;
  }

  e.preventDefault();
  e.stopPropagation();

  if (confirmDialog) return;

  const el = hoveredEl || getBestEl(target);
  if (!el) return;

  const text = el.textContent?.trim() || `<${el.tagName.toLowerCase()}>`;
  showConfirm(el, text);
}

function onKeyDown(e: KeyboardEvent): void {
  if (e.key === 'Escape') {
    e.preventDefault();
    e.stopPropagation();
    if (confirmDialog) {
      removeConfirmDialog();
    } else {
      stopSelection();
      notifyPopup();
    }
  }
}

// ── Hover Box ─────────────────────────────────────────────────────

function showHoverBox(el: HTMLElement): void {
  if (!hoverBox) {
    hoverBox = document.createElement('div');
    hoverBox.id = `${PM}-hover-box`;
    document.body.appendChild(hoverBox);
  }
  const r = el.getBoundingClientRect();
  hoverBox.style.cssText = `
    position: fixed !important;
    top: ${r.top}px !important;
    left: ${r.left}px !important;
    width: ${r.width}px !important;
    height: ${r.height}px !important;
    display: block !important;
    pointer-events: none !important;
    z-index: 2147483645 !important;
    box-sizing: border-box !important;
    border: 2px solid #FF3B30 !important;
    background: rgba(255,59,48,0.08) !important;
    border-radius: 3px !important;
    outline: 2px dashed rgba(255,59,48,0.35) !important;
    outline-offset: 2px !important;
  `;
}

function removeHoverBox(): void {
  hoverBox?.remove();
  hoverBox = null;
}

// ── Selection Banner ─────────────────────────────────────────────

function showBanner(): void {
  if (document.getElementById(`${PM}-banner`)) return;
  banner = document.createElement('div');
  banner.id = `${PM}-banner`;
  banner.style.cssText = `
    position: fixed !important;
    top: 14px !important;
    left: 50% !important;
    transform: translateX(-50%) !important;
    z-index: 2147483647 !important;
    background: #18191f !important;
    color: #fff !important;
    border: 1.5px solid #FF3B30 !important;
    border-radius: 100px !important;
    padding: 9px 20px !important;
    display: flex !important;
    align-items: center !important;
    gap: 14px !important;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important;
    font-size: 13px !important;
    font-weight: 600 !important;
    box-shadow: 0 4px 24px rgba(255,59,48,0.4), 0 2px 10px rgba(0,0,0,0.5) !important;
    white-space: nowrap !important;
    pointer-events: auto !important;
    animation: pm-slide-in 0.2s ease-out !important;
  `;
  banner.innerHTML = `
    <span>🎯 Privacy Mask — hover over an element and click to mask it</span>
    <button id="${PM}-cancel-btn" style="
      background: rgba(255,59,48,0.15) !important;
      color: #ff5247 !important;
      border: 1px solid rgba(255,59,48,0.5) !important;
      border-radius: 100px !important;
      padding: 4px 14px !important;
      font-size: 11px !important;
      font-weight: 700 !important;
      cursor: pointer !important;
      font-family: inherit !important;
    ">Cancel (ESC)</button>
  `;
  document.body.appendChild(banner);

  banner.querySelector(`#${PM}-cancel-btn`)?.addEventListener('click', (e) => {
    e.stopPropagation();
    stopSelection();
    notifyPopup();
  });
}

function removeBanner(): void {
  banner?.remove();
  banner = null;
}

// ── Confirm Dialog ────────────────────────────────────────────────

function showConfirm(el: HTMLElement, previewText: string): void {
  removeConfirmDialog();
  removeHoverBox();

  const hostname = location.hostname;
  const displayText = previewText.length > 120 ? previewText.slice(0, 117) + '…' : previewText;
  const defaultMask = DEFAULT_MASK;

  confirmDialog = document.createElement('div');
  confirmDialog.className = `${PM}-confirm-dialog`;
  confirmDialog.style.cssText = `
    position: fixed !important;
    top: 50% !important;
    left: 50% !important;
    transform: translate(-50%, -50%) !important;
    z-index: 2147483647 !important;
    background: #1a1b22 !important;
    color: #e8e9ef !important;
    border: 1px solid #2e3040 !important;
    border-radius: 14px !important;
    padding: 24px !important;
    width: 370px !important;
    max-width: 92vw !important;
    box-sizing: border-box !important;
    box-shadow: 0 24px 60px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,59,48,0.15) !important;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important;
  `;

  confirmDialog.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;">
      <span style="font-size:16px;">🔒</span>
      <strong style="font-size:15px;color:#fff;">Confirm Mask Selection</strong>
      <span id="${PM}-close-btn" style="margin-left:auto;cursor:pointer;color:#606472;font-size:18px;line-height:1;padding:2px 6px;" title="Cancel">✕</span>
    </div>

    <div style="font-size:11px;font-weight:600;color:#787c8e;text-transform:uppercase;letter-spacing:0.6px;margin-bottom:6px;">Content to mask</div>
    <div style="background:#12131a;border:1px solid #272936;border-radius:8px;padding:10px 12px;font-family:monospace;font-size:12px;color:#5bcffa;max-height:80px;overflow-y:auto;word-break:break-all;margin-bottom:16px;">${escHtml(displayText)}</div>

    <label style="display:block;font-size:11px;font-weight:600;color:#8a8fa8;margin-bottom:5px;">Mask replacement text</label>
    <input id="${PM}-mask-input" type="text" value="${escHtml(defaultMask)}" style="
      width:100% !important;
      background:#12131a !important;
      border:1.5px solid #2b2d3d !important;
      border-radius:8px !important;
      color:#e8e9ef !important;
      padding:9px 12px !important;
      font-size:13px !important;
      box-sizing:border-box !important;
      margin-bottom:14px !important;
      font-family:inherit !important;
      outline:none !important;
    " />

    <label style="display:block;font-size:11px;font-weight:600;color:#8a8fa8;margin-bottom:8px;">Apply to</label>
    <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:20px;">
      <label style="display:flex;align-items:center;gap:8px;font-size:12px;color:#b0b5cb;cursor:pointer;">
        <input type="radio" name="${PM}-scope" value="domain" checked style="accent-color:#FF3B30;" />
        Entire website (<code style="color:#5bcffa;font-size:11px;">${escHtml(hostname)}</code>)
      </label>
      <label style="display:flex;align-items:center;gap:8px;font-size:12px;color:#b0b5cb;cursor:pointer;">
        <input type="radio" name="${PM}-scope" value="page" style="accent-color:#FF3B30;" />
        This page only
      </label>
    </div>

    <div style="display:flex;gap:8px;">
      <button id="${PM}-confirm-btn" style="
        flex:1 !important;
        background:linear-gradient(135deg,#ff3b30,#d92d22) !important;
        color:#fff !important;
        border:none !important;
        border-radius:8px !important;
        padding:11px !important;
        font-size:13px !important;
        font-weight:700 !important;
        cursor:pointer !important;
        font-family:inherit !important;
        box-shadow:0 3px 12px rgba(255,59,48,0.4) !important;
      ">✓ Mask It</button>
      <button id="${PM}-reselect-btn" style="
        background:#22242e !important;
        color:#8a8fa8 !important;
        border:1px solid #2e3040 !important;
        border-radius:8px !important;
        padding:11px 18px !important;
        font-size:13px !important;
        cursor:pointer !important;
        font-family:inherit !important;
      ">↩ Re-select</button>
    </div>
  `;

  document.body.appendChild(confirmDialog);

  // Stop propagation inside dialog
  confirmDialog.addEventListener('click', (e) => e.stopPropagation());
  confirmDialog.addEventListener('mousedown', (e) => e.stopPropagation());

  // Focus input
  const input = confirmDialog.querySelector(`#${PM}-mask-input`) as HTMLInputElement;
  setTimeout(() => input?.focus(), 50);

  // Confirm button
  confirmDialog.querySelector(`#${PM}-confirm-btn`)?.addEventListener('click', async (e) => {
    e.stopPropagation();
    const maskText = input?.value.trim() || defaultMask;
    const scopeEl = confirmDialog!.querySelector(`input[name="${PM}-scope"]:checked`) as HTMLInputElement;
    const scope = (scopeEl?.value || 'domain') as 'domain' | 'page';

    removeConfirmDialog();
    stopSelection();

    // Create and save the rule
    const rule: PMRule = {
      id: `pm_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      hostname: location.hostname,
      pathname: location.pathname,
      matchScope: scope,
      cssSelector: getCssSelector(el),
      domPath: getDomPath(el),
      originalText: previewText.slice(0, 500),
      maskText,
      createdAt: Date.now(),
      enabled: true,
    };

    console.log('[PM] Saving rule:', rule);

    try {
      await saveRule(rule);
      maskElement(el, rule);
      currentRules.push(rule);
      showToast('✓ Element masked and saved!');
      notifyPopup();
    } catch (err) {
      console.error('[PM] Failed to save rule:', err);
      showToast('❌ Error saving mask rule');
    }
  });

  // Re-select button
  confirmDialog.querySelector(`#${PM}-reselect-btn`)?.addEventListener('click', (e) => {
    e.stopPropagation();
    removeConfirmDialog();
  });

  // Close X
  confirmDialog.querySelector(`#${PM}-close-btn`)?.addEventListener('click', (e) => {
    e.stopPropagation();
    removeConfirmDialog();
    stopSelection();
    notifyPopup();
  });
}

function removeConfirmDialog(): void {
  confirmDialog?.remove();
  confirmDialog = null;
}

// ═══════════════════════════════════════════════════════════════════
// TOAST
// ═══════════════════════════════════════════════════════════════════
function showToast(msg: string): void {
  const toast = document.createElement('div');
  toast.style.cssText = `
    position: fixed !important;
    bottom: 24px !important;
    right: 24px !important;
    z-index: 2147483647 !important;
    background: ${msg.startsWith('❌') ? '#dc2626' : '#10b981'} !important;
    color: #fff !important;
    padding: 12px 20px !important;
    border-radius: 10px !important;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important;
    font-size: 13px !important;
    font-weight: 700 !important;
    box-shadow: 0 4px 20px rgba(0,0,0,0.4) !important;
    pointer-events: none !important;
  `;
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2500);
}

// ═══════════════════════════════════════════════════════════════════
// NOTIFY POPUP
// ═══════════════════════════════════════════════════════════════════
function notifyPopup(): void {
  try {
    if (chrome?.runtime?.id) {
      const activeCount = currentRules.filter((r) => r.enabled).length;
      chrome.runtime.sendMessage({
        type: 'PAGE_STATUS_RESPONSE',
        payload: {
          hostname: location.hostname,
          pathname: location.pathname,
          activeCount,
          totalCount: currentRules.length,
          isPaused: false,
          isSelecting: selectionActive,
          rules: currentRules,
        },
      }).catch(() => {});
    }
  } catch {}
}

// ═══════════════════════════════════════════════════════════════════
// CSS INJECTION (inline)
// ═══════════════════════════════════════════════════════════════════
function injectStyles(): void {
  if (document.getElementById(`${PM}-styles`)) return;
  const style = document.createElement('style');
  style.id = `${PM}-styles`;
  style.textContent = `
    body.pm-selecting,
    body.pm-selecting * {
      cursor: crosshair !important;
    }

    .pm-wrapper {
      display: inline-flex !important;
      align-items: center !important;
      background: #1a1f2e !important;
      border: 1px solid rgba(255,59,48,0.55) !important;
      border-radius: 4px !important;
      padding: 1px 5px 1px 6px !important;
      margin: 0 1px !important;
      vertical-align: baseline !important;
      box-shadow: 0 1px 4px rgba(0,0,0,0.3) !important;
      gap: 3px !important;
    }

    .pm-wrapper[data-pm-revealed="true"] .pm-text {
      color: inherit !important;
      font-weight: inherit !important;
      letter-spacing: normal !important;
      font-family: inherit !important;
    }

    .pm-text {
      display: inline !important;
      color: #e8e9ef !important;
      font-weight: 700 !important;
      letter-spacing: 1px !important;
      user-select: none !important;
      font-family: monospace, sans-serif !important;
      font-size: 0.9em !important;
    }

    .pm-eye {
      background: transparent !important;
      border: none !important;
      color: #606472 !important;
      font-size: 11px !important;
      cursor: pointer !important;
      padding: 0 !important;
      margin: 0 !important;
      line-height: 1 !important;
      opacity: 0 !important;
      transition: opacity 0.15s !important;
      display: inline-flex !important;
      align-items: center !important;
    }

    .pm-wrapper:hover .pm-eye {
      opacity: 1 !important;
    }

    [data-pm-block="true"] {
      position: relative !important;
      overflow: hidden !important;
    }

    [data-pm-block="true"]::after {
      content: attr(data-pm-masktext) !important;
      position: absolute !important;
      inset: 0 !important;
      background: #1a1f2e !important;
      border: 1px solid rgba(255,59,48,0.5) !important;
      color: #e8e9ef !important;
      font-family: monospace !important;
      font-size: 13px !important;
      font-weight: 700 !important;
      letter-spacing: 2px !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      user-select: none !important;
      z-index: 9999 !important;
      border-radius: inherit !important;
    }

    @keyframes pm-slide-in {
      from { top: -50px; opacity: 0; }
      to   { top: 14px;  opacity: 1; }
    }
  `;
  (document.head || document.documentElement).appendChild(style);
}

// ═══════════════════════════════════════════════════════════════════
// UTILITY
// ═══════════════════════════════════════════════════════════════════
function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

// ═══════════════════════════════════════════════════════════════════
// MESSAGE LISTENER
// ═══════════════════════════════════════════════════════════════════
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  console.log('[PM] Message received:', msg.type);

  switch (msg.type) {
    case 'START_MASKING':
      startSelection();
      sendResponse({ success: true });
      break;

    case 'CANCEL_SELECTION':
      stopSelection();
      notifyPopup();
      sendResponse({ success: true });
      break;

    case 'GET_PAGE_STATUS': {
      const activeCount = currentRules.filter((r) => r.enabled).length;
      sendResponse({
        hostname: location.hostname,
        pathname: location.pathname,
        activeCount,
        totalCount: currentRules.length,
        isPaused: false,
        isSelecting: selectionActive,
        rules: currentRules,
      });
      break;
    }

    case 'TEMPORARY_REVEAL': {
      const ruleId = (msg.payload as { ruleId?: string })?.ruleId;
      const rule = currentRules.find((r) => r.id === ruleId);
      if (rule) temporarilyReveal(rule);
      sendResponse({ success: true });
      break;
    }

    case 'REMOVE_RULE': {
      const ruleId = (msg.payload as { ruleId?: string })?.ruleId;
      if (ruleId) {
        unmaskElement(ruleId);
        currentRules = currentRules.filter((r) => r.id !== ruleId);
        notifyPopup();
      }
      sendResponse({ success: true });
      break;
    }

    case 'REAPPLY_MASKS':
    case 'RULES_UPDATED':
      unmaskAll();
      currentRules = [];
      applyAllSavedMasks().then(() => sendResponse({ success: true }));
      return true; // async

    default:
      sendResponse({ success: false });
  }
  return true; // Keep channel open
});

// ═══════════════════════════════════════════════════════════════════
// DOM OBSERVER (for dynamic content)
// ═══════════════════════════════════════════════════════════════════
let observerDebounce: ReturnType<typeof setTimeout> | null = null;
const domObserver = new MutationObserver(() => {
  if (selectionActive) return;
  if (observerDebounce) clearTimeout(observerDebounce);
  observerDebounce = setTimeout(() => {
    // Re-apply any rules whose elements might have newly appeared
    for (const rule of currentRules) {
      if (!rule.enabled) continue;
      if (document.querySelector(`[${ATTR_HOST}="${rule.id}"]`)) continue;
      const el = findElement(rule);
      if (el) {
        console.log('[PM] DOM changed — re-applying rule:', rule.id);
        maskElement(el, rule);
      }
    }
  }, 400);
});

// ═══════════════════════════════════════════════════════════════════
// SPA NAVIGATION DETECTOR
// ═══════════════════════════════════════════════════════════════════
let lastUrl = location.href;
const urlObserver = new MutationObserver(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href;
    console.log('[PM] URL changed → re-applying masks');
    unmaskAll();
    currentRules = [];
    setTimeout(() => applyAllSavedMasks(), 500);
  }
});

// ═══════════════════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════════════════
async function init(): Promise<void> {
  injectStyles();
  await applyAllSavedMasks();

  domObserver.observe(document.body, { childList: true, subtree: true });
  urlObserver.observe(document, { subtree: true, childList: true });
  console.log('[PM] Content script initialized on', location.hostname);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => init());
} else {
  init();
}
