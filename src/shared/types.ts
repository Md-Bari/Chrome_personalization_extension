export type MaskMode = 'element' | 'text';

export type MatchScope = 'page' | 'domain';

export type RuleStatus = 'active' | 'not-found' | 'disabled';

export interface SelectorInfo {
  cssSelector?: string;
  id?: string;
  tagName: string;
  attributes: Record<string, string>;
  path?: string;
  nthOfType?: number;
  textFingerprint?: string;
  originalText?: string;
}

export interface MaskRule {
  id: string;
  hostname: string;
  pathname?: string;
  matchScope: MatchScope;
  mode: MaskMode;
  selector: SelectorInfo;
  textFingerprint?: string;
  maskText: string;
  createdAt: number;
  updatedAt: number;
  enabled: boolean;
  label?: string;
  status?: RuleStatus;
}

export interface MaskSettings {
  defaultMaskText: string;
  revealDurationSeconds: number;
  autoMaskEnabled: boolean;
  defaultMatchScope: MatchScope;
  isPaused: boolean;
}

export interface TextSelectionTarget {
  mode: 'text';
  element: HTMLElement;
  selectedText: string;
  startOffset: number;
  endOffset: number;
  textFingerprint?: string;
}

export interface ElementSelectionTarget {
  mode: 'element';
  element: HTMLElement;
}

export type SelectionTarget = ElementSelectionTarget | TextSelectionTarget;

export interface ConfirmedMaskOptions {
  maskText?: string;
  matchScope?: MatchScope;
  label?: string;
}

export type MessageType =
  | 'START_MASKING'
  | 'CANCEL_SELECTION'
  | 'SELECTION_MODE_CHANGED'
  | 'RULE_CREATED'
  | 'RULES_UPDATED'
  | 'TOGGLE_PAUSE'
  | 'GET_PAGE_STATUS'
  | 'PAGE_STATUS_RESPONSE'
  | 'TEMPORARY_REVEAL'
  | 'REAPPLY_MASKS'
  | 'REMOVE_RULE';

export interface ExtensionMessage<T = unknown> {
  type: MessageType;
  payload?: T;
}

export interface PageStatusPayload {
  hostname: string;
  pathname: string;
  activeCount: number;
  totalCount: number;
  isPaused: boolean;
  isSelecting: boolean;
  rules: MaskRule[];
}
