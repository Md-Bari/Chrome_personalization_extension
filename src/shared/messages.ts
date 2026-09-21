import { ExtensionMessage } from './types';

export function sendTabMessage<T = unknown, R = unknown>(
  tabId: number,
  message: ExtensionMessage<T>
): Promise<R> {
  return new Promise((resolve, reject) => {
    if (typeof chrome === 'undefined' || !chrome.tabs?.sendMessage) {
      reject(new Error('chrome.tabs.sendMessage unavailable'));
      return;
    }
    chrome.tabs.sendMessage(tabId, message, (response: R) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(response);
      }
    });
  });
}

export function sendRuntimeMessage<T = unknown, R = unknown>(
  message: ExtensionMessage<T>
): Promise<R> {
  return new Promise((resolve, reject) => {
    if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
      reject(new Error('chrome.runtime.sendMessage unavailable'));
      return;
    }
    chrome.runtime.sendMessage(message, (response: R) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(response);
      }
    });
  });
}
