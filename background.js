// Better Translate — Background v10

chrome.runtime.onInstalled.addListener(async () => {
  try { await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }); } catch(e) {}
  const { settings } = await chrome.storage.sync.get('settings');
  if (!settings) await chrome.storage.sync.set({ settings: getDefaults() });
  rebuildContextMenu(settings || getDefaults());
});

function getDefaults() {
  return {
    targetLanguage:'en', secondLanguage:'es', interfaceLanguage:'en',
    translationCache:true, autoSwitchSecondLanguage:false, showMultipleCandidates:true,
    theme:'system', sidebarAutoTranslate:false,
    breakLimit:false, charLimit:5000,
    translateOnModifier:false, modifierCombo:'Alt+W', modifierAction:'sidebar',
    writingTranslate:false, writingTranslateSpeed:'medium', writingTranslateMode:'sidebar',
    contextMenu:false, contextMenuAction:'sidebar',
    openInSidebar:true, onlySidebarOpen:false,
    copyToTranslate:false, copyToTranslateAction:'sidebar',
    translateOnPopup:false, popupAction:'sidebar',
    enabledServices:['google'], defaultService:'google',
    microsoftApiKey:'', deeplApiKey:'', yandexApiKey:'',
    disabledSites:[], disabledSitesEnabled:true
  };
}

function rebuildContextMenu(s) {
  chrome.contextMenus.removeAll(() => {
    if (s?.contextMenu) chrome.contextMenus.create({ id:'bt-translate', title:'Translate', contexts:['selection'] });
  });
}

chrome.storage.onChanged.addListener((changes) => {
  if (!changes.settings) return;
  rebuildContextMenu(changes.settings.newValue || {});
  // Clear translation cache when language settings change — prevents stale cached translations
  const prev = changes.settings.oldValue || {};
  const next = changes.settings.newValue || {};
  if (prev.targetLanguage !== next.targetLanguage ||
      prev.secondLanguage !== next.secondLanguage ||
      prev.autoSwitchSecondLanguage !== next.autoSwitchSecondLanguage) {
    cache.clear();
  }
  chrome.runtime.sendMessage({ action:'settingsBroadcast', settings:next }).catch(()=>{});
});

async function isDisabledSite(tabId) {
  try {
    const { settings } = await chrome.storage.sync.get('settings');
    if (!settings?.disabledSitesEnabled || !settings.disabledSites?.length) return false;
    const tab = await chrome.tabs.get(tabId);
    const host = new URL(tab.url).hostname.replace(/^www\./, '');
    return settings.disabledSites.some(site => {
      const s = site.replace(/^www\./,'').replace(/^https?:\/\//,'');
      return host === s || host.endsWith('.'+s);
    });
  } catch(e) { return false; }
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== 'bt-translate') return;
  const text = info.selectionText?.trim();
  if (!text || await isDisabledSite(tab.id)) return;
  const { settings:s } = await chrome.storage.sync.get('settings');
  if (!s?.contextMenu) return;
  const targetLang = await resolveTargetLang(text, s);
  const action = s.contextMenuAction || 'sidebar';
  if (action === 'replace') {
    const r = await doTranslate(text, targetLang, s.defaultService||'google', s);
    if (r?.translation) chrome.tabs.sendMessage(tab.id,{action:'replaceSelectedText',translation:r.translation}).catch(()=>{});
  } else if (action === 'clipboard') {
    const r = await doTranslate(text, targetLang, s.defaultService||'google', s);
    if (r?.translation) chrome.tabs.sendMessage(tab.id,{action:'writeClipboard',text:r.translation}).catch(()=>{});
    if (s.openInSidebar) { try{await chrome.sidePanel.open({tabId:tab.id});}catch(e){} setTimeout(()=>chrome.runtime.sendMessage({action:'translateFromPage',text,targetLang}).catch(()=>{}),600); }
  } else {
    try{await chrome.sidePanel.open({tabId:tab.id});}catch(e){}
    setTimeout(()=>chrome.runtime.sendMessage({action:'translateFromPage',text,targetLang}).catch(()=>{}),600);
  }
});

// ─── Cache ────────────────────────────────────────────────
// Cache is intentionally NOT used when autoSwitch is enabled,
// because the same text may need to translate to a different language depending on detection.
const cache = new Map();

// ─── Messages ─────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'translate')             { handleTranslation(msg, sendResponse); return true; }
  if (msg.action === 'detectLanguage')        { detectLang(msg.text).then(lang => sendResponse({ lang })); return true; }
  if (msg.action === 'openSettings')          { chrome.runtime.openOptionsPage(); }
  if (msg.action === 'writingTranslateReq')   { handleWritingTranslate(msg, sender, sendResponse); return true; }
  if (msg.action === 'openSidebar') {
    chrome.tabs.query({active:true,currentWindow:true},([tab])=>{ if(tab) chrome.sidePanel.open({tabId:tab.id}).catch(()=>{}); });
  }
  if (msg.action === 'popupTranslate')        { handlePopupTranslate(msg, sender, sendResponse); return true; }
  if (msg.action === 'translateUI')           { handleUITranslation(msg, sendResponse); return true; }
  if (msg.action === 'detectAndTranslate')    { handleDetectAndTranslate(msg, sendResponse); return true; }
  if (msg.action === 'clearCache')            { cache.clear(); }
});

