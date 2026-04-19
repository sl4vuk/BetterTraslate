// Better Translate — Side Panel JS v10

const ALL_SVCS = ['google', 'microsoft', 'deepl', 'yandex'];
let settings       = {};
let selLang        = 'en';    // always = settings.targetLanguage (user's chosen lang)
let autoSwitchedTo = null;    // non-null = we auto-switched to this lang for current text
let curText        = '';
let curLang        = 'en';
let autoTranslateTimer = null;

// ─── i18n ─────────────────────────────────────────────────
let uiStrings = {};
const UI_STRINGS = {
  'placeholder':'Enter text to translate…',
  'translate-btn':'Translate',
  'empty-title':'Enter text and click Translate',
  'empty-sub':'Press Alt+A to open · Ctrl+Enter to translate',
  'detected':'Detected:',
  'copy':'Copy',
  'connection-error':'Connection error.',
};
function t(key){return uiStrings[key]||UI_STRINGS[key]||key;}

// ─── Boot ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();
  await applyInterfaceLang();
  applyTheme();
  buildLangList();
  bindEvents();
  updateServiceOrder();
  updateATBtn();
  restoreTextareaHeight();
  restoreLastText();
});

async function loadSettings() {
  return new Promise(r => {
    chrome.storage.sync.get('settings', d => {
      settings  = d.settings || {};
      selLang   = settings.targetLanguage || 'en';
      autoSwitchedTo = null;
      updateLangDisplay();
      r();
    });
  });
}

function restoreLastText() {
  try {
    chrome.storage.local.get('lastText', d => {
      const text = d?.lastText || '';
      const ta = document.getElementById('sourceText');
      ta.value = text;
      updateCharCount();
      autoResize(ta);
      if (text.trim() && settings.sidebarAutoTranslate) {
        translate();
      } else if (!text.trim()) {
        // Nothing to show
        showEmptyState();
      }
    });
  } catch(e) {}
}

function restoreTextareaHeight() {
  try {
    chrome.storage.local.get('taHeight', d => {
      if (d?.taHeight) document.getElementById('sourceText').style.height = d.taHeight;
    });
  } catch(e) {}
}

// ─── Interface Language ───────────────────────────────────
async function applyInterfaceLang() {
  const lang = settings.interfaceLanguage || 'en';
  try {
    const cached = await new Promise(r => chrome.storage.local.get(`ui_${lang}`, d => r(d[`ui_${lang}`])));
    if (cached) { uiStrings = cached; applyUIStrings(); return; }
  } catch(e) {}
  if (lang === 'en') { uiStrings = {}; return; }
  try {
    await new Promise(resolve => {
      chrome.runtime.sendMessage({ action:'translateUI', texts:UI_STRINGS, targetLang:lang }, res => {
        if (res?.results) { uiStrings=res.results; chrome.storage.local.set({[`ui_${lang}`]:uiStrings}); applyUIStrings(); }
        resolve();
      });
    });
  } catch(e) {}
}
function applyUIStrings() {
  const ta=document.getElementById('sourceText');
  if(ta&&uiStrings['placeholder'])ta.placeholder=uiStrings['placeholder'];
  const btn=document.getElementById('translateBtn');
  if(btn){const svg=btn.querySelector('svg');btn.textContent=uiStrings['translate-btn']||'Translate';if(svg)btn.prepend(svg);}
  const ep=document.querySelector('.empty-state p');if(ep)ep.textContent=t('empty-title');
  const es=document.querySelector('.empty-state span');if(es)es.textContent=t('empty-sub');
}

// ─── Theme ────────────────────────────────────────────────
function applyTheme() {
  document.body.classList.remove('theme-light','theme-dark','theme-system');
  document.body.classList.add(`theme-${settings.theme||'system'}`);
}
function cycleTheme() {
  const o=['system','light','dark'];
  settings.theme=o[(o.indexOf(settings.theme||'system')+1)%3];
  chrome.storage.sync.set({settings}); applyTheme();
  showToast(`Theme: ${settings.theme.charAt(0).toUpperCase()+settings.theme.slice(1)}`);
}

// ─── Auto-translate button ─────────────────────────────────
function updateATBtn() {
  const btn=document.getElementById('autoTranslateToggle');if(!btn)return;
  btn.classList.toggle('at-on',!!settings.sidebarAutoTranslate);
  btn.title=settings.sidebarAutoTranslate?'Auto-translate: ON':'Auto-translate: OFF';
}

