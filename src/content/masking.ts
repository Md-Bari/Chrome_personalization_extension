/**
 * Privacy Mask - Masking Engine
 *
 * Reliable masking implementation supporting both text and element mode:
 * - Uses styled span wrappers for text masking
 * - Uses overlay elements for element masking
 * - Supports temporary reveal (click 👁)
 * - Stores original text for restoration
 */

import { MaskRule } from '../shared/types';
import { UI_PREFIX, WRAPPER_ATTR, HOST_ATTR, OVERLAY_ATTR } from '../shared/constants';

type RevealCallback = (ruleId: string) => void;

const revealTimers = new Map<string, ReturnType<typeof setTimeout>>();

// ─── Public API ────────────────────────────────────────────────────────────────

/**
 * Check whether an element or its children are currently masked.
 */
export function isElementMasked(element: HTMLElement): boolean {
  if (!element) return false;
  if (
    element.hasAttribute(HOST_ATTR) ||
    element.hasAttribute(OVERLAY_ATTR) ||
    element.hasAttribute('data-privacy-masked')
  ) {
    return true;
  }
  if (element.querySelector(`[${WRAPPER_ATTR}], [${OVERLAY_ATTR}], [${HOST_ATTR}], [data-privacy-masked]`)) {
    return true;
  }
  return false;
}

/**
 * Apply a mask rule to the given element.
 */
export function applyMaskRule(
  element: HTMLElement,
  rule: MaskRule,
  onReveal?: RevealCallback
): boolean {
  if (!rule.enabled) return false;

  if (rule.mode === 'element') {
    return applyElementMask(element, rule, onReveal);
  }

  // Text mode
  if (element.hasAttribute(HOST_ATTR) && element.getAttribute(HOST_ATTR) === rule.id) {
    return true;
  }

  element.setAttribute(HOST_ATTR, rule.id);
  element.setAttribute('data-privacy-masked', 'true');

  const masked = maskTextNodes(element, rule, onReveal);
  return masked;
}

/**
 * Remove a specific mask rule from the DOM.
 */
export function removeMaskRule(ruleId: string, root: Document | Element = document): void {
  // Restore text wrappers
  const wrappers = root.querySelectorAll(`[${WRAPPER_ATTR}="${ruleId}"]`);
  wrappers.forEach((wrapper) => {
    const original = wrapper.getAttribute('data-original-text') ?? '';
    const textNode = document.createTextNode(original);
    wrapper.parentNode?.replaceChild(textNode, wrapper);
  });

  // Remove element overlays
  const overlays = root.querySelectorAll(`[${OVERLAY_ATTR}="${ruleId}"]`);
  overlays.forEach((overlay) => {
    overlay.remove();
  });

  // Remove host attributes for this rule
  const hosts = root.querySelectorAll(
    `[${HOST_ATTR}="${ruleId}"], [${OVERLAY_ATTR}="${ruleId}"]`
  );
  hosts.forEach((el) => {
    el.removeAttribute(HOST_ATTR);
    el.removeAttribute(OVERLAY_ATTR);
    el.removeAttribute('data-privacy-masked');
    el.removeAttribute('data-privacy-revealed');
  });

  // Clear reveal timer
  const timer = revealTimers.get(ruleId);
  if (timer !== undefined) {
    clearTimeout(timer);
    revealTimers.delete(ruleId);
  }
}

/**
 * Remove all masks from the DOM.
 */
export function removeAllMasks(root: Document | Element = document): void {
  // Restore all text wrappers
  const wrappers = root.querySelectorAll(`[${WRAPPER_ATTR}]`);
  wrappers.forEach((wrapper) => {
    const original = wrapper.getAttribute('data-original-text') ?? '';
    wrapper.parentNode?.replaceChild(document.createTextNode(original), wrapper);
  });

  // Remove all overlays
  const overlays = root.querySelectorAll(`.${UI_PREFIX}-element-overlay, [${OVERLAY_ATTR}]`);
  overlays.forEach((overlay) => {
    // If it's an overlay element, remove it
    if (overlay.classList.contains(`${UI_PREFIX}-element-overlay`) || overlay.tagName === 'DIV') {
      overlay.remove();
    }
  });

  // Remove all host attributes
  const hosts = root.querySelectorAll(`[${HOST_ATTR}], [${OVERLAY_ATTR}], [data-privacy-masked]`);
  hosts.forEach((el) => {
    el.removeAttribute(HOST_ATTR);
    el.removeAttribute(OVERLAY_ATTR);
    el.removeAttribute('data-privacy-masked');
    el.removeAttribute('data-privacy-revealed');
  });

  // Clear all reveal timers
  for (const timer of revealTimers.values()) clearTimeout(timer);
  revealTimers.clear();
}

/**
 * Temporarily reveal a rule's masked content for `durationSeconds`.
 */