// ─── DETECT + TRANSLATE in one roundtrip ──────────────────
async function handleDetectAndTranslate(msg, sendResponse) {
  const { text, targetLanguage, secondLanguage, autoSwitch, service, useCache } = msg;
  const { settings:s } = await chrome.storage.sync.get('settings');

  let targetLang = targetLanguage;
  let detectedLang = 'auto';
  let didSwitch = false;

  if (autoSwitch) {
    // Always detect fresh — never use cache for auto-switch decisions
    detectedLang = await detectLang(text.substring(0, 120));
    if (detectedLang && detectedLang !== 'auto' &&
        (detectedLang === targetLanguage ||
         detectedLang.startsWith(targetLanguage.split('-')[0]))) {
      targetLang = secondLanguage;
      didSwitch = true;
    }
  }

  // Only use cache when NOT auto-switching (to avoid stale language decisions)
  const shouldCache = useCache && !autoSwitch;
  const cacheKey = `${service}:${targetLang}:${text}`;
  if (shouldCache && cache.has(cacheKey)) {
    sendResponse({ result: cache.get(cacheKey), targetLang, detectedLang, didSwitch, fromCache: true });
    return;
  }

  try {
    const result = await doTranslate(text, targetLang, service, s);
    if (shouldCache && result) {
      cache.set(cacheKey, result);
      if (cache.size > 500) cache.delete(cache.keys().next().value);
    }
    sendResponse({ result, targetLang, detectedLang, didSwitch });
  } catch(err) {
    sendResponse({ error: err.message, targetLang, detectedLang, didSwitch });
  }
}

async function handleTranslation(msg, sendResponse) {
  const { text, targetLang, service, useCache:uc } = msg;
  if (!text?.trim()) { sendResponse({ error:'No text' }); return; }
  const key = `${service}:${targetLang}:${text}`;
  if (uc && cache.has(key)) { sendResponse({ result:cache.get(key), fromCache:true }); return; }
  const { settings:s } = await chrome.storage.sync.get('settings');
  try {
    const result = await doTranslate(text, targetLang, service, s);
    if (uc && result) { cache.set(key,result); if(cache.size>500) cache.delete(cache.keys().next().value); }
    sendResponse({ result });
  } catch(err) { sendResponse({ error:err.message }); }
}

async function handleWritingTranslate(msg, sender, sendResponse) {
  const { settings:s } = await chrome.storage.sync.get('settings');
  const targetLang = await resolveTargetLang(msg.text, s);
  try {
    const result = await googleTranslate(msg.text, targetLang);
    if (s?.writingTranslateMode === 'sidebar')
      chrome.runtime.sendMessage({action:'translateFromPage',text:msg.text,targetLang}).catch(()=>{});
    sendResponse({ translation:result.translation, targetLang, mode:s?.writingTranslateMode||'sidebar' });
  } catch(e) { sendResponse({ error:e.message }); }
}

async function handlePopupTranslate(msg, sender, sendResponse) {
  const { settings:s } = await chrome.storage.sync.get('settings');
  const targetLang = await resolveTargetLang(msg.text, s);
  const action = s?.popupAction || 'sidebar';
  if (action === 'replace') {
    const r = await doTranslate(msg.text, targetLang, s?.defaultService||'google', s);
    if (r?.translation) chrome.tabs.sendMessage(sender.tab.id,{action:'replaceSelectedText',translation:r.translation}).catch(()=>{});
    sendResponse({ translation:r?.translation, targetLang });
  } else if (action === 'clipboard') {
    const r = await doTranslate(msg.text, targetLang, s?.defaultService||'google', s);
    if (r?.translation) chrome.tabs.sendMessage(sender.tab.id,{action:'writeClipboard',text:r.translation}).catch(()=>{});
    if (s?.openInSidebar) { try{await chrome.sidePanel.open({tabId:sender.tab.id});}catch(e){} setTimeout(()=>chrome.runtime.sendMessage({action:'translateFromPage',text:msg.text,targetLang}).catch(()=>{}),600); }
    sendResponse({ translation:r?.translation, targetLang });
  } else {
    try{await chrome.sidePanel.open({tabId:sender.tab.id});}catch(e){}
    setTimeout(()=>chrome.runtime.sendMessage({action:'translateFromPage',text:msg.text,targetLang}).catch(()=>{}),600);
    sendResponse({ targetLang });
  }
}

