/**
 * Privacy Mask - Content Script v3
 * Fixed: reveal button, SPA re-masking, error spam, stale rule cleanup
 */

// ═══════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════
const PM         = 'pm';
const ATTR_HOST  = 'data-pm-host';   // on the masked container element
const ATTR_WRAP  = 'data-pm-wrap';   // on each text-wrapper span
const ATTR_ORIG  = 'data-pm-orig';   // original text stored in wrapper
const STORAGE_KEY = 'privacy_mask_rules_v3'; // bumped version to clear old bad rules
const DEFAULT_MASK = '████';
const MAX_RETRIES  = 3;              // give up after 3 failed re-apply attempts

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════
interface PMRule {
  id:          string;
  hostname:    string;
  pathname:    string;
  matchScope:  'domain' | 'page';
  cssSelector: string;
  domPath:     string;
  originalText: string;
  maskText:    string;
  createdAt:   number;
  enabled:     boolean;
}

// ═══════════════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════════════
let currentRules: PMRule[]         = [];
let selectionActive                = false;
let hoveredEl: HTMLElement | null  = null;
let hoverBox: HTMLDivElement | null  = null;
let banner: HTMLDivElement | null    = null;
let confirmDialog: HTMLDivElement | null = null;

// Track how many times each rule failed to find its element
const retryCount = new Map<string, number>();

// ═══════════════════════════════════════════════════════════════════
// STORAGE
// ═══════════════════════════════════════════════════════════════════
function loadAllRules(): Promise<PMRule[]> {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.get([STORAGE_KEY], (result) => {
        if (chrome.runtime.lastError) { resolve([]); return; }
        const r = result[STORAGE_KEY];
        resolve(Array.isArray(r) ? r : []);
      });
    } catch { resolve([]); }
  });
}

async function saveRule(rule: PMRule): Promise<void> {
  const all = await loadAllRules();
  const idx = all.findIndex((r) => r.id === rule.id);
  if (idx >= 0) all[idx] = rule; else all.push(rule);
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ [STORAGE_KEY]: all }, () => {
      if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
      else resolve();
    });
  });
}

async function deleteRule(ruleId: string): Promise<void> {
  const all = await loadAllRules();
  const filtered = all.filter((r) => r.id !== ruleId);
  return new Promise((resolve) => {
    chrome.storage.local.set({ [STORAGE_KEY]: filtered }, () => resolve());
  });
}

function getRulesForPage(): Promise<PMRule[]> {
  return loadAllRules().then((all) => {
    const host = location.hostname.toLowerCase();
    const path = location.pathname;
    return all.filter((r) => {
      const rh = r.hostname.toLowerCase();
      const matches = rh === host || host.endsWith('.' + rh) || rh.endsWith('.' + host);
      if (!matches) return false;
      if (r.matchScope === 'page') return r.pathname === path;
      return true;
    });
  });
}

// ═══════════════════════════════════════════════════════════════════
// SELECTOR HELPERS
// ═══════════════════════════════════════════════════════════════════
function isDynId(id: string): boolean {
  return /^(:r|ember|react-aria|uid-|mui-|\d)/.test(id) || /\d{5,}/.test(id);
}

function getDomPath(el: Element): string {
  const parts: string[] = [];
  let curr: Element | null = el;
  while (curr && curr !== document.body && curr !== document.documentElement) {
    if (curr.id && !isDynId(curr.id)) { parts.unshift(`#${CSS.escape(curr.id)}`); break; }
    const parent = curr.parentElement;
    if (!parent) break;
    const sibs = Array.from(parent.children).filter((c) => c.tagName === curr!.tagName);
    const idx = sibs.indexOf(curr) + 1;
    parts.unshift(sibs.length > 1 ? `${curr.tagName.toLowerCase()}:nth-of-type(${idx})` : curr.tagName.toLowerCase());
    curr = parent;
  }
  return parts.join(' > ');
}