// ─── Language display ─────────────────────────────────────
// The dropdown always shows: autoSwitchedTo if active, otherwise selLang (= targetLanguage)
function getCurrentDisplayLang() {
  return autoSwitchedTo || selLang;
}

function buildLangList(filter='') {
  const list=document.getElementById('langList');list.innerHTML='';
  const lf=filter.toLowerCase();
  const current=getCurrentDisplayLang();
  const items=LANGUAGES.filter(l=>
    l.name.toLowerCase().includes(lf)||l.native.toLowerCase().includes(lf)||l.code.toLowerCase().includes(lf)
  );
  if(!items.length){list.innerHTML='<div class="lang-empty">No results</div>';return;}
  items.forEach(lang=>{
    const d=document.createElement('div');
    d.className='lang-item'+(lang.code===current?' selected':'');
    d.innerHTML=`<span class="lang-name">${lang.name}</span><span class="lang-native">${lang.native}</span>`;
    d.addEventListener('click',()=>{
      // Manual selection: override auto-switch, update target language
      selLang=lang.code;
      autoSwitchedTo=null;
      settings.targetLanguage=lang.code;
      chrome.storage.sync.set({settings});
      // Clear cache since target changed
      chrome.runtime.sendMessage({action:'clearCache'});
      updateLangDisplay();
      closeLangDrop();
    });
    list.appendChild(d);
  });
}

function updateLangDisplay() {
  const code=getCurrentDisplayLang();
  const l=LANGUAGES.find(x=>x.code===code);
  document.getElementById('selectedLangName').textContent=l?l.name:code;
}

function openLangDrop() {
  document.getElementById('langDropdown').classList.add('open');
  document.getElementById('langSelectBtn').classList.add('open');
  document.getElementById('dropdownOverlay').classList.add('active');
  const si=document.getElementById('langSearch');si.value='';buildLangList();si.focus();
  setTimeout(()=>document.querySelector('#langList .selected')?.scrollIntoView({block:'nearest'}),60);
}
function closeLangDrop() {
  document.getElementById('langDropdown').classList.remove('open');
  document.getElementById('langSelectBtn').classList.remove('open');
  document.getElementById('dropdownOverlay').classList.remove('active');
}

// ─── Service order ────────────────────────────────────────
function updateServiceOrder() {
  const enabled=settings.enabledServices||['google'];
  const def=settings.defaultService||enabled[0]||'google';
  const sec=document.getElementById('resultsSection');
  ALL_SVCS.forEach(s=>{const c=document.getElementById(`card-${s}`);if(c)c.style.display='none';});
  [def,...enabled.filter(s=>s!==def)].forEach(svc=>{
    const c=document.getElementById(`card-${svc}`);
    if(c){c.style.display='block';sec.appendChild(c);}
  });
}

// ─── TRANSLATION ──────────────────────────────────────────
async function translate() {
  const text = document.getElementById('sourceText').value.trim();

  // EMPTY INPUT: clear results and save empty state
  if (!text) {
    showEmptyState();
    // Revert to base target language when cleared
    revertToTargetLang();
    try { chrome.storage.local.set({lastText:''}); } catch(e) {}
    return;
  }

  curText = text;
  const maxLen = settings.breakLimit && settings.charLimit > 0 ? settings.charLimit : 5000;
  const srcText = text.substring(0, maxLen);
  const enabled  = settings.enabledServices || ['google'];
  const primary  = settings.defaultService || enabled[0] || 'google';
  const others   = enabled.filter(s => s !== primary);

  document.getElementById('resultsSection').style.display='flex';
  document.getElementById('emptyState').style.display='none';
  try { chrome.storage.local.set({lastText:srcText}); } catch(e) {}

  if (primary === 'google') {
    // FAST PATH: single roundtrip — detect + translate together
    primeCard('google');
    chrome.runtime.sendMessage({
      action: 'detectAndTranslate',
      text: srcText,
      targetLanguage: settings.targetLanguage || 'en',
      secondLanguage: settings.secondLanguage  || 'es',
      autoSwitch: !!settings.autoSwitchSecondLanguage,
      service: 'google',
      useCache: !!settings.translationCache
    }, resp => {
      if (chrome.runtime.lastError || !resp) { showCardErr('google', t('connection-error')); return; }

      // resp.targetLang is what background actually used (may be second if switched)
      const usedLang = resp.targetLang || settings.targetLanguage || 'en';
      curLang = usedLang;

      // Update auto-switch display
      if (settings.autoSwitchSecondLanguage && resp.didSwitch) {
        autoSwitchedTo = usedLang;  // e.g. 'es'
      } else if (settings.autoSwitchSecondLanguage && !resp.didSwitch) {
        autoSwitchedTo = null;       // back to target
      }
      // If auto-switch is OFF, never touch autoSwitchedTo
      updateLangDisplay();
      buildLangList(document.getElementById('langSearch')?.value||'');

      if (resp.error) { showCardErr('google', resp.error); return; }
      if (resp.result) showCardResult('google', resp.result);

      others.forEach(svc => runTranslation(svc, srcText, usedLang));
    });

  } else {
    // Non-Google primary: need to detect first
    const usedLang = await detectForTranslation(srcText);
    curLang = usedLang;
    enabled.forEach(svc => runTranslation(svc, srcText, usedLang));
  }
}

