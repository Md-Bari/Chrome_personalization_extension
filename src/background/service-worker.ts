import { ExtensionMessage, PageStatusPayload } from '../shared/types';
import { getSettings } from '../shared/storage';

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    // Initial setup if needed
    console.log('Privacy Mask extension installed successfully.');
  }
});

// Update badge when tab changes or updates
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  updateBadgeForTab(activeInfo.tabId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'complete') {
    updateBadgeForTab(tabId);
  }
});

async function updateBadgeForTab(tabId: number) {
  try {
    const settings = await getSettings();
    if (settings.isPaused) {
      await chrome.action.setBadgeText({ tabId, text: 'OFF' });
      await chrome.action.setBadgeBackgroundColor({ tabId, color: '#8E8E93' });
      return;
    }

    chrome.tabs.sendMessage(
      tabId,
      { type: 'GET_PAGE_STATUS' } as ExtensionMessage,
      (response: PageStatusPayload) => {
        if (chrome.runtime.lastError || !response) {
          chrome.action.setBadgeText({ tabId, text: '' });
          return;
        }

        const count = response.activeCount || 0;
        if (count > 0) {
          chrome.action.setBadgeText({ tabId, text: count.toString() });
          chrome.action.setBadgeBackgroundColor({ tabId, color: '#FF3B30' });
        } else {
          chrome.action.setBadgeText({ tabId, text: '' });
        }
      }
    );
  } catch {
    // Ignore errors for restricted URLs like chrome://
  }
}

// Listen for messages from content scripts or popup
chrome.runtime.onMessage.addListener((message: ExtensionMessage, sender) => {
  if (message.type === 'PAGE_STATUS_RESPONSE' && sender.tab?.id) {
    const payload = message.payload as PageStatusPayload;
    const tabId = sender.tab.id;
    if (payload.isPaused) {
      chrome.action.setBadgeText({ tabId, text: 'OFF' });
      chrome.action.setBadgeBackgroundColor({ tabId, color: '#8E8E93' });
    } else if (payload.activeCount > 0) {
      chrome.action.setBadgeText({ tabId, text: payload.activeCount.toString() });
      chrome.action.setBadgeBackgroundColor({ tabId, color: '#FF3B30' });
    } else {
      chrome.action.setBadgeText({ tabId, text: '' });
    }
  }
});