function getCssSelector(el: Element): string {
  if (el.id && !isDynId(el.id)) return `#${CSS.escape(el.id)}`;
  for (const attr of ['data-testid', 'data-test', 'data-qa', 'data-cy']) {
    const v = el.getAttribute(attr);
    if (v) return `[${attr}="${CSS.escape(v)}"]`;
  }
  return getDomPath(el);
}

// ═══════════════════════════════════════════════════════════════════
// FIND ELEMENT (multi-strategy)
// ═══════════════════════════════════════════════════════════════════
function findElement(rule: PMRule): HTMLElement | null {
  // 1. CSS selector
  try {
    const el = document.querySelector<HTMLElement>(rule.cssSelector);
    if (el) return el;
  } catch {}

  // 2. DOM path
  if (rule.domPath && rule.domPath !== rule.cssSelector) {
    try {
      const el = document.querySelector<HTMLElement>(rule.domPath);
      if (el) return el;
    } catch {}
  }

  // 3. Exact text match across common text elements
  if (rule.originalText && rule.originalText.trim().length > 0) {
    const trimmed = rule.originalText.trim();
    const candidates = document.querySelectorAll<HTMLElement>(
      'span,p,td,th,div,h1,h2,h3,h4,h5,h6,li,label,strong,b,a,em,code'
    );
    for (const c of candidates) {
      if (!c.querySelector('[data-pm-wrap]') && (c.textContent || '').trim() === trimmed) {
        return c;
      }
    }
    // 4. Partial / contains match for longer text
    if (trimmed.length > 15) {
      for (const c of candidates) {
        if (!c.querySelector('[data-pm-wrap]') && (c.textContent || '').includes(trimmed)) {
          return c;
        }
      }
    }
  }

  return null;
}

// ═══════════════════════════════════════════════════════════════════
// MASKING ENGINE
// ═══════════════════════════════════════════════════════════════════
const revealTimers = new Map<string, ReturnType<typeof setTimeout>>();

function getTextNodes(root: HTMLElement): Text[] {
  const result: Text[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      // Skip nodes already inside a mask wrapper
      if ((node.parentElement)?.closest(`[${ATTR_WRAP}]`)) return NodeFilter.FILTER_REJECT;
      if (!(node.textContent || '').trim()) return NodeFilter.FILTER_SKIP;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  let n: Node | null;
  while ((n = walker.nextNode())) result.push(n as Text);
  return result;
}

function maskElement(el: HTMLElement, rule: PMRule): boolean {
  // Already masked for this exact rule → skip
  if (el.getAttribute(ATTR_HOST) === rule.id) return true;

  // If element was masked by a different rule, unmask first
  const prevId = el.getAttribute(ATTR_HOST);
  if (prevId) unmaskByRuleId(prevId);

  el.setAttribute(ATTR_HOST, rule.id);

  const textNodes = getTextNodes(el);

  if (textNodes.length === 0) {
    // Non-text element: CSS block mask via pseudo-element
    el.setAttribute('data-pm-block', 'true');
    el.setAttribute('data-pm-masktext', rule.maskText || DEFAULT_MASK);
    return true;
  }

  for (const tn of textNodes) {
    const orig = tn.textContent ?? '';
    if (!orig.trim()) continue;

    const wrapper = document.createElement('span');
    wrapper.className = `${PM}-wrapper`;
    wrapper.setAttribute(ATTR_WRAP, rule.id);
    wrapper.setAttribute(ATTR_ORIG, orig);

    const maskedSpan = document.createElement('span');
    maskedSpan.className = `${PM}-text`;
    maskedSpan.setAttribute('aria-hidden', 'true');
    maskedSpan.textContent = rule.maskText || DEFAULT_MASK;

    // Reveal button — captures rule.id and rule.maskText in closure
    const eye = document.createElement('button');
    eye.className = `${PM}-eye`;
    eye.type = 'button';
    eye.title = 'Reveal temporarily';
    eye.textContent = '👁';
    eye.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      temporarilyReveal(rule.id, rule.maskText || DEFAULT_MASK);
    });

    wrapper.appendChild(maskedSpan);
    wrapper.appendChild(eye);
    tn.parentNode?.replaceChild(wrapper, tn);
  }

  return true;
}

