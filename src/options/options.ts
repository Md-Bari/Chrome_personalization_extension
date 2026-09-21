import { MaskRule, MaskSettings, MatchScope } from '../shared/types';
import {
  getMaskRules,
  deleteMaskRule,
  updateMaskRule,
  clearMaskRules,
  getSettings,
  saveSettings,
  saveMaskRule,
} from '../shared/storage';

let allRules: MaskRule[] = [];
let currentSettings: MaskSettings;

async function initOptions() {
  currentSettings = await getSettings();
  allRules = await getMaskRules();

  setupTabs();
  setupSettingsForm();
  setupBackupHandlers();
  setupRulesView();
  renderRules();

  // Check URL hash for direct tab linking
  const hash = window.location.hash.replace('#', '');
  if (hash === 'settings') {
    switchTab('settings-tab');
  }
}

function setupTabs() {
  const tabBtns = document.querySelectorAll('.nav-item');
  tabBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const tabId = btn.getAttribute('data-tab');
      if (tabId) {
        switchTab(tabId);
      }
    });
  });
}

function switchTab(tabId: string) {
  document.querySelectorAll('.nav-item').forEach((b) => b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach((c) => c.classList.remove('active'));

  const activeBtn = document.querySelector(`[data-tab="${tabId}"]`);
  const activeContent = document.getElementById(tabId);
  const pageTitle = document.getElementById('page-title');
  const rulesActions = document.getElementById('rules-actions');

  if (activeBtn) activeBtn.classList.add('active');
  if (activeContent) activeContent.classList.add('active');

  if (pageTitle) {
    if (tabId === 'rules-tab') {
      pageTitle.textContent = 'Mask Rules';
      if (rulesActions) rulesActions.style.display = 'flex';
    } else if (tabId === 'settings-tab') {
      pageTitle.textContent = 'Settings & Preferences';
      if (rulesActions) rulesActions.style.display = 'none';
    } else if (tabId === 'backup-tab') {
      pageTitle.textContent = 'Backup & Synchronization';
      if (rulesActions) rulesActions.style.display = 'none';
    } else if (tabId === 'privacy-tab') {
      pageTitle.textContent = 'Privacy & Security Architecture';
      if (rulesActions) rulesActions.style.display = 'none';
    }
  }
}

function setupSettingsForm() {
  const maskSelect = document.getElementById('mask-char-select') as HTMLSelectElement;
  const customInput = document.getElementById('custom-mask-input') as HTMLInputElement;
  const revealSelect = document.getElementById('reveal-duration-select') as HTMLSelectElement;
  const scopeSelect = document.getElementById('default-scope-select') as HTMLSelectElement;
  const autoMaskToggle = document.getElementById('auto-mask-toggle') as HTMLInputElement;
  const saveBtn = document.getElementById('btn-save-settings') as HTMLButtonElement;
  const statusMsg = document.getElementById('settings-status-msg') as HTMLElement;

  if (['****', '••••', '████', 'HIDDEN'].includes(currentSettings.defaultMaskText)) {
    maskSelect.value = currentSettings.defaultMaskText;
    customInput.style.display = 'none';
  } else {
    maskSelect.value = 'custom';
    customInput.value = currentSettings.defaultMaskText;
    customInput.style.display = 'block';
  }

  maskSelect.addEventListener('change', () => {
    if (maskSelect.value === 'custom') {
      customInput.style.display = 'block';
    } else {
      customInput.style.display = 'none';
    }
  });

  revealSelect.value = currentSettings.revealDurationSeconds.toString();
  scopeSelect.value = currentSettings.defaultMatchScope;
  autoMaskToggle.checked = currentSettings.autoMaskEnabled;

  saveBtn.addEventListener('click', async () => {
    let maskText = maskSelect.value;
    if (maskText === 'custom') {
      maskText = customInput.value.trim() || '****';
    }

    const newSettings: Partial<MaskSettings> = {
      defaultMaskText: maskText,
      revealDurationSeconds: parseInt(revealSelect.value, 10) || 5,
      defaultMatchScope: scopeSelect.value as MatchScope,
      autoMaskEnabled: autoMaskToggle.checked,
    };

    currentSettings = await saveSettings(newSettings);
    statusMsg.style.display = 'inline';
    setTimeout(() => {
      statusMsg.style.display = 'none';
    }, 2500);
  });
}

function setupRulesView() {
  const searchInput = document.getElementById('search-input') as HTMLInputElement;
  const siteFilter = document.getElementById('site-filter') as HTMLSelectElement;
  const clearAllBtn = document.getElementById('btn-clear-all') as HTMLButtonElement;

  searchInput.addEventListener('input', () => renderRules());
  siteFilter.addEventListener('change', () => renderRules());

  clearAllBtn.addEventListener('click', async () => {
    if (allRules.length === 0) return;
    const confirmed = window.confirm(
      'Are you sure you want to delete ALL masking rules? This action cannot be undone.'
    );
    if (confirmed) {
      await clearMaskRules();
      allRules = [];
      renderRules();
    }
  });
}

function updateSiteFilterDropdown() {
  const siteFilter = document.getElementById('site-filter') as HTMLSelectElement;
  const currentVal = siteFilter.value;

  const sites = Array.from(new Set(allRules.map((r) => r.hostname))).filter(Boolean);

  siteFilter.innerHTML = '<option value="all">All Sites</option>';
  sites.forEach((site) => {
    const opt = document.createElement('option');
    opt.value = site;
    opt.textContent = site;
    siteFilter.appendChild(opt);
  });

  if (sites.includes(currentVal)) {
    siteFilter.value = currentVal;
  }
}

function renderRules() {
  const searchInput = document.getElementById('search-input') as HTMLInputElement;
  const siteFilter = document.getElementById('site-filter') as HTMLSelectElement;
  const tbody = document.getElementById('rules-tbody') as HTMLElement;
  const emptyState = document.getElementById('rules-empty-state') as HTMLElement;
  const badge = document.getElementById('total-rules-badge') as HTMLElement;

  badge.textContent = allRules.length.toString();
  updateSiteFilterDropdown();

  const query = (searchInput?.value || '').toLowerCase().trim();
  const selectedSite = siteFilter?.value || 'all';

  const filtered = allRules.filter((rule) => {
    if (selectedSite !== 'all' && rule.hostname !== selectedSite) {
      return false;
    }
    if (query) {
      const matchHost = rule.hostname.toLowerCase().includes(query);
      const matchPath = (rule.pathname || '').toLowerCase().includes(query);
      const matchSelector = ((rule.selector?.cssSelector || (rule as any).cssSelector || (rule as any).originalText || '')).toLowerCase().includes(query);
      const matchTag = ((rule.selector?.tagName || (rule as any).domPath || '')).toLowerCase().includes(query);
      return matchHost || matchPath || matchSelector || matchTag;
    }
    return true;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = '';
    emptyState.style.display = 'block';
    return;
  }

  emptyState.style.display = 'none';
  tbody.innerHTML = '';

  filtered.forEach((rule) => {
    const tr = document.createElement('tr');

    // Site & Page
    const tdSite = document.createElement('td');
    const pill = document.createElement('span');
    pill.className = 'domain-pill';
    pill.textContent = rule.hostname;
    tdSite.appendChild(pill);
    if (rule.pathname && rule.pathname !== '/') {
      const pathSpan = document.createElement('div');
      pathSpan.className = 'selector-snippet';
      pathSpan.textContent = rule.pathname;
      tdSite.appendChild(pathSpan);
    }

    // Mode
    const tdMode = document.createElement('td');
    tdMode.textContent = rule.mode === 'text' ? 'Text' : 'Element';

    // Selector
    const tdSelector = document.createElement('td');
    const selSnippet = document.createElement('span');
    selSnippet.className = 'selector-snippet';
    const selText = rule.selector?.cssSelector || (rule as any).cssSelector || (rule as any).domPath || (rule as any).originalText || rule.selector?.path || rule.selector?.tagName || 'Element';
    selSnippet.textContent = selText;
    selSnippet.title = selText;
    tdSelector.appendChild(selSnippet);

    // Status
    const tdStatus = document.createElement('td');
    const statusSpan = document.createElement('span');
    const status = rule.enabled ? (rule.status || 'active') : 'disabled';
    statusSpan.className = `status-badge ${status}`;
    statusSpan.textContent = status === 'active' ? '● Active' : status === 'not-found' ? '▲ Not Found' : '○ Disabled';
    tdStatus.appendChild(statusSpan);

    // Mask Text
    const tdMask = document.createElement('td');
    tdMask.textContent = rule.maskText || '****';

    // Created
    const tdCreated = document.createElement('td');
    tdCreated.textContent = new Date(rule.createdAt).toLocaleDateString();

    // Actions
    const tdActions = document.createElement('td');
    tdActions.className = 'text-right';

    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'table-action-btn';
    toggleBtn.textContent = rule.enabled ? 'Disable' : 'Enable';
    toggleBtn.addEventListener('click', async () => {
      const updated = await updateMaskRule(rule.id, { enabled: !rule.enabled });
      if (updated) {
        const idx = allRules.findIndex((r) => r.id === rule.id);
        if (idx >= 0) allRules[idx] = updated;
        renderRules();
      }
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'table-action-btn delete-btn';
    deleteBtn.textContent = 'Delete';
    deleteBtn.addEventListener('click', async () => {
      await deleteMaskRule(rule.id);
      allRules = allRules.filter((r) => r.id !== rule.id);
      renderRules();
    });

    tdActions.appendChild(toggleBtn);
    tdActions.appendChild(deleteBtn);

    tr.appendChild(tdSite);
    tr.appendChild(tdMode);
    tr.appendChild(tdSelector);
    tr.appendChild(tdStatus);
    tr.appendChild(tdMask);
    tr.appendChild(tdCreated);
    tr.appendChild(tdActions);

    tbody.appendChild(tr);
  });
}

function setupBackupHandlers() {
  const exportBtn = document.getElementById('btn-export-rules');
  const triggerImportBtn = document.getElementById('btn-trigger-import');
  const importInput = document.getElementById('import-file-input') as HTMLInputElement;
  const statusMsg = document.getElementById('import-status-msg');

  exportBtn?.addEventListener('click', () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(allRules, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `privacy-mask-backup-${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  });

  triggerImportBtn?.addEventListener('click', () => {
    importInput?.click();
  });

  importInput?.addEventListener('change', (e) => {
    const target = e.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string;
        const imported = JSON.parse(content) as MaskRule[];
        if (!Array.isArray(imported)) {
          throw new Error('Invalid file format: root must be an array of rules');
        }

        for (const rule of imported) {
          if (rule.id && rule.hostname && rule.selector) {
            await saveMaskRule(rule);
          }
        }

        allRules = await getMaskRules();
        renderRules();
        if (statusMsg) {
          statusMsg.textContent = `Successfully imported ${imported.length} rules!`;
          statusMsg.className = 'status-msg success-msg';
          setTimeout(() => {
            statusMsg.textContent = '';
          }, 3000);
        }
      } catch (err) {
        if (statusMsg) {
          statusMsg.textContent = `Import failed: ${(err as Error).message}`;
          statusMsg.className = 'status-msg';
          statusMsg.style.color = 'var(--danger)';
        }
      }
    };
    reader.readAsText(file);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initOptions();
});