async function detectForTranslation(text) {
  if (!settings.autoSwitchSecondLanguage) return selLang;
  return new Promise(resolve => {
    chrome.runtime.sendMessage({action:'detectLanguage', text:text.substring(0,100)}, res => {
      if (chrome.runtime.lastError) { resolve(selLang); return; }
      const detected = res?.lang || 'auto';
      const target   = settings.targetLanguage || 'en';
      const second   = settings.secondLanguage || 'es';
      if (detected && detected !== 'auto' &&
          (detected===target||detected.startsWith(target.split('-')[0]))) {
        autoSwitchedTo = second;
        resolve(second);
      } else {
        autoSwitchedTo = null;
        resolve(target);
      }
      updateLangDisplay();
      buildLangList();
    });
  });
}

// Revert dropdown to base target language (when text is cleared or different lang detected)
function revertToTargetLang() {
  if (autoSwitchedTo !== null) {
    autoSwitchedTo = null;
    selLang = settings.targetLanguage || 'en';
    updateLangDisplay();
    buildLangList();
  }
}

// ─── Card rendering ───────────────────────────────────────
function primeCard(service) {
  const spinner =document.getElementById(`spinner-${service}`);
  const transEl =document.getElementById(`trans-${service}`);
  const detectEl=document.getElementById(`detected-${service}`);
  const cpHdr   =document.querySelector(`.copy-btn[data-service="${service}"]`);
  const retryBtn=document.querySelector(`.retry-btn[data-service="${service}"]`);
  const cpFtr   =document.getElementById(`copyresult-${service}`);
  const body    =document.getElementById(`body-${service}`);
  if(!transEl||!body)return;
  spinner?.classList.add('active');
  transEl.textContent='Translating…'; transEl.className='translation-text loading';
  if(cpHdr)cpHdr.style.display='none'; if(retryBtn)retryBtn.style.display='none';
  if(cpFtr)cpFtr.style.display='none'; body.classList.remove('hidden');
  if(detectEl)detectEl.textContent='';
  if(service==='google'){const c=document.getElementById('candidates-google');if(c)c.innerHTML='';}
}

function showCardResult(service, result) {
  const spinner =document.getElementById(`spinner-${service}`);
  const transEl =document.getElementById(`trans-${service}`);
  const detectEl=document.getElementById(`detected-${service}`);
  const cpHdr   =document.querySelector(`.copy-btn[data-service="${service}"]`);
  const cpFtr   =document.getElementById(`copyresult-${service}`);
  if(!transEl)return;
  spinner?.classList.remove('active');
  const {translation,candidates,detectedLang}=result;
  transEl.textContent=translation||'—'; transEl.className='translation-text';
  if(detectedLang&&detectedLang!=='auto'){
    const lo=LANGUAGES.find(l=>l.code===detectedLang||l.code.startsWith(detectedLang.split('-')[0]));
    if(detectEl)detectEl.textContent=`${t('detected')} ${lo?lo.name:detectedLang}`;
  }
  if(service==='google'&&settings.showMultipleCandidates&&candidates?.length){
    const cEl=document.getElementById('candidates-google');
    if(cEl){cEl.innerHTML='';candidates.slice(0,6).forEach(c=>{const ch=document.createElement('div');ch.className='candidate-chip';ch.textContent=c;ch.addEventListener('click',()=>{navigator.clipboard.writeText(c).catch(()=>{});showToast('Copied!');});cEl.appendChild(ch);});}
  }
  if(cpHdr)cpHdr.style.display='flex'; if(cpFtr)cpFtr.style.display='flex';
}