function unmaskByRuleId(ruleId: string): void {
  document.querySelectorAll(`[${ATTR_WRAP}="${ruleId}"]`).forEach((w) => {
    const orig = w.getAttribute(ATTR_ORIG) ?? '';
    w.parentNode?.replaceChild(document.createTextNode(orig), w);
  });
  document.querySelectorAll(`[${ATTR_HOST}="${ruleId}"]`).forEach((el) => {
    el.removeAttribute(ATTR_HOST);
    el.removeAttribute('data-pm-block');
    el.removeAttribute('data-pm-masktext');
  });
  const t = revealTimers.get(ruleId);
  if (t) { clearTimeout(t); revealTimers.delete(ruleId); }
}

function unmaskAll(): void {
  document.querySelectorAll(`[${ATTR_WRAP}]`).forEach((w) => {
    w.parentNode?.replaceChild(document.createTextNode(w.getAttribute(ATTR_ORIG) ?? ''), w);
  });
  document.querySelectorAll(`[${ATTR_HOST}]`).forEach((el) => {
    el.removeAttribute(ATTR_HOST);
    el.removeAttribute('data-pm-block');
    el.removeAttribute('data-pm-masktext');
  });
  revealTimers.forEach(clearTimeout);
  revealTimers.clear();
}

/**
 * Temporarily show original text for `durationSecs` seconds.
 * Supports text wrappers and block elements. Toggle behavior if already revealed.
 */
function temporarilyReveal(ruleId: string, maskText: string, durationSecs = 5): void {
  const existing = revealTimers.get(ruleId);
  const wrappers = document.querySelectorAll<HTMLElement>(`[${ATTR_WRAP}="${ruleId}"]`);
  const blockHosts = document.querySelectorAll<HTMLElement>(`[${ATTR_HOST}="${ruleId}"][data-pm-block="true"], [${ATTR_HOST}="${ruleId}"][data-pm-revealed="true"]`);

  // If already revealed, toggle back immediately
  if (existing) {
    clearTimeout(existing);
    revealTimers.delete(ruleId);

    wrappers.forEach((wrapper) => {
      const span = wrapper.querySelector<HTMLElement>(`.${PM}-text`);
      if (span) {
        span.textContent = maskText;
        span.removeAttribute('style');
      }
      wrapper.removeAttribute('data-pm-revealed');
    });

    blockHosts.forEach((host) => {
      host.setAttribute('data-pm-block', 'true');
      host.removeAttribute('data-pm-revealed');
    });
    return;
  }

  // Reveal text wrappers
  wrappers.forEach((wrapper) => {
    const orig = wrapper.getAttribute(ATTR_ORIG) ?? '';
    const span = wrapper.querySelector<HTMLElement>(`.${PM}-text`);
    if (span) {
      span.textContent = orig;
      span.style.cssText = 'letter-spacing:normal!important;color:#10b981!important;font-weight:inherit!important;font-family:inherit!important;background:rgba(16,185,129,0.15)!important;padding:0 2px!important;border-radius:2px!important;';
    }
    wrapper.setAttribute('data-pm-revealed', 'true');
  });

  // Reveal block hosts
  blockHosts.forEach((host) => {
    host.removeAttribute('data-pm-block');
    host.setAttribute('data-pm-revealed', 'true');
  });

  const timer = setTimeout(() => {
    document.querySelectorAll<HTMLElement>(`[${ATTR_WRAP}="${ruleId}"]`).forEach((wrapper) => {
      const span = wrapper.querySelector<HTMLElement>(`.${PM}-text`);
      if (span) {
        span.textContent = maskText;
        span.removeAttribute('style');
      }
      wrapper.removeAttribute('data-pm-revealed');
    });

    document.querySelectorAll<HTMLElement>(`[${ATTR_HOST}="${ruleId}"][data-pm-revealed="true"]`).forEach((host) => {
      host.setAttribute('data-pm-block', 'true');
      host.removeAttribute('data-pm-revealed');
    });

    revealTimers.delete(ruleId);
  }, durationSecs * 1000);

  revealTimers.set(ruleId, timer);
}

