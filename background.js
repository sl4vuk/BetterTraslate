// Background Service Worker for Better Translate

// Open side panel on action click
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ tabId: tab.id });
});

// Keyboard shortcut to open side panel
chrome.commands.onCommand.addListener((command) => {
  if (command === 'open-sidepanel') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.sidePanel.open({ tabId: tabs[0].id });
      }
    });
  }
});

// Initialize default settings
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get('settings', (data) => {
    if (!data.settings) {
      const defaultSettings = {
        targetLanguage: 'en',
        secondLanguage: 'es',
        interfaceLanguage: 'en',
        translationCache: true,
        autoSwitchSecondLanguage: true,
        showMultipleCandidates: true,
        theme: 'system',
        translateOnModifier: false,
        modifierKey: 'Alt',
        modifierAction: 'clipboard',
        writingTranslate: false,
        writingTranslateDelay: 500,
        contextMenu: false,
        copyToTranslate: false,
        copyToTranslateAction: 'clipboard',
        enabledServices: ['google', 'microsoft']
      };
      chrome.storage.sync.set({ settings: defaultSettings });
    }
  });

  // Setup context menu
  chrome.contextMenus.create({
    id: 'better-translate',
    title: 'Translate',
    contexts: ['selection']
  });
});

// Handle context menu click
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'better-translate') {
    chrome.storage.sync.get('settings', (data) => {
      const settings = data.settings || {};
      if (settings.contextMenu) {
        chrome.tabs.sendMessage(tab.id, {
          action: 'translateSelection',
          text: info.selectionText
        });
      }
    });
  }
});

// Translation cache
const cache = new Map();

// Message handler
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'translate') {
    handleTranslation(message, sendResponse);
    return true; // async
  }
  if (message.action === 'detectLanguage') {
    detectLanguage(message.text, sendResponse);
    return true;
  }
  if (message.action === 'openSettings') {
    chrome.runtime.openOptionsPage();
  }
  if (message.action === 'updateContextMenu') {
    // Context menu visibility handled by content script checking settings
  }
});

async function handleTranslation(message, sendResponse) {
  const { text, targetLang, service, useCache } = message;
  
  if (!text || !text.trim()) {
    sendResponse({ error: 'No text provided' });
    return;
  }

  const cacheKey = `${service}:${targetLang}:${text}`;
  
  if (useCache && cache.has(cacheKey)) {
    sendResponse({ result: cache.get(cacheKey), fromCache: true });
    return;
  }

  try {
    let result;
    if (service === 'google') {
      result = await translateWithGoogle(text, targetLang);
    } else if (service === 'microsoft') {
      result = await translateWithMicrosoft(text, targetLang);
    }
    
    if (useCache && result) {
      cache.set(cacheKey, result);
      // Limit cache size
      if (cache.size > 500) {
        const firstKey = cache.keys().next().value;
        cache.delete(firstKey);
      }
    }
    
    sendResponse({ result });
  } catch (err) {
    sendResponse({ error: err.message });
  }
}

async function translateWithGoogle(text, targetLang) {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(targetLang)}&dt=t&dt=bd&dj=1&q=${encodeURIComponent(text)}`;
  
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Google Translate error: ${response.status}`);
  
  const data = await response.json();
  
  let translation = '';
  if (data.sentences) {
    translation = data.sentences
      .filter(s => s.trans)
      .map(s => s.trans)
      .join('');
  }
  
  // Handle dictionary entries for single words
  let candidates = [];
  if (data.dict) {
    data.dict.forEach(entry => {
      if (entry.terms) {
        candidates.push(...entry.terms.slice(0, 3));
      }
    });
  }
  
  const detectedLang = data.src || 'auto';
  
  return { translation, candidates, detectedLang };
}

async function translateWithMicrosoft(text, targetLang) {
  // Microsoft uses different lang codes for some languages
  const msLangMap = {
    'iw': 'he',
    'jw': 'jv',
    'zh-CN': 'zh-Hans',
    'zh-TW': 'zh-Hant'
  };
  const msTargetLang = msLangMap[targetLang] || targetLang;
  
  const url = `https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&to=${encodeURIComponent(msTargetLang)}&includeAlignment=false&includeSentenceLength=false`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Ocp-Apim-Subscription-Key': 'FREE_TIER',
      'Ocp-Apim-Subscription-Region': 'global'
    },
    body: JSON.stringify([{ Text: text }])
  });

  // Fallback: use free Microsoft endpoint
  if (!response.ok) {
    return translateWithMicrosoftFree(text, msTargetLang);
  }
  
  const data = await response.json();
  if (data && data[0]) {
    const translation = data[0].translations[0].text;
    const detectedLang = data[0].detectedLanguage?.language || 'auto';
    return { translation, candidates: [], detectedLang };
  }
  throw new Error('Microsoft Translate: No result');
}

async function translateWithMicrosoftFree(text, targetLang) {
  // Use the free Bing Translator endpoint
  const url = `https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&to=${encodeURIComponent(targetLang)}`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([{ Text: text }])
    });
    
    if (!response.ok) throw new Error(`Microsoft error: ${response.status}`);
    const data = await response.json();
    
    if (data && data[0]) {
      return {
        translation: data[0].translations[0].text,
        candidates: [],
        detectedLang: data[0].detectedLanguage?.language || 'auto'
      };
    }
  } catch(e) {
    throw new Error('Microsoft Translate unavailable. Please check your API key in settings.');
  }
}

async function detectLanguage(text, sendResponse) {
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=${encodeURIComponent(text.substring(0, 100))}`;
    const response = await fetch(url);
    const data = await response.json();
    sendResponse({ lang: data.src || 'auto' });
  } catch(e) {
    sendResponse({ lang: 'auto' });
  }
}