function showCardErr(service, msg) {
  const spinner =document.getElementById(`spinner-${service}`);
  const transEl =document.getElementById(`trans-${service}`);
  const retryBtn=document.querySelector(`.retry-btn[data-service="${service}"]`);
  if(!transEl)return;
  spinner?.classList.remove('active');
  transEl.textContent=msg; transEl.className='translation-text error';
  if(retryBtn)retryBtn.style.display='flex';
}

function runTranslation(service, text, targetLang) {
  primeCard(service);
  chrome.runtime.sendMessage(
    {action:'translate', text, targetLang, service, useCache:!!settings.translationCache},
    resp=>{
      if(chrome.runtime.lastError||!resp){showCardErr(service,t('connection-error'));return;}
      if(resp.error){showCardErr(service,resp.error);return;}
      if(resp.result)showCardResult(service,resp.result);
    }
  );
}

// ─── UI Helpers ───────────────────────────────────────────
function showEmptyState() {
  document.getElementById('resultsSection').style.display='none';
  document.getElementById('emptyState').style.display='flex';
}

function toggleCard(svc){
  const body=document.getElementById(`body-${svc}`);
  const chev=document.querySelector(`.chevron-btn[data-service="${svc}"]`);
  if(!body)return;chev?.classList.toggle('collapsed',body.classList.toggle('hidden'));
}

function copyTranslation(svc){
  const tt=document.getElementById(`trans-${svc}`)?.textContent;
  if(tt&&tt!=='—'&&!tt.startsWith('Translating'))
    navigator.clipboard.writeText(tt).then(()=>showToast('Copied!')).catch(()=>{});
}

function updateCharCount(){
  const ta=document.getElementById('sourceText');
  const limit=settings.breakLimit&&settings.charLimit>0?settings.charLimit:5000;
  document.getElementById('charCount').textContent=ta.value.length;
  document.getElementById('charLimit').textContent=limit;
}

function autoResize(el){
  if(el.dataset.manualResize)return;
  el.style.height='auto';
  el.style.height=Math.min(el.scrollHeight,300)+'px';
}

function clearAll(){
  const ta=document.getElementById('sourceText');
  ta.value='';ta.style.height='auto';delete ta.dataset.manualResize;
  updateCharCount();
  revertToTargetLang();
  clearTimeout(autoTranslateTimer);
  try{chrome.storage.local.set({lastText:''});}catch(e){}
  ALL_SVCS.forEach(s=>{
    const tx=document.getElementById(`trans-${s}`),
          d=document.getElementById(`detected-${s}`),
          f=document.getElementById(`copyresult-${s}`),
          c=document.querySelector(`.copy-btn[data-service="${s}"]`),
          sp=document.getElementById(`spinner-${s}`);
    if(tx)tx.textContent='';if(d)d.textContent='';
    if(f)f.style.display='none';if(c)c.style.display='none';
    if(sp)sp.classList.remove('active');
  });
  const gc=document.getElementById('candidates-google');if(gc)gc.innerHTML='';
  showEmptyState();
}

function showToast(msg){
  document.querySelector('.toast')?.remove();
  const t=document.createElement('div');t.className='toast';t.textContent=msg;
  document.body.appendChild(t);setTimeout(()=>t.remove(),1800);
}