// ═══════════════════════════════════════════════════════════════════
// APPLY SAVED MASKS
// ═══════════════════════════════════════════════════════════════════
let applyPending = false;

async function applyAllSavedMasks(): Promise<void> {
  if (applyPending) return;
  applyPending = true;
  try {
    currentRules = await getRulesForPage();

    for (const rule of currentRules) {
      if (!rule.enabled) continue;

      // Already applied?
      if (document.querySelector(`[${ATTR_HOST}="${rule.id}"]`)) continue;

      // Check retry limit — stop trying rules that keep failing
      const tries = retryCount.get(rule.id) ?? 0;
      if (tries >= MAX_RETRIES) continue; // silently skip

      const el = findElement(rule);
      if (el) {
        maskElement(el, rule);
        retryCount.delete(rule.id); // reset on success
      } else {
        retryCount.set(rule.id, tries + 1);
        // Only log once (on first failure)
        if (tries === 0) {
          console.warn(`[PM] Element not found for rule ${rule.id} (selector: "${rule.cssSelector}"). Will retry ${MAX_RETRIES - 1} more times.`);
        }
      }
    }

    notifyPopup();
  } finally {
    applyPending = false;
  }
}

// ═══════════════════════════════════════════════════════════════════
// SELECTION MODE
// ═══════════════════════════════════════════════════════════════════
function startSelection(): void {
  if (selectionActive) stopSelection();
  selectionActive = true;
  hoveredEl = null;
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
    el.closest(`.${PM}-wrapper`) ||
    el.classList?.contains(`${PM}-wrapper`)
  );
}

function getBestEl(target: Element): HTMLElement | null {
  if (!(target instanceof HTMLElement)) return null;
  if (target.tagName === 'HTML' || target.tagName === 'BODY') return null;
  if (isOurUI(target)) return null;
  const tag = target.tagName.toLowerCase();
  const directTags = ['span','p','a','button','strong','em','b','i','label',
    'td','th','li','h1','h2','h3','h4','h5','h6','code','pre'];
  if (directTags.includes(tag)) return target;
  if (target.children.length === 1 && target.children[0] instanceof HTMLElement) {
    return getBestEl(target.children[0]) || target;
  }
  return target;
}

// ── Event Handlers ──────────────────────────────────────────────
function onMouseMove(e: MouseEvent): void {
  if (!selectionActive || confirmDialog) return;
  const under = document.elementFromPoint(e.clientX, e.clientY);
  if (!under || isOurUI(under)) return;
  const best = getBestEl(under);
  if (best && best !== hoveredEl) { hoveredEl = best; showHoverBox(best); }
  else if (!best) { hoveredEl = null; removeHoverBox(); }
}

function onScroll(): void {
  if (hoveredEl && !confirmDialog) showHoverBox(hoveredEl);
}

function onMouseUp(e: MouseEvent): void {
  if (!selectionActive || confirmDialog) return;
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed) return;
  const text = sel.toString().trim();
  if (!text) return;
  const range = sel.getRangeAt(0);
  let container: Node | null = range.commonAncestorContainer;
  if (container.nodeType === Node.TEXT_NODE) container = container.parentElement;
  if (container instanceof HTMLElement && !isOurUI(container)) {
    e.stopPropagation();
    showConfirm(container, text);
  }
}

function onClick(e: MouseEvent): void {
  if (!selectionActive) return;
  const target = e.target as Element;
  if (isOurUI(target)) return;
  const sel = window.getSelection();
  if (sel && !sel.isCollapsed && sel.toString().trim()) {
    e.preventDefault(); e.stopPropagation(); return;
  }
  e.preventDefault(); e.stopPropagation();
  if (confirmDialog) return;
  const el = hoveredEl || getBestEl(target);
  if (!el) return;
  showConfirm(el, el.textContent?.trim() || `<${el.tagName.toLowerCase()}>`);
}

