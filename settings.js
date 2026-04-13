// Better Translate - Settings JS

let settings = {};
let dirty = false;

const defaultSettings = {
  targetLanguage: 'en', secondLanguage: 'es', interfaceLanguage: 'en',
  translationCache: true, autoSwitchSecondLanguage: true, showMultipleCandidates: true,
  theme: 'system', translateOnModifier: false, modifierKey: 'Alt', modifierAction: 'clipboard',
  writingTranslate: false, writingTranslateDelay: 500, contextMenu: false,
  copyToTranslate: false, copyToTranslateAction: 'clipboard',
  enabledServices: ['google', 'microsoft'], microsoftApiKey: ''
};

// ─── Init ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();
  applyTheme();
  setupNav();
  buildLangDropdowns();
  bindSettings();
  bindEvents();
  updateVersionDisplay();
});

async function loadSettings() {
  return new Promise(resolve => {
    chrome.storage.sync.get('settings', (data) => {
      settings = { ...defaultSettings, ...(data.settings || {}) };
      resolve();
    });
  });
}

function saveSettings() {
  chrome.storage.sync.set({ settings });
  notifyContentScripts();
  hideSaveBar();
  dirty = false;
  showToast('Settings saved!');
}

function notifyContentScripts() {
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach(tab => {
      chrome.tabs.sendMessage(tab.id, { action: 'settingsUpdated' }).catch(() => {});
    });
  });
}

function markDirty() {
  if (!dirty) {
    dirty = true;
    showSaveBar();
  }
}

// ─── Theme ────────────────────────────────────────────────
function applyTheme() {
  const body = document.body;
  body.classList.remove('theme-light', 'theme-dark', 'theme-system');
  body.classList.add(`theme-${settings.theme || 'system'}`);
  
  const labels = { system: 'System', light: 'Light', dark: 'Dark' };
  document.getElementById('themeLabel').textContent = labels[settings.theme] || 'System';
}

function cycleTheme() {
  const order = ['system', 'light', 'dark'];
  const next = order[(order.indexOf(settings.theme) + 1) % order.length];
  settings.theme = next;
  applyTheme();
  markDirty();
}

// ─── Nav ──────────────────────────────────────────────────
function setupNav() {
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.settings-section').forEach(s => s.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`section-${btn.dataset.section}`).classList.add('active');
    });
  });
}

// ─── Language Dropdowns ────────────────────────────────────
function buildLangDropdowns() {
  setupLangDropdown('target', settings.targetLanguage || 'en', (code) => {
    settings.targetLanguage = code; markDirty();
  });
  setupLangDropdown('second', settings.secondLanguage || 'es', (code) => {
    settings.secondLanguage = code; markDirty();
  });
  setupLangDropdown('iface', settings.interfaceLanguage || 'en', (code) => {
    settings.interfaceLanguage = code; markDirty();
  });
}

function setupLangDropdown(id, initial, onChange) {
  const btn = document.getElementById(`${id}LangBtn`);
  const dropdown = document.getElementById(`${id}LangDropdown`);
  const search = document.getElementById(`${id}LangSearch`);
  const list = document.getElementById(`${id}LangList`);
  const nameSpan = document.getElementById(`${id}LangName`);
  
  let selectedCode = initial;
  
  function updateDisplay() {
    const lang = LANGUAGES.find(l => l.code === selectedCode);
    nameSpan.textContent = lang ? lang.name : selectedCode;
  }
  
  function renderList(filter = '') {
    list.innerHTML = '';
    const filtered = LANGUAGES.filter(l =>
      l.name.toLowerCase().includes(filter.toLowerCase()) ||
      l.native.toLowerCase().includes(filter.toLowerCase())
    );
    
    filtered.forEach(lang => {
      const item = document.createElement('div');
      item.className = 'lang-item' + (lang.code === selectedCode ? ' selected' : '');
      item.innerHTML = `<span class="lang-name">${lang.name}</span><span class="lang-native">${lang.native}</span>`;
      item.addEventListener('click', () => {
        selectedCode = lang.code;
        updateDisplay();
        onChange(lang.code);
        closeDropdown();
      });
      list.appendChild(item);
    });
  }
  
  function openDropdown() {
    dropdown.classList.add('open');
    btn.classList.add('open');
    document.getElementById('dropdownOverlay').classList.add('active');
    search.focus();
    renderList();
    setTimeout(() => {
      const sel = list.querySelector('.selected');
      if (sel) sel.scrollIntoView({ block: 'nearest' });
    }, 50);
  }
  
  function closeDropdown() {
    dropdown.classList.remove('open');
    btn.classList.remove('open');
    document.getElementById('dropdownOverlay').classList.remove('active');
    search.value = '';
    renderList();
  }
  
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown.classList.contains('open') ? closeDropdown() : openDropdown();
  });
  
  search.addEventListener('input', (e) => renderList(e.target.value));
  
  updateDisplay();
}

