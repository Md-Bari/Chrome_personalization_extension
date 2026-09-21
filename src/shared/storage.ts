import { MaskRule, MaskSettings } from './types';
import { STORAGE_KEYS, DEFAULT_SETTINGS } from './constants';

const memoryStore: { rules: MaskRule[]; settings: MaskSettings } = {
  rules: [],
  settings: { ...DEFAULT_SETTINGS },
};

function hasChromeStorage(): boolean {
  return typeof chrome !== 'undefined' && !!chrome?.storage?.local;
}

export async function getMaskRules(): Promise<MaskRule[]> {
  if (!hasChromeStorage()) {
    return memoryStore.rules;
  }
  return new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEYS.RULES], (result) => {
      if (chrome.runtime.lastError) {
        console.error('PrivacyMask: Error reading rules:', chrome.runtime.lastError);
        resolve([]);
        return;
      }
      resolve((result[STORAGE_KEYS.RULES] as MaskRule[]) || []);
    });
  });
}

export async function saveMaskRule(rule: MaskRule): Promise<void> {
  const rules = await getMaskRules();
  const existingIdx = rules.findIndex((r) => r.id === rule.id);
  if (existingIdx >= 0) {
    rules[existingIdx] = rule;
  } else {
    rules.push(rule);
  }

  if (!hasChromeStorage()) {
    memoryStore.rules = rules;
    return;
  }

  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ [STORAGE_KEYS.RULES]: rules }, () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve();
      }
    });
  });
}

export async function updateMaskRule(
  ruleId: string,
  updates: Partial<Omit<MaskRule, 'id'>>
): Promise<MaskRule | null> {
  const rules = await getMaskRules();
  const index = rules.findIndex((r) => r.id === ruleId);
  if (index === -1) return null;

  rules[index] = {
    ...rules[index],
    ...updates,
    updatedAt: Date.now(),
  };

  if (!hasChromeStorage()) {
    memoryStore.rules = rules;
    return rules[index];
  }

  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ [STORAGE_KEYS.RULES]: rules }, () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(rules[index]);
      }
    });
  });
}

export async function deleteMaskRule(ruleId: string): Promise<boolean> {
  const rules = await getMaskRules();
  const filtered = rules.filter((r) => r.id !== ruleId);
  if (filtered.length === rules.length) return false;

  if (!hasChromeStorage()) {
    memoryStore.rules = filtered;
    return true;
  }

  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ [STORAGE_KEYS.RULES]: filtered }, () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(true);
      }
    });
  });
}

export async function clearMaskRules(): Promise<void> {
  if (!hasChromeStorage()) {
    memoryStore.rules = [];
    return;
  }

  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ [STORAGE_KEYS.RULES]: [] }, () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve();
      }
    });
  });
}

export async function getRulesForSite(
  hostname: string,
  pathname?: string
): Promise<MaskRule[]> {
  const rules = await getMaskRules();
  const normHost = (hostname || '').toLowerCase();

  return rules.filter((r) => {
    const ruleHost = (r.hostname || '').toLowerCase();
    if (
      ruleHost !== normHost &&
      !normHost.endsWith('.' + ruleHost) &&
      !ruleHost.endsWith('.' + normHost)
    ) {
      return false;
    }
    if (r.matchScope === 'page' && pathname && r.pathname) {
      return r.pathname === pathname;
    }
    return true;
  });
}

export async function getSettings(): Promise<MaskSettings> {
  if (!hasChromeStorage()) {
    return memoryStore.settings;
  }

  return new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEYS.SETTINGS], (result) => {
      if (chrome.runtime.lastError) {
        console.error('PrivacyMask: Error reading settings:', chrome.runtime.lastError);
        resolve({ ...DEFAULT_SETTINGS });
        return;
      }
      resolve({
        ...DEFAULT_SETTINGS,
        ...(result[STORAGE_KEYS.SETTINGS] as Partial<MaskSettings>),
      });
    });
  });
}

export async function saveSettings(settings: Partial<MaskSettings>): Promise<MaskSettings> {
  const current = await getSettings();
  const updated: MaskSettings = { ...current, ...settings };

  if (!hasChromeStorage()) {
    memoryStore.settings = updated;
    return updated;
  }

  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: updated }, () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(updated);
      }
    });
  });
}