function onKeyDown(e: KeyboardEvent): void {
  if (e.key !== 'Escape') return;
  e.preventDefault(); e.stopPropagation();
  if (confirmDialog) removeConfirmDialog();
  else { stopSelection(); notifyPopup(); }
}

// ── Hover Box ──────────────────────────────────────────────────
function showHoverBox(el: HTMLElement): void {
  if (!hoverBox) {
    hoverBox = document.createElement('div');
    hoverBox.id = `${PM}-hover-box`;
    document.body.appendChild(hoverBox);
  }
  const r = el.getBoundingClientRect();
  hoverBox.style.cssText = `
    position:fixed!important;top:${r.top}px!important;left:${r.left}px!important;
    width:${r.width}px!important;height:${r.height}px!important;
    display:block!important;pointer-events:none!important;
    z-index:2147483645!important;box-sizing:border-box!important;
    border:2px solid #FF3B30!important;background:rgba(255,59,48,.1)!important;
    border-radius:3px!important;outline:2px dashed rgba(255,59,48,.4)!important;
    outline-offset:2px!important;
  `;
}

function removeHoverBox(): void { hoverBox?.remove(); hoverBox = null; }

// ── Banner ──────────────────────────────────────────────────────
function showBanner(): void {
  if (document.getElementById(`${PM}-banner`)) return;
  banner = document.createElement('div');
  banner.id = `${PM}-banner`;
  banner.style.cssText = `
    position:fixed!important;top:14px!important;left:50%!important;
    transform:translateX(-50%)!important;z-index:2147483647!important;
    background:#18191f!important;color:#fff!important;
    border:1.5px solid #FF3B30!important;border-radius:100px!important;
    padding:9px 20px!important;display:flex!important;align-items:center!important;
    gap:14px!important;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif!important;
    font-size:13px!important;font-weight:600!important;
    box-shadow:0 4px 24px rgba(255,59,48,.4),0 2px 10px rgba(0,0,0,.5)!important;
    white-space:nowrap!important;pointer-events:auto!important;
  `;
  banner.innerHTML = `
    <span>🎯 Privacy Mask — hover an element and click to mask it</span>
    <button id="${PM}-cancel-btn" style="background:rgba(255,59,48,.15)!important;color:#ff5247!important;
      border:1px solid rgba(255,59,48,.5)!important;border-radius:100px!important;
      padding:4px 14px!important;font-size:11px!important;font-weight:700!important;
      cursor:pointer!important;font-family:inherit!important;">Cancel (ESC)</button>
  `;
  document.body.appendChild(banner);
  banner.querySelector(`#${PM}-cancel-btn`)?.addEventListener('click', (e) => {
    e.stopPropagation();
    stopSelection();
    notifyPopup();
  });
}

function removeBanner(): void { banner?.remove(); banner = null; }