export function temporarilyRevealRule(
  rule: MaskRule,
  durationSeconds: number = 5,
  root: Document | Element = document
): void {
  const { id: ruleId } = rule;

  // Clear existing timer
  const existing = revealTimers.get(ruleId);
  if (existing !== undefined) {
    clearTimeout(existing);
    revealTimers.delete(ruleId);
  }

  // Show original text in wrappers
  const wrappers = root.querySelectorAll(`[${WRAPPER_ATTR}="${ruleId}"]`);
  wrappers.forEach((wrapper) => {
    const original = wrapper.getAttribute('data-original-text') ?? '';
    (wrapper as HTMLElement).setAttribute('data-privacy-revealed', 'true');
    const maskSpan = wrapper.querySelector(`.${UI_PREFIX}-masked-text`);
    if (maskSpan) maskSpan.textContent = original;
  });

  // Element overlays reveal
  const overlays = root.querySelectorAll(`.${UI_PREFIX}-element-overlay[${OVERLAY_ATTR}="${ruleId}"]`);
  overlays.forEach((overlay) => {
    (overlay as HTMLElement).style.display = 'none';
  });

  const timer = setTimeout(() => {
    wrappers.forEach((wrapper) => {
      (wrapper as HTMLElement).removeAttribute('data-privacy-revealed');
      const maskSpan = wrapper.querySelector(`.${UI_PREFIX}-masked-text`);
      if (maskSpan) maskSpan.textContent = rule.maskText || '████';
    });
    overlays.forEach((overlay) => {
      (overlay as HTMLElement).style.display = '';
    });
    revealTimers.delete(ruleId);
  }, durationSeconds * 1000);

  revealTimers.set(ruleId, timer);
}

// ─── Internal Helpers ─────────────────────────────────────────────────────────

function applyElementMask(
  element: HTMLElement,
  rule: MaskRule,
  onReveal?: RevealCallback
): boolean {
  if (element.getAttribute(HOST_ATTR) === rule.id && element.querySelector(`[${OVERLAY_ATTR}="${rule.id}"]`)) {
    return true;
  }

  element.setAttribute(HOST_ATTR, rule.id);
  element.setAttribute('data-privacy-masked', 'true');

  // Avoid duplicate overlays
  let overlay = element.querySelector(`.${UI_PREFIX}-element-overlay[${OVERLAY_ATTR}="${rule.id}"]`);
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = `${UI_PREFIX}-element-overlay`;
    overlay.setAttribute(OVERLAY_ATTR, rule.id);
    overlay.textContent = rule.maskText || '████';

    if (onReveal) {
      const revealBtn = document.createElement('button');
      revealBtn.className = `${UI_PREFIX}-reveal-btn-inline`;
      revealBtn.type = 'button';
      revealBtn.title = 'Reveal temporarily';
      revealBtn.textContent = '👁';
      revealBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        onReveal(rule.id);
      });
      overlay.appendChild(revealBtn);
    }

    element.appendChild(overlay);
  }

  return true;
}

function maskTextNodes(
  element: HTMLElement,
  rule: MaskRule,
  onReveal?: RevealCallback
): boolean {
  // Already masked?
  if (element.querySelector(`[${WRAPPER_ATTR}="${rule.id}"]`)) return true;

  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      // Skip nodes already inside a mask wrapper
      if ((node.parentElement)?.closest(`[${WRAPPER_ATTR}]`)) {
        return NodeFilter.FILTER_REJECT;
      }
      // Skip empty / whitespace-only text nodes
      if (!node.textContent || !node.textContent.trim()) {
        return NodeFilter.FILTER_SKIP;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  const textNodes: Text[] = [];
  let node: Node | null;
  while ((node = walker.nextNode())) {
    textNodes.push(node as Text);
  }

  if (textNodes.length === 0) {
    // No text nodes found — mask the whole element with a block overlay
    applyBlockMask(element, rule, onReveal);
    return true;
  }

  for (const textNode of textNodes) {
    const original = textNode.textContent ?? '';
    const wrapper = createMaskWrapper(rule, original, onReveal);
    textNode.parentNode?.replaceChild(wrapper, textNode);
  }

  return true;
}

function createMaskWrapper(
  rule: MaskRule,
  originalText: string,
  onReveal?: RevealCallback
): HTMLElement {
  const wrapper = document.createElement('span');
  wrapper.className = `${UI_PREFIX}-text-wrapper`;
  wrapper.setAttribute(WRAPPER_ATTR, rule.id);
  wrapper.setAttribute('data-original-text', originalText);

  const masked = document.createElement('span');
  masked.className = `${UI_PREFIX}-masked-text`;
  masked.textContent = rule.maskText || '████';

  const revealBtn = document.createElement('button');
  revealBtn.className = `${UI_PREFIX}-reveal-btn-inline`;
  revealBtn.type = 'button';
  revealBtn.title = 'Reveal temporarily';
  revealBtn.setAttribute('aria-label', 'Reveal masked content');
  revealBtn.textContent = '👁';
  revealBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (onReveal) onReveal(rule.id);
  });

  wrapper.appendChild(masked);
  wrapper.appendChild(revealBtn);
  return wrapper;
}

/**
 * For elements without direct text nodes (e.g. images, inputs), apply a
 * CSS-based block mask overlay via data attribute.
 */
function applyBlockMask(
  element: HTMLElement,
  rule: MaskRule,
  _onReveal?: RevealCallback
): void {
  element.setAttribute('data-privacy-block-masked', 'true');
  element.setAttribute('data-privacy-mask-text', rule.maskText || '████');
}