// ─── Bind Settings to UI ──────────────────────────────────
function bindSettings() {
  // Checkboxes
  const checkboxMap = {
    'autoSwitch': 'autoSwitchSecondLanguage',
    'translationCache': 'translationCache',
    'showCandidates': 'showMultipleCandidates',
    'translateOnModifier': 'translateOnModifier',
    'writingTranslate': 'writingTranslate',
    'contextMenu': 'contextMenu',
    'copyToTranslate': 'copyToTranslate',
    'enableGoogle': null,
    'enableMicrosoft': null
  };
  
  Object.entries(checkboxMap).forEach(([elId, settingKey]) => {
    const el = document.getElementById(elId);
    if (!el) return;
    
    if (elId === 'enableGoogle') {
      el.checked = (settings.enabledServices || []).includes('google');
    } else if (elId === 'enableMicrosoft') {
      el.checked = (settings.enabledServices || []).includes('microsoft');
    } else {
      el.checked = !!settings[settingKey];
    }
  });
  
  // Selects
  const selectEl = document.getElementById('modifierKey');
  if (selectEl) selectEl.value = settings.modifierKey || 'Alt';
  
  // Number inputs
  const delayEl = document.getElementById('writingDelay');
  if (delayEl) delayEl.value = settings.writingTranslateDelay || 500;
  
  // Text inputs
  const apiKeyEl = document.getElementById('microsoftApiKey');
  if (apiKeyEl) apiKeyEl.value = settings.microsoftApiKey || '';
  
  // Radio buttons
  const modAction = settings.modifierAction || 'clipboard';
  const modRadio = document.querySelector(`input[name="modifierAction"][value="${modAction}"]`);
  if (modRadio) modRadio.checked = true;
  
  const copyAction = settings.copyToTranslateAction || 'clipboard';
  const copyRadio = document.querySelector(`input[name="copyAction"][value="${copyAction}"]`);
  if (copyRadio) copyRadio.checked = true;
  
  // Update sub-settings visibility
  updateSubSettings();
}

function updateSubSettings() {
  const modSub = document.getElementById('modifierSubSettings');
  const writingSub = document.getElementById('writingSubSettings');
  const copySub = document.getElementById('copySubSettings');
  
  if (modSub) modSub.classList.toggle('visible', !!settings.translateOnModifier);
  if (writingSub) writingSub.classList.toggle('visible', !!settings.writingTranslate);
  if (copySub) copySub.classList.toggle('visible', !!settings.copyToTranslate);
}