// ── Confirm Dialog ──────────────────────────────────────────────
function showConfirm(el: HTMLElement, previewText: string): void {
  removeConfirmDialog();
  removeHoverBox();

  const display = previewText.length > 120 ? previewText.slice(0, 117) + '…' : previewText;

  confirmDialog = document.createElement('div');
  confirmDialog.className = `${PM}-confirm-dialog`;
  confirmDialog.style.cssText = `
    position:fixed!important;top:50%!important;left:50%!important;
    transform:translate(-50%,-50%)!important;z-index:2147483647!important;
    background:#1a1b22!important;color:#e8e9ef!important;
    border:1px solid #2e3040!important;border-radius:14px!important;
    padding:24px!important;width:370px!important;max-width:92vw!important;
    box-sizing:border-box!important;
    box-shadow:0 24px 60px rgba(0,0,0,.8),0 0 0 1px rgba(255,59,48,.15)!important;
    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif!important;
  `;

  const escH = (s: string) => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#039;');

  confirmDialog.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;">
      <span style="font-size:16px;">🔒</span>
      <strong style="font-size:15px;color:#fff;flex:1;">Confirm Mask</strong>
      <span id="${PM}-dlg-close" style="cursor:pointer;color:#606472;font-size:18px;padding:2px 6px;" title="Cancel">✕</span>
    </div>

    <div style="font-size:11px;font-weight:600;color:#787c8e;text-transform:uppercase;letter-spacing:.6px;margin-bottom:6px;">Content to mask</div>
    <div style="background:#12131a;border:1px solid #272936;border-radius:8px;padding:10px 12px;
      font-family:monospace;font-size:12px;color:#5bcffa;max-height:80px;overflow-y:auto;
      word-break:break-all;margin-bottom:16px;">${escH(display)}</div>

    <label style="display:block;font-size:11px;font-weight:600;color:#8a8fa8;margin-bottom:5px;">Mask replacement text</label>
    <input id="${PM}-mask-input" type="text" value="${escH(DEFAULT_MASK)}"
      style="width:100%!important;background:#12131a!important;border:1.5px solid #2b2d3d!important;
      border-radius:8px!important;color:#e8e9ef!important;padding:9px 12px!important;
      font-size:13px!important;box-sizing:border-box!important;margin-bottom:14px!important;
      font-family:inherit!important;outline:none!important;" />

    <label style="display:block;font-size:11px;font-weight:600;color:#8a8fa8;margin-bottom:8px;">Apply to</label>
    <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:20px;">
      <label style="display:flex;align-items:center;gap:8px;font-size:12px;color:#b0b5cb;cursor:pointer;">
        <input type="radio" name="${PM}-scope" value="domain" checked style="accent-color:#FF3B30;" />
        Entire website (<code style="color:#5bcffa;font-size:11px;">${escH(location.hostname)}</code>)
      </label>
      <label style="display:flex;align-items:center;gap:8px;font-size:12px;color:#b0b5cb;cursor:pointer;">
        <input type="radio" name="${PM}-scope" value="page" style="accent-color:#FF3B30;" />
        This page only
      </label>
    </div>

    <div style="display:flex;gap:8px;">
      <button id="${PM}-dlg-confirm" style="flex:1!important;background:linear-gradient(135deg,#ff3b30,#d92d22)!important;
        color:#fff!important;border:none!important;border-radius:8px!important;padding:11px!important;
        font-size:13px!important;font-weight:700!important;cursor:pointer!important;font-family:inherit!important;
        box-shadow:0 3px 12px rgba(255,59,48,.4)!important;">✓ Mask It</button>
      <button id="${PM}-dlg-reselect" style="background:#22242e!important;color:#8a8fa8!important;
        border:1px solid #2e3040!important;border-radius:8px!important;padding:11px 18px!important;
        font-size:13px!important;cursor:pointer!important;font-family:inherit!important;">↩ Re-select</button>
    </div>
  `;

  document.body.appendChild(confirmDialog);

  // Prevent event propagation inside dialog
  confirmDialog.addEventListener('click',     (e) => e.stopPropagation());
  confirmDialog.addEventListener('mousedown', (e) => e.stopPropagation());
  confirmDialog.addEventListener('mouseup',   (e) => e.stopPropagation());

  const input = confirmDialog.querySelector<HTMLInputElement>(`#${PM}-mask-input`);
  setTimeout(() => input?.focus(), 60);

  // ── Confirm ──
  confirmDialog.querySelector(`#${PM}-dlg-confirm`)?.addEventListener('click', async (e) => {
    e.stopPropagation();
    const maskText  = input?.value.trim() || DEFAULT_MASK;
    const scopeEl   = confirmDialog!.querySelector<HTMLInputElement>(`input[name="${PM}-scope"]:checked`);
    const scope     = (scopeEl?.value ?? 'domain') as 'domain' | 'page';
    const captured  = el;

    removeConfirmDialog();
    stopSelection();

    const cssSel = getCssSelector(captured);
    const domP = getDomPath(captured);
    const rule: PMRule & { mode?: string; selector?: object; updatedAt?: number } = {
      id:           `pm_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      hostname:     location.hostname,
      pathname:     location.pathname,
      matchScope:   scope,
      mode:         'text',
      cssSelector:  cssSel,
      domPath:      domP,
      selector: {
        cssSelector: cssSel,
        path: domP,
        tagName: captured.tagName.toLowerCase(),
      },
      originalText: previewText.slice(0, 500),
      maskText,
      createdAt:    Date.now(),
      updatedAt:    Date.now(),
      enabled:      true,
    };

    try {
      await saveRule(rule);
      maskElement(captured, rule);
      currentRules.push(rule);
      retryCount.delete(rule.id);
      showToast('✓ Masked & saved!');
      notifyPopup();
    } catch (err) {
      console.error('[PM] Save failed:', err);
      showToast('❌ Error saving — check console');
    }
  });

  // ── Re-select ──
  confirmDialog.querySelector(`#${PM}-dlg-reselect`)?.addEventListener('click', (e) => {
    e.stopPropagation();
    removeConfirmDialog();
  });

  // ── Close X ──
  confirmDialog.querySelector(`#${PM}-dlg-close`)?.addEventListener('click', (e) => {
    e.stopPropagation();
    removeConfirmDialog();
    stopSelection();
    notifyPopup();
  });
}

function removeConfirmDialog(): void { confirmDialog?.remove(); confirmDialog = null; }

// ═══════════════════════════════════════════════════════════════════
// TOAST
// ═══════════════════════════════════════════════════════════════════
function showToast(msg: string): void {
  const t = document.createElement('div');
  const ok = !msg.startsWith('❌');
  t.style.cssText = `
    position:fixed!important;bottom:24px!important;right:24px!important;
    z-index:2147483647!important;background:${ok ? '#10b981' : '#dc2626'}!important;
    color:#fff!important;padding:12px 20px!important;border-radius:10px!important;
    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif!important;
    font-size:13px!important;font-weight:700!important;
    box-shadow:0 4px 20px rgba(0,0,0,.4)!important;pointer-events:none!important;
  `;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2500);
}

