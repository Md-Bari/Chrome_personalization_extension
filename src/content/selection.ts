/**
 * Privacy Mask - Selection Mode
 *
 * Handles interactive element/text selection on the page.
 * When active: shows hover highlight, captures click/mouseup to show confirm modal.
 * After confirm: calls onSelect callback with the target element + options.
 */

import { MaskSettings } from '../shared/types';
import { UI_PREFIX, DEFAULT_MASK_TEXT } from '../shared/constants';

type OnSelectCallback = (
  element: HTMLElement,
  maskText: string,
  matchScope: 'domain' | 'page'
) => void;

type OnCancelCallback = () => void;

let isSelectionActive = false;
let currentHoveredElement: HTMLElement | null = null;

let hoverBox: HTMLElement | null = null;
let selectionBanner: HTMLElement | null = null;
let confirmModal: HTMLElement | null = null;

let onSelectCallback: OnSelectCallback | null = null;
let onCancelCallback: OnCancelCallback | null = null;
let activeSettings: MaskSettings | null = null;

// ─── Public API ────────────────────────────────────────────────────────────────

export function startSelectionMode(
  onSelect: OnSelectCallback,
  onCancel?: OnCancelCallback,
  settings?: MaskSettings
): void {
  // Always clean up first if already running
  if (isSelectionActive) {
    cleanupSelectionUI();
  }

  isSelectionActive = true;
  onSelectCallback = onSelect;
  onCancelCallback = onCancel ?? null;
  activeSettings = settings ?? null;
  currentHoveredElement = null;

  document.body.classList.add(`${UI_PREFIX}-selecting-mode`);
  selectionBanner = createSelectionBanner();

  document.addEventListener('mousemove', handleMouseMove, true);
  document.addEventListener('scroll', handleScroll, { capture: true, passive: true });
  document.addEventListener('mouseup', handleMouseUp, true);
  document.addEventListener('click', handleClick, true);
  document.addEventListener('keydown', handleKeyDown, true);
}

export function stopSelectionMode(): void {
  if (!isSelectionActive) return;
  isSelectionActive = false;
  cleanupSelectionUI();
  document.removeEventListener('mousemove', handleMouseMove, true);
  document.removeEventListener('scroll', handleScroll, true);
  document.removeEventListener('mouseup', handleMouseUp, true);
  document.removeEventListener('click', handleClick, true);
  document.removeEventListener('keydown', handleKeyDown, true);
  onSelectCallback = null;
  onCancelCallback = null;
  activeSettings = null;
  currentHoveredElement = null;
}

export function isSelecting(): boolean {
  return isSelectionActive;
}

// ─── UI Helpers ───────────────────────────────────────────────────────────────

function cleanupSelectionUI() {
  document.body.classList.remove(`${UI_PREFIX}-selecting-mode`);
  hideHoverBox();

  if (hoverBox && hoverBox.parentNode) {
    hoverBox.parentNode.removeChild(hoverBox);
    hoverBox = null;
  }
  if (selectionBanner && selectionBanner.parentNode) {
    selectionBanner.parentNode.removeChild(selectionBanner);
    selectionBanner = null;
  }
  closeConfirmModal();
}

function isExtensionUI(el: Element | null): boolean {
  if (!el) return false;
  return !!(
    el.closest(`#${UI_PREFIX}-selection-banner`) ||
    el.closest(`#${UI_PREFIX}-hover-box`) ||
    el.closest(`.${UI_PREFIX}-confirm-modal`) ||
    el.closest(`.${UI_PREFIX}-element-overlay`) ||
    el.closest(`.${UI_PREFIX}-text-wrapper`) ||
    el.classList.contains(`${UI_PREFIX}-selecting-mode`)
  );
}

function getBestTarget(el: Element): HTMLElement | null {
  if (!el || !(el instanceof HTMLElement)) return null;
  if (el.tagName === 'HTML' || el.tagName === 'BODY') return null;
  if (isExtensionUI(el)) return null;

  const tag = el.tagName.toLowerCase();

  // Prefer leaf-ish elements with text directly
  const leafTags = [
    'span', 'p', 'a', 'button', 'strong', 'em', 'b', 'i', 'label',
    'td', 'th', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'code', 'pre', 'input', 'textarea', 'select', 'img', 'svg',
  ];

  if (leafTags.includes(tag)) return el;

  // For divs etc: if they have only text nodes or a single child, drill down
  const children = el.children;
  if (children.length === 1 && children[0] instanceof HTMLElement) {
    const child = getBestTarget(children[0]);
    if (child) return child;
  }

  return el;
}

