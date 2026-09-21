import { MaskSettings } from './types';

export const DEFAULT_MASK_TEXT = '████';
export const DEFAULT_REVEAL_DURATION_SECONDS = 5;

export const DEFAULT_SETTINGS: MaskSettings = {
  defaultMaskText: DEFAULT_MASK_TEXT,
  revealDurationSeconds: DEFAULT_REVEAL_DURATION_SECONDS,
  autoMaskEnabled: true,
  defaultMatchScope: 'domain',
  isPaused: false,
};

export const STORAGE_KEYS = {
  RULES: 'privacy_mask_rules_v3',
  SETTINGS: 'privacy_mask_settings_v3',
} as const;

export const DYNAMIC_CLASS_PATTERNS: RegExp[] = [
  /^css-[a-zA-Z0-9]+$/i,
  /^sc-[a-zA-Z0-9]+$/i,
  /^hash-[a-zA-Z0-9]+$/i,
  /^_[a-zA-Z0-9]{5,}$/i,
  /^[a-zA-Z0-9]{10,}$/i,
  /^[a-zA-Z0-9]+__[a-zA-Z0-9]{6,}$/i,
  /^style__[a-zA-Z0-9]+$/i,
  /^jsx-[a-zA-Z0-9]+$/i,
  /^svelte-[a-zA-Z0-9]+$/i,
  /^ng-[a-zA-Z0-9]+$/i,
  /^vue-[a-zA-Z0-9]+$/i,
  /^chakra-[a-zA-Z0-9]+$/i,
  /^emotion-[a-zA-Z0-9]+$/i,
];

export const GENERIC_CONTAINER_TAGS = new Set([
  'html',
  'body',
  'main',
  'section',
  'article',
  'aside',
  'header',
  'footer',
  'nav',
  'form',
]);

export const UI_PREFIX = 'privacy-mask';
export const OVERLAY_ATTR = 'data-privacy-mask-overlay-id';
export const WRAPPER_ATTR = 'data-privacy-mask-text-id';
export const HOST_ATTR = 'data-privacy-mask-target-id';