// ═══════════════════════════════════════════════════════════════════
// NOTIFY POPUP
// ═══════════════════════════════════════════════════════════════════
function notifyPopup(): void {
  try {
    if (chrome?.runtime?.id) {
      const active = currentRules.filter((r) => r.enabled).length;
      chrome.runtime.sendMessage({
        type: 'PAGE_STATUS_RESPONSE',
        payload: {
          hostname: location.hostname,
          pathname: location.pathname,
          activeCount: active,
          totalCount:  currentRules.length,
          isPaused:    false,
          isSelecting: selectionActive,
          rules:       currentRules,
        },
      }).catch(() => {});
    }
  } catch {}
}

// ═══════════════════════════════════════════════════════════════════
// INLINE STYLES (injected once into <head>)
// ═══════════════════════════════════════════════════════════════════
function injectStyles(): void {
  if (document.getElementById(`${PM}-styles`)) return;
  const s = document.createElement('style');
  s.id = `${PM}-styles`;
  s.textContent = `
    body.pm-selecting, body.pm-selecting * { cursor:crosshair!important; }

    .pm-wrapper {
      display:inline-flex!important;align-items:center!important;
      background:transparent!important;border:none!important;
      border-radius:0!important;padding:0!important;
      margin:0!important;vertical-align:baseline!important;
      box-shadow:none!important;gap:2px!important;
      position:relative!important;
    }
    .pm-wrapper[data-pm-revealed="true"] .pm-text {
      color:inherit!important;font-weight:inherit!important;
      letter-spacing:normal!important;font-family:inherit!important;
      background:transparent!important;
    }
    .pm-text {
      display:inline!important;color:inherit!important;font-weight:inherit!important;
      letter-spacing:normal!important;user-select:none!important;
      font-family:inherit!important;font-size:inherit!important;
    }
    .pm-eye {
      background:transparent!important;border:none!important;color:inherit!important;
      font-size:11px!important;cursor:pointer!important;padding:0 2px!important;
      margin:0!important;line-height:1!important;opacity:0!important;
      transition:opacity .15s!important;display:inline-flex!important;
      align-items:center!important;flex-shrink:0!important;
    }
    .pm-wrapper:hover .pm-eye { opacity:0.75!important; }
    .pm-eye:hover { opacity:1!important; }

    [data-pm-block="true"] { position:relative!important; }
    [data-pm-block="true"]::after {
      content:attr(data-pm-masktext)!important;position:absolute!important;
      inset:0!important;background:inherit!important;
      border:none!important;color:inherit!important;
      font-family:inherit!important;font-size:inherit!important;font-weight:inherit!important;
      letter-spacing:normal!important;display:flex!important;align-items:center!important;
      justify-content:center!important;user-select:none!important;
      z-index:9999!important;border-radius:inherit!important;
    }
  `;
  (document.head || document.documentElement).appendChild(s);
}