// ─── Hover Box ────────────────────────────────────────────────────────────────

function ensureHoverBox(): HTMLElement {
  if (!hoverBox) {
    hoverBox = document.createElement('div');
    hoverBox.id = `${UI_PREFIX}-hover-box`;
    document.body.appendChild(hoverBox);
  }
  return hoverBox;
}

function updateHoverBox(el: HTMLElement) {
  if (confirmModal) return;
  const box = ensureHoverBox();
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) {
    box.style.display = 'none';
    return;
  }
  box.style.display = 'block';
  box.style.top = `${rect.top + window.scrollY}px`;
  box.style.left = `${rect.left + window.scrollX}px`;
  box.style.width = `${rect.width}px`;
  box.style.height = `${rect.height}px`;
}

function hideHoverBox() {
  if (hoverBox) hoverBox.style.display = 'none';
}

// ─── Selection Banner ─────────────────────────────────────────────────────────

function createSelectionBanner(): HTMLElement {
  const existing = document.getElementById(`${UI_PREFIX}-selection-banner`);
  if (existing) return existing;

  const banner = document.createElement('div');
  banner.id = `${UI_PREFIX}-selection-banner`;

  const msg = document.createElement('span');
  msg.className = `${UI_PREFIX}-banner-msg`;
  msg.textContent = '🎯 Privacy Mask — hover & click an element, or select text';

  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'Cancel (ESC)';
  cancelBtn.className = `${UI_PREFIX}-banner-cancel-btn`;
  cancelBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (onCancelCallback) onCancelCallback();
    stopSelectionMode();
  });

  banner.appendChild(msg);
  banner.appendChild(cancelBtn);
  document.body.appendChild(banner);
  return banner;
}

// ─── Confirm Modal ────────────────────────────────────────────────────────────

function showConfirmModal(el: HTMLElement, previewText: string) {
  closeConfirmModal();
  hideHoverBox();

  const hostname = window.location.hostname;
  const defaultMask = activeSettings?.defaultMaskText || DEFAULT_MASK_TEXT;
  const preview = previewText.length > 100 ? previewText.slice(0, 97) + '…' : previewText;

  const modal = document.createElement('div');
  modal.className = `${UI_PREFIX}-confirm-modal`;
  modal.innerHTML = `
    <div class="${UI_PREFIX}-modal-header">
      <span>🔒</span>
      <strong>Confirm Mask</strong>
      <span class="${UI_PREFIX}-modal-close" role="button" tabindex="0" title="Cancel">✕</span>
    </div>
    <div class="${UI_PREFIX}-modal-preview-label">Content to mask:</div>
    <div class="${UI_PREFIX}-modal-preview">${escapeHtml(preview)}</div>

    <label class="${UI_PREFIX}-modal-label">Mask replacement text</label>
    <input class="${UI_PREFIX}-modal-input" id="${UI_PREFIX}-mask-text-input" type="text" value="${escapeHtml(defaultMask)}" placeholder="e.g. ████ or ***" />

    <label class="${UI_PREFIX}-modal-label">Apply to</label>
    <div class="${UI_PREFIX}-modal-scope">
      <label><input type="radio" name="${UI_PREFIX}-scope" value="domain" checked /> Entire website (<code>${escapeHtml(hostname)}</code>)</label>
      <label><input type="radio" name="${UI_PREFIX}-scope" value="page" /> This page only</label>
    </div>

    <div class="${UI_PREFIX}-modal-actions">
      <button class="${UI_PREFIX}-btn-confirm" id="${UI_PREFIX}-btn-confirm">✓ Mask It</button>
      <button class="${UI_PREFIX}-btn-reselect" id="${UI_PREFIX}-btn-reselect">↩ Re-select</button>
    </div>
  `;

  document.body.appendChild(modal);
  confirmModal = modal;

  // Focus input
  const input = modal.querySelector(`#${UI_PREFIX}-mask-text-input`) as HTMLInputElement;
  setTimeout(() => input?.focus(), 50);

  // Confirm
  modal.querySelector(`#${UI_PREFIX}-btn-confirm`)?.addEventListener('click', (e) => {
    e.stopPropagation();
    e.preventDefault();
    const maskText = input?.value.trim() || defaultMask;
    const scopeInput = modal.querySelector(`input[name="${UI_PREFIX}-scope"]:checked`) as HTMLInputElement;
    const scope = (scopeInput?.value as 'domain' | 'page') || 'domain';
    const captured = el;
    closeConfirmModal();
    stopSelectionMode();
    if (onSelectCallback) {
      onSelectCallback(captured, maskText, scope);
    }
    showSuccessToast('Element masked successfully!');
  });

  // Re-select
  modal.querySelector(`#${UI_PREFIX}-btn-reselect`)?.addEventListener('click', (e) => {
    e.stopPropagation();
    e.preventDefault();
    closeConfirmModal();
  });

  // Close X
  modal.querySelector(`.${UI_PREFIX}-modal-close`)?.addEventListener('click', (e) => {
    e.stopPropagation();
    e.preventDefault();
    closeConfirmModal();
    if (onCancelCallback) onCancelCallback();
    stopSelectionMode();
  });

  // Prevent clicks inside modal from propagating
  modal.addEventListener('click', (e) => e.stopPropagation());
  modal.addEventListener('mousedown', (e) => e.stopPropagation());
}

