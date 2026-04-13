// Better Translate - Side Panel JS

let settings = {};
let selectedLangCode = 'en';
let currentText = '';
let googleCollapsed = false;
let microsoftCollapsed = false;
let translationInProgress = false;

// ─── Init ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();
  applyTheme();
  buildLangList();
  bindEvents();
  updateServiceVisibility();
  
  // Load persisted state
  chrome.storage.session.get('lastText', (data) => {
    if (data.lastText) {
      document.getElementById('sourceText').value = data.lastText;
      updateCharCount();
    }
  });
});

async function loadSettings() {
  return new Promise(resolve => {
    chrome.storage.sync.get('settings', (data) => {
      settings = data.settings || getDefaultSettings();
      selectedLangCode = settings.targetLanguage || 'en';
      updateLangDisplay();
      resolve();
    });
  });
}

function getDefaultSettings() {
  return {
    targetLanguage: 'en', secondLanguage: 'es', interfaceLanguage: 'en',
    translationCache: true, autoSwitchSecondLanguage: true, showMultipleCandidates: true,
    theme: 'system', translateOnModifier: false, modifierKey: 'Alt', modifierAction: 'clipboard',
    writingTranslate: false, writingTranslateDelay: 500, contextMenu: false,
    copyToTranslate: false, copyToTranslateAction: 'clipboard',
    enabledServices: ['google', 'microsoft']
  };
}

// ─── Theme ────────────────────────────────────────────────
function applyTheme() {
  const body = document.body;
  body.classList.remove('theme-light', 'theme-dark', 'theme-system');
  body.classList.add(`theme-${settings.theme || 'system'}`);
}

function cycleTheme() {
  const order = ['system', 'light', 'dark'];
  const current = settings.theme || 'system';
  const next = order[(order.indexOf(current) + 1) % order.length];
  settings.theme = next;
  applyTheme();
  saveSettings();
  showToast(`Theme: ${next.charAt(0).toUpperCase() + next.slice(1)}`);
}

// ─── Language List ─────────────────────────────────────────
function buildLangList(filter = '') {
  const list = document.getElementById('langList');
  list.innerHTML = '';
  
  const filtered = LANGUAGES.filter(l =>
    l.name.toLowerCase().includes(filter.toLowerCase()) ||
    l.native.toLowerCase().includes(filter.toLowerCase()) ||
    l.code.toLowerCase().includes(filter.toLowerCase())
  );
  
  filtered.forEach(lang => {
    const item = document.createElement('div');
    item.className = 'lang-item' + (lang.code === selectedLangCode ? ' selected' : '');
    item.innerHTML = `<span class="lang-name">${lang.name}</span><span class="lang-native">${lang.native}</span>`;
    item.addEventListener('click', () => selectLanguage(lang.code, lang.name));
    list.appendChild(item);
  });
  
  if (filtered.length === 0) {
    list.innerHTML = '<div style="padding:12px;text-align:center;color:var(--text-3);font-size:12px;">No languages found</div>';
  }
}

function selectLanguage(code, name) {
  selectedLangCode = code;
  updateLangDisplay();
  closeLangDropdown();
}

function updateLangDisplay() {
  const lang = LANGUAGES.find(l => l.code === selectedLangCode);
  document.getElementById('selectedLangName').textContent = lang ? lang.name : selectedLangCode;
}

function openLangDropdown() {
  document.getElementById('langDropdown').classList.add('open');
  document.getElementById('langSelectBtn').classList.add('open');
  document.getElementById('dropdownOverlay').classList.add('active');
  document.getElementById('langSearch').focus();
  buildLangList();
  
  // Scroll selected into view
  setTimeout(() => {
    const selected = document.querySelector('.lang-item.selected');
    if (selected) selected.scrollIntoView({ block: 'nearest' });
  }, 50);
}

function closeLangDropdown() {
  document.getElementById('langDropdown').classList.remove('open');
  document.getElementById('langSelectBtn').classList.remove('open');
  document.getElementById('dropdownOverlay').classList.remove('active');
  document.getElementById('langSearch').value = '';
  buildLangList();
}