// ─── Bind Events ──────────────────────────────────────────
function bindEvents() {
  // Theme
  document.getElementById('themeToggle').addEventListener('click', cycleTheme);
  
  // Dropdowns overlay
  document.getElementById('dropdownOverlay').addEventListener('click', () => {
    document.querySelectorAll('.lang-dropdown.open').forEach(d => d.classList.remove('open'));
    document.querySelectorAll('.select-btn.open').forEach(b => b.classList.remove('open'));
    document.getElementById('dropdownOverlay').classList.remove('active');
  });
  
  // Checkboxes
  const checkboxHandlers = {
    'autoSwitch': (v) => { settings.autoSwitchSecondLanguage = v; },
    'translationCache': (v) => { settings.translationCache = v; },
    'showCandidates': (v) => { settings.showMultipleCandidates = v; },
    'modifierKey': null,
  };
  
  // Generic checkbox
  ['autoSwitch', 'translationCache', 'showCandidates'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('change', () => {
      const map = {
        'autoSwitch': 'autoSwitchSecondLanguage',
        'translationCache': 'translationCache',
        'showCandidates': 'showMultipleCandidates'
      };
      settings[map[id]] = el.checked;
      markDirty();
    });
  });
  
  // Trigger toggles (mutually exclusive)
  document.querySelectorAll('.trigger-toggle').forEach(el => {
    el.addEventListener('change', () => {
      if (el.checked) {
        // Uncheck others
        document.querySelectorAll('.trigger-toggle').forEach(other => {
          if (other !== el) {
            other.checked = false;
            const map = {
              'translateOnModifier': 'translateOnModifier',
              'writingTranslate': 'writingTranslate',
              'contextMenu': 'contextMenu',
              'copyToTranslate': 'copyToTranslate'
            };
            settings[map[other.id]] = false;
          }
        });
      }
      
      settings.translateOnModifier = document.getElementById('translateOnModifier')?.checked || false;
      settings.writingTranslate = document.getElementById('writingTranslate')?.checked || false;
      settings.contextMenu = document.getElementById('contextMenu')?.checked || false;
      settings.copyToTranslate = document.getElementById('copyToTranslate')?.checked || false;
      
      updateSubSettings();
      markDirty();
      
      // Update context menu in background
      chrome.runtime.sendMessage({ action: 'updateContextMenu' });
    });
  });
  
  // Modifier key select
  document.getElementById('modifierKey')?.addEventListener('change', (e) => {
    settings.modifierKey = e.target.value;
    markDirty();
  });
  
  // Writing delay
  document.getElementById('writingDelay')?.addEventListener('change', (e) => {
    settings.writingTranslateDelay = parseInt(e.target.value) || 500;
    markDirty();
  });
  
  // Modifier action radios
  document.querySelectorAll('input[name="modifierAction"]').forEach(r => {
    r.addEventListener('change', () => {
      settings.modifierAction = r.value;
      markDirty();
    });
  });
  
  // Copy action radios
  document.querySelectorAll('input[name="copyAction"]').forEach(r => {
    r.addEventListener('change', () => {
      settings.copyToTranslateAction = r.value;
      markDirty();
    });
  });
  
  // Services
  document.getElementById('enableGoogle')?.addEventListener('change', (e) => {
    const svcs = settings.enabledServices || [];
    if (e.target.checked) { if (!svcs.includes('google')) svcs.push('google'); }
    else { settings.enabledServices = svcs.filter(s => s !== 'google'); return; }
    settings.enabledServices = svcs;
    markDirty();
  });
  
  document.getElementById('enableMicrosoft')?.addEventListener('change', (e) => {
    const svcs = settings.enabledServices || [];
    if (e.target.checked) { if (!svcs.includes('microsoft')) svcs.push('microsoft'); }
    else { settings.enabledServices = svcs.filter(s => s !== 'microsoft'); return; }
    settings.enabledServices = svcs;
    markDirty();
  });
  
  document.getElementById('microsoftApiKey')?.addEventListener('input', (e) => {
    settings.microsoftApiKey = e.target.value;
    markDirty();
  });
  
  // Save button
  document.getElementById('saveSettings')?.addEventListener('click', saveSettings);
  
  // Export
  document.getElementById('exportSettings')?.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'better-translate-settings.json';
    a.click();
    URL.revokeObjectURL(url);
    showToast('Settings exported!');
  });
  
  // Import from file
  const fileInput = document.getElementById('fileInput');
  document.getElementById('browseFile')?.addEventListener('click', () => fileInput.click());
  
  fileInput?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) importFromFile(file);
  });
  
  // Drag and drop
  const dropZone = document.getElementById('dropZone');
  dropZone?.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });
  dropZone?.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
  dropZone?.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file && file.type === 'application/json') importFromFile(file);
  });
  
  // Import from URL
  document.getElementById('importFromUrl')?.addEventListener('click', async () => {
    const url = document.getElementById('importUrl').value.trim();
    if (!url) return;
    try {
      const response = await fetch(url);
      const data = await response.json();
      applyImport(data);
    } catch(e) {
      showToast('Failed to import from URL');
    }
  });
  
  // Reset
  document.getElementById('resetSettings')?.addEventListener('click', () => {
    const answer = prompt('Type "yes" to confirm reset all settings to default:');
    if (answer?.toLowerCase() === 'yes') {
      settings = { ...defaultSettings };
      chrome.storage.sync.set({ settings });
      bindSettings();
      applyTheme();
      dirty = false;
      hideSaveBar();
      showToast('Settings reset to default!');
    }
  });
}

function importFromFile(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      applyImport(data);
    } catch(err) {
      showToast('Invalid settings file');
    }
  };
  reader.readAsText(file);
}

function applyImport(data) {
  settings = { ...defaultSettings, ...data };
  chrome.storage.sync.set({ settings });
  bindSettings();
  applyTheme();
  dirty = false;
  hideSaveBar();
  showToast('Settings imported!');
}

// ─── Save Bar ─────────────────────────────────────────────
function showSaveBar() {
  document.getElementById('saveBar').classList.add('visible');
}

function hideSaveBar() {
  document.getElementById('saveBar').classList.remove('visible');
}

// ─── Version ──────────────────────────────────────────────
function updateVersionDisplay() {
  const manifest = chrome.runtime.getManifest();
  const v = manifest.version;
  document.getElementById('versionDisplay').textContent = `v${v}`;
  document.getElementById('aboutVersion').textContent = `Version ${v}`;
}

// ─── Toast ────────────────────────────────────────────────
function showToast(msg) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 1800);
}