// ─── Events ───────────────────────────────────────────────
function bindEvents(){
  document.getElementById('themeToggle').addEventListener('click',cycleTheme);
  document.getElementById('openSettings').addEventListener('click',()=>chrome.runtime.openOptionsPage());

  document.getElementById('autoTranslateToggle').addEventListener('click',()=>{
    settings.sidebarAutoTranslate=!settings.sidebarAutoTranslate;
    chrome.storage.sync.set({settings}); updateATBtn();
    showToast(settings.sidebarAutoTranslate?'Auto-translate ON':'Auto-translate OFF');
    // Translate immediately if ON and there's text
    if(settings.sidebarAutoTranslate){
      const ta=document.getElementById('sourceText');
      if(ta.value.trim()) translate();
    }
  });

  const ta=document.getElementById('sourceText');

  // Resizable: save height via ResizeObserver
  if(window.ResizeObserver){
    new ResizeObserver(()=>{
      if(ta.style.height&&ta.style.height!=='auto'){
        ta.dataset.manualResize='1';
        try{chrome.storage.local.set({taHeight:ta.style.height});}catch(e){}
      }
    }).observe(ta);
  }

  ta.addEventListener('input',()=>{
    updateCharCount();
    if(!ta.dataset.manualResize)autoResize(ta);

    if(!ta.value.trim()){
      // Input became empty: clear results immediately and revert lang
      showEmptyState();
      revertToTargetLang();
      clearTimeout(autoTranslateTimer);
      try{chrome.storage.local.set({lastText:''});}catch(e){}
      return;
    }

    if(settings.sidebarAutoTranslate){
      clearTimeout(autoTranslateTimer);
      autoTranslateTimer=setTimeout(()=>{
        if(ta.value.trim()) translate();
      }, 300);
    }
  });

  ta.addEventListener('keydown',e=>{
    if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();translate();}
  });
  updateCharCount();

  document.getElementById('copySource').addEventListener('click',()=>{
    navigator.clipboard.writeText(ta.value).then(()=>showToast('Copied!')).catch(()=>{});
  });
  document.getElementById('clearText').addEventListener('click',clearAll);

  document.getElementById('langSelectBtn').addEventListener('click',e=>{
    e.stopPropagation();
    document.getElementById('langDropdown').classList.contains('open')?closeLangDrop():openLangDrop();
  });
  document.getElementById('dropdownOverlay').addEventListener('click',closeLangDrop);
  document.getElementById('langSearch').addEventListener('input',e=>buildLangList(e.target.value));
  document.getElementById('translateBtn').addEventListener('click',translate);

  document.getElementById('resultsSection').addEventListener('click',e=>{
    const chev=e.target.closest('.chevron-btn');if(chev){toggleCard(chev.dataset.service);return;}
    const hdr=e.target.closest('.service-header');if(hdr&&!e.target.closest('.service-actions')){toggleCard(hdr.closest('.service-card')?.dataset.service);return;}
    const cp=e.target.closest('.copy-btn');if(cp){copyTranslation(cp.dataset.service);return;}
    const rt=e.target.closest('.retry-btn');if(rt&&curText){runTranslation(rt.dataset.service,curText,curLang);return;}
    const cf=e.target.closest('.copy-result-btn');if(cf){copyTranslation(cf.id.replace('copyresult-',''));}
  });
}

// ─── Storage sync ─────────────────────────────────────────
chrome.storage.onChanged.addListener(changes=>{
  if(!changes.settings)return;
  const prev={...settings};
  settings={...(changes.settings.newValue||settings)};

  // Sync target language from settings page → update dropdown
  if(settings.targetLanguage!==prev.targetLanguage){
    selLang=settings.targetLanguage;
    autoSwitchedTo=null;  // reset any auto-switch when target changes
    updateLangDisplay();
    buildLangList();
  }
  // If auto-switch was turned off, revert to target lang display
  if(!settings.autoSwitchSecondLanguage&&prev.autoSwitchSecondLanguage){
    revertToTargetLang();
  }
  if(settings.theme!==prev.theme)applyTheme();
  if(settings.sidebarAutoTranslate!==prev.sidebarAutoTranslate)updateATBtn();
  if(settings.interfaceLanguage!==prev.interfaceLanguage){
    try{chrome.storage.local.remove(`ui_${prev.interfaceLanguage}`);}catch(e){}
    applyInterfaceLang();
  }
  updateServiceOrder();
  updateCharCount();
});

chrome.runtime.onMessage.addListener(msg=>{
  if((msg.action==='translateFromPage'||msg.action==='copyToTranslate')&&msg.text){
    const ta=document.getElementById('sourceText');
    ta.value=msg.text; updateCharCount();
    if(!ta.dataset.manualResize)autoResize(ta);
    if(msg.targetLang){
      selLang=msg.targetLang; autoSwitchedTo=null;
      settings.targetLanguage=msg.targetLang;
      chrome.storage.sync.set({settings});
      updateLangDisplay();
    }
    translate();
  }
  if(msg.action==='settingsBroadcast'&&msg.settings){
    const prev={...settings}; settings=msg.settings;
    if(settings.targetLanguage!==prev.targetLanguage){selLang=settings.targetLanguage;autoSwitchedTo=null;updateLangDisplay();buildLangList();}
    if(!settings.autoSwitchSecondLanguage&&prev.autoSwitchSecondLanguage)revertToTargetLang();
    if(settings.theme!==prev.theme)applyTheme();
    if(settings.sidebarAutoTranslate!==prev.sidebarAutoTranslate)updateATBtn();
    if(settings.interfaceLanguage!==prev.interfaceLanguage)applyInterfaceLang();
    updateServiceOrder(); updateCharCount();
  }
});

// Initialize result area
showEmptyState();