// ─── Translation ──────────────────────────────────────────
async function translate() {
  const text = document.getElementById('sourceText').value.trim();
  if (!text) return;
  
  currentText = text;
  
  // Auto-detect and potentially switch to second language
  let targetLang = selectedLangCode;
  
  if (settings.autoSwitchSecondLanguage) {
    targetLang = await determineTargetLanguage(text);
  }
  
  // Save to session
  chrome.storage.session.set({ lastText: text });
  
  // Show results section, hide empty state
  document.getElementById('resultsSection').style.display = 'flex';
  document.getElementById('emptyState').style.display = 'none';
  
  const enabled = settings.enabledServices || ['google', 'microsoft'];
  
  // Translate with all enabled services simultaneously
  const promises = [];
  if (enabled.includes('google')) {
    promises.push(translateWith('google', text, targetLang));
  }
  if (enabled.includes('microsoft')) {
    promises.push(translateWith('microsoft', text, targetLang));
  }
  
  await Promise.allSettled(promises);
}

async function determineTargetLanguage(text) {
  return new Promise(resolve => {
    chrome.runtime.sendMessage({ action: 'detectLanguage', text }, (response) => {
      const detected = response?.lang || 'auto';
      const target = settings.targetLanguage || 'en';
      const second = settings.secondLanguage || 'es';
      
      // If detected matches target, use second; otherwise use target
      if (detected === target || detected.startsWith(target.split('-')[0])) {
        resolve(second);
        selectedLangCode = second;
        updateLangDisplay();
      } else {
        resolve(target);
        selectedLangCode = target;
        updateLangDisplay();
      }
    });
  });
}

async function translateWith(service, text, targetLang) {
  const spinner = document.getElementById(`${service}Spinner`);
  const translationEl = document.getElementById(`${service}Translation`);
  const copyBtn = document.getElementById(`${service}Copy`);
  const copyResultBtn = document.getElementById(`${service}CopyResult`);
  const retryBtn = document.getElementById(`${service}Retry`);
  const detectedEl = document.getElementById(`${service}DetectedLang`);
  const body = document.getElementById(`${service}Body`);
  
  // Show loading
  spinner.classList.add('active');
  translationEl.textContent = 'Translating…';
  translationEl.className = 'translation-text loading';
  copyBtn.style.display = 'none';
  copyResultBtn.style.display = 'none';
  retryBtn.style.display = 'none';
  body.classList.remove('hidden');
  
  if (service === 'google') {
    document.getElementById('googleCandidates').innerHTML = '';
  }
  
  chrome.runtime.sendMessage({
    action: 'translate',
    text,
    targetLang,
    service,
    useCache: settings.translationCache
  }, (response) => {
    spinner.classList.remove('active');
    
    if (chrome.runtime.lastError || !response) {
      translationEl.textContent = 'Translation failed. Please try again.';
      translationEl.className = 'translation-text error';
      retryBtn.style.display = 'flex';
      return;
    }
    
    if (response.error) {
      translationEl.textContent = response.error;
      translationEl.className = 'translation-text error';
      retryBtn.style.display = 'flex';
      return;
    }
    
    if (response.result) {
      const { translation, candidates, detectedLang } = response.result;
      
      translationEl.textContent = translation || '—';
      translationEl.className = 'translation-text';
      
      // Show detected language
      if (detectedLang && detectedLang !== 'auto') {
        const lang = LANGUAGES.find(l => l.code === detectedLang || l.code.startsWith(detectedLang));
        detectedEl.textContent = `Detected: ${lang ? lang.name : detectedLang}`;
      }
      
      // Show candidates for single words (Google only)
      if (service === 'google' && settings.showMultipleCandidates && candidates && candidates.length > 0) {
        const candidatesEl = document.getElementById('googleCandidates');
        candidatesEl.innerHTML = '';
        candidates.slice(0, 6).forEach(c => {
          const chip = document.createElement('div');
          chip.className = 'candidate-chip';
          chip.textContent = c;
          chip.addEventListener('click', () => {
            translationEl.textContent = c;
            navigator.clipboard.writeText(c).catch(() => {});
            showToast('Copied!');
          });
          candidatesEl.appendChild(chip);
        });
      }
      
      copyBtn.style.display = 'flex';
      copyResultBtn.style.display = 'flex';
    }
  });
}

// ─── Service Visibility ────────────────────────────────────
function updateServiceVisibility() {
  const enabled = settings.enabledServices || ['google', 'microsoft'];
  document.getElementById('googleCard').style.display = enabled.includes('google') ? 'block' : 'none';
  document.getElementById('microsoftCard').style.display = enabled.includes('microsoft') ? 'block' : 'none';
}

// ─── Collapse Toggles ──────────────────────────────────────
function toggleService(service) {
  const body = document.getElementById(`${service}Body`);
  const chevron = document.getElementById(`${service}Chevron`);
  const isHidden = body.classList.toggle('hidden');
  chevron.classList.toggle('collapsed', isHidden);
}