function closeConfirmModal() {
  if (confirmModal && confirmModal.parentNode) {
    confirmModal.parentNode.removeChild(confirmModal);
    confirmModal = null;
  }
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function showSuccessToast(msg: string) {
  const toast = document.createElement('div');
  toast.className = `${UI_PREFIX}-toast-success`;
  toast.textContent = `✓ ${msg}`;
  document.body.appendChild(toast);
  setTimeout(() => toast.parentNode?.removeChild(toast), 2500);
}

// ─── Event Handlers ───────────────────────────────────────────────────────────

function handleMouseMove(e: MouseEvent) {
  if (!isSelectionActive || confirmModal) return;

  const el = document.elementFromPoint(e.clientX, e.clientY);
  if (!el || isExtensionUI(el)) return;

  const best = getBestTarget(el);
  if (best && best !== currentHoveredElement) {
    currentHoveredElement = best;
    updateHoverBox(best);
  } else if (!best) {
    currentHoveredElement = null;
    hideHoverBox();
  }
}

function handleScroll() {
  if (!isSelectionActive || !currentHoveredElement || confirmModal) return;
  updateHoverBox(currentHoveredElement);
}

function handleMouseUp(e: MouseEvent) {
  if (!isSelectionActive || confirmModal) return;

  // Check for text selection
  const selection = window.getSelection();
  if (selection && !selection.isCollapsed) {
    const text = selection.toString().trim();
    if (text.length > 0) {
      const range = selection.getRangeAt(0);
      let container: Node | null = range.commonAncestorContainer;
      if (container.nodeType === Node.TEXT_NODE) {
        container = container.parentElement;
      }
      if (container && container instanceof HTMLElement && !isExtensionUI(container)) {
        e.preventDefault();
        e.stopPropagation();
        showConfirmModal(container, text);
      }
    }
  }
}

function handleClick(e: MouseEvent) {
  if (!isSelectionActive) return;

  const target = e.target as Element;
  if (isExtensionUI(target)) return;

  // If there's text selected, let mouseup handle it
  const selection = window.getSelection();
  if (selection && !selection.isCollapsed && selection.toString().trim().length > 0) {
    e.preventDefault();
    e.stopPropagation();
    return;
  }

  e.preventDefault();
  e.stopPropagation();

  if (confirmModal) return; // modal already open

  const best = currentHoveredElement || getBestTarget(target);
  if (!best) return;

  const text = best.textContent?.trim() || `<${best.tagName.toLowerCase()}>`;
  showConfirmModal(best, text);
}

function handleKeyDown(e: KeyboardEvent) {
  if (!isSelectionActive) return;
  if (e.key === 'Escape') {
    e.preventDefault();
    e.stopPropagation();
    if (confirmModal) {
      closeConfirmModal();
    } else {
      if (onCancelCallback) onCancelCallback();
      stopSelectionMode();
    }
  }
}

// ─── Utility ──────────────────────────────────────────────────────────────────

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