// ═══════════════════════════════════════════════════════════════════
// MESSAGE LISTENER
// ═══════════════════════════════════════════════════════════════════
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
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
      const active = currentRules.filter((r) => r.enabled).length;
      sendResponse({
        hostname:    location.hostname,
        pathname:    location.pathname,
        activeCount: active,
        totalCount:  currentRules.length,
        isPaused:    false,
        isSelecting: selectionActive,
        rules:       currentRules,
      });
      break;
    }

    case 'TEMPORARY_REVEAL': {
      const ruleId = (msg.payload as { ruleId?: string })?.ruleId;
      const rule   = currentRules.find((r) => r.id === ruleId);
      if (rule) temporarilyReveal(rule.id, rule.maskText || DEFAULT_MASK);
      sendResponse({ success: !!rule });
      break;
    }

    case 'REMOVE_RULE': {
      const ruleId = (msg.payload as { ruleId?: string })?.ruleId;
      if (ruleId) {
        unmaskByRuleId(ruleId);
        currentRules = currentRules.filter((r) => r.id !== ruleId);
        retryCount.delete(ruleId);
        notifyPopup();
      }
      sendResponse({ success: true });
      break;
    }

    case 'REAPPLY_MASKS':
    case 'RULES_UPDATED':
      unmaskAll();
      currentRules = [];
      retryCount.clear();
      applyAllSavedMasks().then(() => sendResponse({ success: true }));
      return true;

    default:
      sendResponse({ success: false });
  }
  return true;
});

// ═══════════════════════════════════════════════════════════════════
// DOM OBSERVER — re-applies masks when new content appears
// ═══════════════════════════════════════════════════════════════════
let observerTimer: ReturnType<typeof setTimeout> | null = null;

const domObserver = new MutationObserver(() => {
  if (selectionActive || currentRules.length === 0) return;
  if (observerTimer) clearTimeout(observerTimer);
  observerTimer = setTimeout(async () => {
    for (const rule of currentRules) {
      if (!rule.enabled) continue;
      if (document.querySelector(`[${ATTR_HOST}="${rule.id}"]`)) continue;
      const tries = retryCount.get(rule.id) ?? 0;
      if (tries >= MAX_RETRIES) continue;
      const el = findElement(rule);
      if (el) {
        maskElement(el, rule);
        retryCount.delete(rule.id);
      } else {
        retryCount.set(rule.id, tries + 1);
      }
    }
  }, 500);
});

// ═══════════════════════════════════════════════════════════════════
// SPA URL CHANGE DETECTOR
// ═══════════════════════════════════════════════════════════════════
let lastUrl = location.href;

const urlObserver = new MutationObserver(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href;
    unmaskAll();
    currentRules = [];
    retryCount.clear();
    // Wait for SPA to finish rendering
    setTimeout(() => applyAllSavedMasks(), 700);
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

  // Listen for storage changes from Popup or Options to re-apply masks instantly
  if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'local' && changes[STORAGE_KEY]) {
        unmaskAll();
        currentRules = [];
        retryCount.clear();
        applyAllSavedMasks();
      }
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => init());
} else {
  init();
}