async function handleUITranslation(msg, sendResponse) {
  const { texts, targetLang } = msg;
  if (targetLang === 'en') { sendResponse({ results: texts }); return; }
  try {
    const results = {};
    for (const [key, text] of Object.entries(texts)) {
      if (!text?.trim()) { results[key] = text; continue; }
      try { const r = await googleTranslate(text, targetLang); results[key] = r.translation || text; }
      catch(e) { results[key] = text; }
    }
    sendResponse({ results });
  } catch(e) { sendResponse({ error: e.message }); }
}

async function resolveTargetLang(text, s) {
  if (!s?.autoSwitchSecondLanguage) return s?.targetLanguage || 'en';
  const detected = await detectLang(text.substring(0, 100));
  const target = s.targetLanguage || 'en';
  const second = s.secondLanguage || 'es';
  if (detected && detected !== 'auto' && (detected===target||detected.startsWith(target.split('-')[0]))) return second;
  return target;
}

async function doTranslate(text, tl, service, s) {
  switch(service) {
    case 'google':    return googleTranslate(text, tl);
    case 'microsoft': return microsoftTranslate(text, tl, s?.microsoftApiKey);
    case 'deepl':     return deeplTranslate(text, tl, s?.deeplApiKey);
    case 'yandex':    return yandexTranslate(text, tl, s?.yandexApiKey);
    default: throw new Error('Unknown: '+service);
  }
}

async function googleTranslate(text, tl) {
  const r = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(tl)}&dt=t&dt=bd&dj=1&q=${encodeURIComponent(text)}`);
  if (!r.ok) throw new Error(`Google HTTP ${r.status}`);
  const d = await r.json();
  const translation = (d.sentences||[]).filter(s=>s.trans).map(s=>s.trans).join('');
  const candidates = [];
  if (d.dict) d.dict.forEach(e=>{if(e.terms)candidates.push(...e.terms.slice(0,3));});
  return { translation, candidates, detectedLang: d.src||'auto' };
}
async function microsoftTranslate(text, tl, key) {
  if (!key?.trim()) throw new Error('Microsoft requires an API key.');
  const m={'iw':'he','jw':'jv','zh-CN':'zh-Hans','zh-TW':'zh-Hant'};
  const r=await fetch(`https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&to=${encodeURIComponent(m[tl]||tl)}`,{method:'POST',headers:{'Content-Type':'application/json','Ocp-Apim-Subscription-Key':key},body:JSON.stringify([{Text:text}])});
  if(!r.ok)throw new Error(`Microsoft HTTP ${r.status}`);
  const d=await r.json();
  if(d?.[0])return{translation:d[0].translations[0].text,candidates:[],detectedLang:d[0].detectedLanguage?.language||'auto'};
  throw new Error('Microsoft: no result');
}
async function deeplTranslate(text, tl, key) {
  if(!key?.trim())throw new Error('DeepL requires an API key.');
  const m={'en':'EN-US','es':'ES','fr':'FR','de':'DE','it':'IT','pt':'PT-PT','nl':'NL','pl':'PL','ru':'RU','ja':'JA','zh-CN':'ZH','zh-TW':'ZH','ko':'KO','tr':'TR','sv':'SV','da':'DA','fi':'FI','el':'EL','cs':'CS','ro':'RO','hu':'HU','sk':'SK','bg':'BG','uk':'UK','id':'ID'};
  const host=key.endsWith(':fx')?'api-free.deepl.com':'api.deepl.com';
  const r=await fetch(`https://${host}/v2/translate`,{method:'POST',headers:{'Authorization':`DeepL-Auth-Key ${key}`,'Content-Type':'application/json'},body:JSON.stringify({text:[text],target_lang:m[tl]||tl.toUpperCase().split('-')[0]})});
  if(!r.ok)throw new Error(`DeepL HTTP ${r.status}`);
  const d=await r.json();
  if(d?.translations?.[0])return{translation:d.translations[0].text,candidates:[],detectedLang:d.translations[0].detected_source_language?.toLowerCase()||'auto'};
  throw new Error('DeepL: no result');
}
async function yandexTranslate(text, tl, key) {
  if(!key?.trim())throw new Error('Yandex requires an API key.');
  const r=await fetch('https://translate.api.cloud.yandex.net/translate/v2/translate',{method:'POST',headers:{'Authorization':`Api-Key ${key}`,'Content-Type':'application/json'},body:JSON.stringify({texts:[text],targetLanguageCode:tl})});
  if(!r.ok)throw new Error(`Yandex HTTP ${r.status}`);
  const d=await r.json();
  if(d?.translations?.[0])return{translation:d.translations[0].text,candidates:[],detectedLang:d.translations[0].detectedLanguageCode||'auto'};
  throw new Error('Yandex: no result');
}
async function detectLang(text) {
  try {
    const r=await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=${encodeURIComponent(text.substring(0,120))}`);
    const d=await r.json();
    return d.src||'auto';
  } catch(e){return 'auto';}
}
