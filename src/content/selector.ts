import { SelectorInfo } from '../shared/types';
import { DYNAMIC_CLASS_PATTERNS } from '../shared/constants';
import { createTextFingerprint, normalizeText } from './fingerprint';

export function isLikelyStableClass(className: string): boolean {
  if (!className || typeof className !== 'string') return false;
  const trimmed = className.trim();
  if (!trimmed || trimmed.length < 2) return false;

  for (const pattern of DYNAMIC_CLASS_PATTERNS) {
    if (pattern.test(trimmed)) {
      return false;
    }
  }

  if (trimmed.startsWith('privacy-mask')) {
    return false;
  }

  if (/^[0-9a-fA-F]{6,}$/.test(trimmed)) {
    return false;
  }

  if (/\d{4,}/.test(trimmed)) {
    return false;
  }

  return true;
}

export function isStableId(id: string): boolean {
  if (!id || typeof id !== 'string') return false;
  const trimmed = id.trim();
  if (!trimmed) return false;

  if (/^(:r|ember|react-aria|uid-|mui-|chakra-|_)/i.test(trimmed)) {
    return false;
  }
  if (/\d{4,}/.test(trimmed)) {
    return false;
  }
  if (/^[0-9a-fA-F]{8,}$/.test(trimmed)) {
    return false;
  }
  return true;
}

export function getStableAttributes(element: Element): Record<string, string> {
  const result: Record<string, string> = {};
  const attrs = element.attributes;
  if (!attrs) return result;

  const stableDataKeys = ['data-testid', 'data-test', 'data-qa', 'data-cy', 'data-id', 'data-name', 'data-key'];

  for (let i = 0; i < attrs.length; i++) {
    const attr = attrs[i];
    const name = attr.name.toLowerCase();
    const val = attr.value;

    if (!val || val.length > 80) continue;

    if (stableDataKeys.includes(name)) {
      result[name] = val;
    } else if (name.startsWith('data-') && !/\d{4,}/.test(val) && isLikelyStableClass(val)) {
      result[name] = val;
    } else if (['name', 'role', 'aria-label', 'placeholder', 'title', 'type'].includes(name)) {
      result[name] = val;
    }
  }

  return result;
}

export function computeDomPath(element: Element): string {
  const path: string[] = [];
  let curr: Element | null = element;

  while (curr && curr.nodeType === Node.ELEMENT_NODE && curr !== document.documentElement) {
    const tag = curr.tagName.toLowerCase();
    if (curr.id && isStableId(curr.id)) {
      path.unshift(`#${CSS.escape(curr.id)}`);
      break;
    }

    let siblingIndex = 1;
    let sibling = curr.previousElementSibling;
    while (sibling) {
      if (sibling.tagName.toLowerCase() === tag) {
        siblingIndex++;
      }
      sibling = sibling.previousElementSibling;
    }

    const segment = siblingIndex > 1 ? `${tag}:nth-of-type(${siblingIndex})` : tag;
    path.unshift(segment);

    curr = curr.parentElement;
  }

  return path.join(' > ');
}

export async function generateSelector(element: Element): Promise<SelectorInfo> {
  const tagName = element.tagName.toLowerCase();
  const attributes = getStableAttributes(element);
  const path = computeDomPath(element);
  const textContent = (element.textContent || '').trim();
  const textFingerprint = await createTextFingerprint(textContent);

  let id: string | undefined;
  if (element.id && isStableId(element.id)) {
    id = element.id;
  }

  let cssSelector: string;

  if (id) {
    cssSelector = `#${CSS.escape(id)}`;
  } else if (attributes['data-testid']) {
    cssSelector = `[data-testid="${CSS.escape(attributes['data-testid'])}"]`;
  } else if (attributes['data-test']) {
    cssSelector = `[data-test="${CSS.escape(attributes['data-test'])}"]`;
  } else if (attributes['data-qa']) {
    cssSelector = `[data-qa="${CSS.escape(attributes['data-qa'])}"]`;
  } else if (attributes['data-cy']) {
    cssSelector = `[data-cy="${CSS.escape(attributes['data-cy'])}"]`;
  } else if (attributes['name'] && (tagName === 'input' || tagName === 'select' || tagName === 'textarea')) {
    cssSelector = `${tagName}[name="${CSS.escape(attributes['name'])}"]`;
  } else {
    const stableClasses = Array.from(element.classList).filter(isLikelyStableClass);
    if (stableClasses.length > 0) {
      const classSelector = `${tagName}.${stableClasses.map((c) => CSS.escape(c)).join('.')}`;
      if (document.querySelectorAll(classSelector).length === 1) {
        cssSelector = classSelector;
      } else {
        cssSelector = path;
      }
    } else {
      cssSelector = path;
    }
  }

  let nthOfType = 1;
  let sib = element.previousElementSibling;
  while (sib) {
    if (sib.tagName.toLowerCase() === tagName) {
      nthOfType++;
    }
    sib = sib.previousElementSibling;
  }

  return {
    cssSelector,
    id,
    tagName,
    attributes,
    path,
    nthOfType,
    textFingerprint,
    originalText: textContent,
  };
}

export function findElementBySelectorInfo(
  info: SelectorInfo,
  root: Document | Element | ShadowRoot = document
): Element | null {
  if (!info) return null;

  // 1. Try stable ID
  if (info.id) {
    const el = (root as Document).getElementById?.(info.id) || root.querySelector(`#${CSS.escape(info.id)}`);
    if (el) return el;
  }

  // 2. Try primary cssSelector
  if (info.cssSelector) {
    try {
      const el = root.querySelector(info.cssSelector);
      if (el) return el;
    } catch {
      // Ignore invalid selector syntax in fallback
    }
  }

  // 3. Try stable attributes (data-testid, etc.)
  if (info.attributes) {
    for (const [key, value] of Object.entries(info.attributes)) {
      try {
        const el = root.querySelector(`[${key}="${CSS.escape(value)}"]`);
        if (el) return el;
      } catch {
        // continue
      }
    }
  }

  // 4. Try DOM Path
  if (info.path) {
    try {
      const el = root.querySelector(info.path);
      if (el) return el;
    } catch {
      // continue
    }
  }

  // 5. Try Text Content & Text Fingerprint Match across candidate tags
  if (info.tagName) {
    const candidates = Array.from(root.querySelectorAll(info.tagName));
    
    // Exact text match
    if (info.originalText && info.originalText.length > 0) {
      const match = candidates.find((c) => (c.textContent || '').trim() === info.originalText);
      if (match) return match;
    }

    // Normalized text match
    if (info.originalText && info.originalText.length > 0) {
      const normTarget = normalizeText(info.originalText);
      const match = candidates.find((c) => normalizeText(c.textContent || '') === normTarget);
      if (match) return match;
    }

    if (candidates.length > 0 && info.nthOfType && candidates[info.nthOfType - 1]) {
      return candidates[info.nthOfType - 1];
    }
  }

  // 6. Global Text Search fallback across any element
  if (info.originalText && info.originalText.length > 0) {
    const all = Array.from(root.querySelectorAll('h1, h2, h3, h4, h5, h6, span, p, a, div, td, th, li, label, strong, b'));
    const match = all.find((el) => (el.textContent || '').trim() === info.originalText);
    if (match) return match;
  }

  // 7. Support Open Shadow DOM roots
  const allElements = root.querySelectorAll('*');
  for (const el of allElements) {
    if (el.shadowRoot) {
      const shadowMatch = findElementBySelectorInfo(info, el.shadowRoot);
      if (shadowMatch) return shadowMatch;
    }
  }

  return null;
}