// ─── Copy ─────────────────────────────────────────────────
function copyText(elementId) {
  const el = document.getElementById(elementId);
  const text = el.textContent || el.value;
  if (text) {
    navigator.clipboard.writeText(text).then(() => showToast('Copied!')).catch(() => {});
  }
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

// ─── Save Settings ─────────────────────────────────────────
function saveSettings() {
  chrome.storage.sync.set({ settings });
}

// ─── Update Char Count ─────────────────────────────────────
function updateCharCount() {
  const val = document.getElementById('sourceText').value;
  document.getElementById('charCount').textContent = val.length;
}

// ─── Bind Events ──────────────────────────────────────────
function bindEvents() {
  // Theme toggle
  document.getElementById('themeToggle').addEventListener('click', cycleTheme);
  
  // Settings
  document.getElementById('openSettings').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
  
  // Textarea
  const sourceText = document.getElementById('sourceText');
  sourceText.addEventListener('input', () => {
    updateCharCount();
    autoResize(sourceText);
  });
  
  sourceText.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      translate();
    }
  });
  
  // Char count
  updateCharCount();
  
  // Copy source
  document.getElementById('copySource').addEventListener('click', () => {
    copyText('sourceText');
  });
  
  // Clear
  document.getElementById('clearText').addEventListener('click', () => {
    sourceText.value = '';
    updateCharCount();
    document.getElementById('googleTranslation').textContent = '';
    document.getElementById('microsoftTranslation').textContent = '';
    document.getElementById('googleCandidates').innerHTML = '';
    document.getElementById('emptyState').style.display = 'flex';
    document.getElementById('resultsSection').style.display = 'none';
  });
  
  // Language selector
  document.getElementById('langSelectBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = document.getElementById('langDropdown').classList.contains('open');
    if (isOpen) closeLangDropdown(); else openLangDropdown();
  });
  
  document.getElementById('dropdownOverlay').addEventListener('click', closeLangDropdown);
  
  document.getElementById('langSearch').addEventListener('input', (e) => {
    buildLangList(e.target.value);
  });
  
  // Translate button
  document.getElementById('translateBtn').addEventListener('click', translate);
  
  // Service headers (collapse)
  document.getElementById('googleHeader').addEventListener('click', (e) => {
    if (e.target.closest('.service-actions') && !e.target.closest('.chevron-btn')) return;
    toggleService('google');
  });
  document.getElementById('microsoftHeader').addEventListener('click', (e) => {
    if (e.target.closest('.service-actions') && !e.target.closest('.chevron-btn')) return;
    toggleService('microsoft');
  });
  
  // Chevrons
  document.getElementById('googleChevron').addEventListener('click', (e) => {
    e.stopPropagation();
    toggleService('google');
  });
  document.getElementById('microsoftChevron').addEventListener('click', (e) => {
    e.stopPropagation();
    toggleService('microsoft');
  });
  
  // Copy buttons
  document.getElementById('googleCopy').addEventListener('click', (e) => {
    e.stopPropagation();
    copyText('googleTranslation');
  });
  document.getElementById('microsoftCopy').addEventListener('click', (e) => {
    e.stopPropagation();
    copyText('microsoftTranslation');
  });
  document.getElementById('googleCopyResult').addEventListener('click', () => copyText('googleTranslation'));
  document.getElementById('microsoftCopyResult').addEventListener('click', () => copyText('microsoftTranslation'));
  
  // Retry buttons
  document.getElementById('googleRetry').addEventListener('click', (e) => {
    e.stopPropagation();
    if (currentText) translateWith('google', currentText, selectedLangCode);
  });
  document.getElementById('microsoftRetry').addEventListener('click', (e) => {
    e.stopPropagation();
    if (currentText) translateWith('microsoft', currentText, selectedLangCode);
  });
}

function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 200) + 'px';
}

// Listen for settings changes
chrome.storage.onChanged.addListener((changes) => {
  if (changes.settings) {
    settings = changes.settings.newValue || settings;
    applyTheme();
    updateServiceVisibility();
  }
});

// Listen for messages from background (copy to translate, etc.)
chrome.runtime.onMessage.addListener((message) => {
  if (message.action === 'copyToTranslate' || message.action === 'translateFromPage') {
    const text = message.text;
    if (text) {
      document.getElementById('sourceText').value = text;
      updateCharCount();
      translate();
    }
  }
});

// Init empty state
document.getElementById('resultsSection').style.display = 'none';
document.getElementById('emptyState').style.display = 'flex';
