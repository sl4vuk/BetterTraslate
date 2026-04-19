// Better Translate — Settings JS v8

const SERVICES = ['google','microsoft','deepl','yandex'];
let settings = {};

const DEF = {
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

const FORBIDDEN = [
  'ctrl+n','ctrl+shift+n','ctrl+t','ctrl+shift+t','ctrl+tab','ctrl+shift+tab',
  'ctrl+1','ctrl+2','ctrl+3','ctrl+4','ctrl+5','ctrl+6','ctrl+7','ctrl+8','ctrl+9',
  'ctrl+w','ctrl+f4','ctrl+shift+w','alt+f4','ctrl+shift+pageup','ctrl+shift+pagedown',
  'alt+left','alt+right','alt+home','f11','f6',
  'meta+n','meta+shift+n','meta+t','meta+shift+t','meta+w','meta+shift+w',
  'meta+1','meta+2','meta+3','meta+4','meta+5','meta+6','meta+7','meta+8','meta+9'
];

const SEARCH_INDEX = [
  {name:'Target Language',cat:'General',sec:'general',icon:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.8"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10A15.3 15.3 0 0 1 8 12a15.3 15.3 0 0 1 4-10Z" stroke="currentColor" stroke-width="1.8"/></svg>',keywords:'target language default translate'},
  {name:'Second Language',cat:'General',sec:'general',icon:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.8"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10A15.3 15.3 0 0 1 8 12a15.3 15.3 0 0 1 4-10Z" stroke="currentColor" stroke-width="1.8"/></svg>',keywords:'second language source matches'},
  {name:'Auto-switch to Second Language',cat:'General',sec:'general',icon:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',keywords:'auto switch second target source detect'},
  {name:'Interface Language',cat:'General',sec:'general',icon:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M4 5h7M9 3v2M3 10h4M3 15h4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',keywords:'interface language ui display translate'},
  {name:'Break Limit',cat:'General',sec:'general',icon:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" stroke-width="1.8"/><path d="M9 9h6M9 12h6M9 15h4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',keywords:'break limit character custom max input'},
  {name:'Disabled Sites',cat:'General',sec:'general',icon:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.8"/><path d="M4.93 4.93l14.14 14.14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',keywords:'disabled sites block extension url website'},
  {name:'Translation Cache',cat:'Translation',sec:'translation',icon:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M20 7H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2Z" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="2" stroke="currentColor" stroke-width="1.8"/></svg>',keywords:'translation cache speed store results'},
  {name:'Show Translation Candidates',cat:'Translation',sec:'translation',icon:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M3 6h18M3 12h18M3 18h11" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',keywords:'candidates alternatives single word options'},
  {name:'Auto-translate in Sidebar',cat:'Translation',sec:'translation',icon:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',keywords:'auto translate sidebar automatic'},
  {name:'Context Menu',cat:'Triggers',sec:'triggers',icon:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" stroke-width="1.8"/><path d="M3 9h18M9 21V9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',keywords:'context menu right click translate'},
  {name:'Only on sidebar open',cat:'Triggers',sec:'triggers',icon:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" stroke-width="1.8"/><path d="M9 3v18M15 9l-3 3 3 3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',keywords:'only sidebar open background translate'},
  {name:'Open in sidebar',cat:'Triggers',sec:'triggers',icon:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" stroke-width="1.8"/><path d="M9 3v18" stroke="currentColor" stroke-width="1.8"/></svg>',keywords:'open sidebar panel clipboard'},
  {name:'Translate on Modifier Key',cat:'Triggers',sec:'triggers',icon:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="2" y="6" width="20" height="12" rx="2" stroke="currentColor" stroke-width="1.8"/><path d="M6 12h4M14 10v4M17 10v4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',keywords:'modifier key shortcut keyboard translate'},
  {name:'Translate while Writing',cat:'Triggers',sec:'triggers',icon:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',keywords:'writing translate real time typing input'},
  {name:'Translate on Copy',cat:'Triggers',sec:'triggers',icon:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" stroke-width="1.8"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke="currentColor" stroke-width="1.8"/></svg>',keywords:'copy translate clipboard'},
  {name:'Translate on Popup',cat:'Triggers',sec:'triggers',icon:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',keywords:'popup selection mini button translate'},
  {name:'Google Translate',cat:'Services',sec:'services',icon:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10Z" stroke="currentColor" stroke-width="1.8"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10A15.3 15.3 0 0 1 8 12a15.3 15.3 0 0 1 4-10Z" stroke="currentColor" stroke-width="1.8"/></svg>',keywords:'google translate service free'},
  {name:'Microsoft Translate',cat:'Services',sec:'services',icon:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="8" height="8" rx="1" stroke="currentColor" stroke-width="1.8"/><rect x="13" y="3" width="8" height="8" rx="1" stroke="currentColor" stroke-width="1.8"/><rect x="3" y="13" width="8" height="8" rx="1" stroke="currentColor" stroke-width="1.8"/><rect x="13" y="13" width="8" height="8" rx="1" stroke="currentColor" stroke-width="1.8"/></svg>',keywords:'microsoft translate bing azure api'},
  {name:'DeepL',cat:'Services',sec:'services',icon:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',keywords:'deepl translate ai quality api'},
  {name:'Yandex Translate',cat:'Services',sec:'services',icon:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.8"/><path d="M9 7h3.5a3.5 3.5 0 0 1 0 7H11v3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',keywords:'yandex translate cloud api'},
];

document.addEventListener('DOMContentLoaded', async () => {
  await load();
  applyTheme();
  setupNav();
  buildLangDropdowns();
  toUI();
  bindEvents();
  setupSearch();
  renderSiteList();
  updateVersionDisplay();
  updateServicesUI();
  // Apply interface language to settings page too
  applySettingsInterfaceLang();
});

// ─── Load / Persist ───────────────────────────────────────
async function load() {
  return new Promise(r => chrome.storage.sync.get('settings', d => { settings={...DEF,...(d.settings||{})}; r(); }));
}
function persist() {
  ['microsoft','deepl','yandex'].forEach(svc=>{
    const k={microsoft:'microsoftApiKey',deepl:'deeplApiKey',yandex:'yandexApiKey'}[svc];
    if(!settings[k]?.trim()&&settings.enabledServices.includes(svc)){
      settings.enabledServices=settings.enabledServices.filter(s=>s!==svc);
      const el=document.getElementById(`enable${cap(svc)}`);if(el)el.checked=false;
      document.getElementById(`apirow-${svc}`)?.classList.remove('visible');
    }
  });
  if(!settings.enabledServices.includes(settings.defaultService))
    settings.defaultService=settings.enabledServices[0]||'google';
  chrome.storage.sync.set({settings});
  updateServicesUI();
}
function cap(s){return s.charAt(0).toUpperCase()+s.slice(1);}

// ─── Interface language in settings page ──────────────────
// Translates settings labels using Google Translate API
async function applySettingsInterfaceLang() {
  const lang = settings.interfaceLanguage || 'en';
  if (lang === 'en') return;
  // Check if we have a cached settings translation
  const cached = await new Promise(r=>chrome.storage.local.get(`ui_settings_${lang}`,d=>r(d[`ui_settings_${lang}`])));
  if (cached) { applySettingsStrings(cached); return; }
  // Collect all text nodes from settings labels
  const labels = {};
  document.querySelectorAll('.setting-label,.setting-desc,.group-title,.group-desc,.radio-title,.radio-desc,.svc-name,.svc-desc,.section-header h1,.section-header p').forEach((el,i)=>{
    const key=`s${i}`;labels[key]=el.textContent.trim();el.dataset.i18nKey=key;
  });
  // Translate them
  chrome.runtime.sendMessage({action:'translateUI',texts:labels,targetLang:lang},res=>{
    if(!res?.results)return;
    chrome.storage.local.set({[`ui_settings_${lang}`]:res.results});
    applySettingsStrings(res.results);
  });
}
function applySettingsStrings(strings) {
  document.querySelectorAll('[data-i18n-key]').forEach(el=>{
    const t=strings[el.dataset.i18nKey];
    if(t)el.textContent=t;
  });
}

// ─── Theme ────────────────────────────────────────────────
function applyTheme(){
  document.body.classList.remove('theme-light','theme-dark','theme-system');
  document.body.classList.add(`theme-${settings.theme||'system'}`);
  document.getElementById('themeLabel').textContent={system:'System',light:'Light',dark:'Dark'}[settings.theme]||'System';
}
function cycleTheme(){
  const o=['system','light','dark'];
  settings.theme=o[(o.indexOf(settings.theme||'system')+1)%3];
  applyTheme();persist();
}

// ─── Nav ──────────────────────────────────────────────────
function setupNav(){
  document.querySelectorAll('.nav-item').forEach(btn=>btn.addEventListener('click',()=>{
    document.querySelectorAll('.nav-item').forEach(b=>b.classList.remove('active'));
    document.querySelectorAll('.settings-section').forEach(s=>s.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`section-${btn.dataset.section}`).classList.add('active');
  }));
}

// ─── Language Dropdowns ───────────────────────────────────
function buildLangDropdowns(){
  setupLang('target',settings.targetLanguage||'en',v=>{settings.targetLanguage=v;persist();});
  setupLang('second',settings.secondLanguage||'es',v=>{settings.secondLanguage=v;persist();});
  setupLang('iface', settings.interfaceLanguage||'en',v=>{
    settings.interfaceLanguage=v;
    // Clear all UI caches when language changes
    chrome.storage.local.remove([`ui_${settings.interfaceLanguage}`,`ui_settings_${settings.interfaceLanguage}`]);
    persist();
    showToast('Interface language updated. Reload to apply.');
  });
}

function setupLang(id,init,onChange){
  const btn=document.getElementById(`${id}LangBtn`),dd=document.getElementById(`${id}LangDropdown`),
        srch=document.getElementById(`${id}LangSearch`),list=document.getElementById(`${id}LangList`),
        nm=document.getElementById(`${id}LangName`);
  let code=init;
  const display=()=>{const l=LANGUAGES.find(x=>x.code===code);nm.textContent=l?l.name:code;};
  const render=(f='')=>{
    list.innerHTML='';
    LANGUAGES.filter(l=>l.name.toLowerCase().includes(f.toLowerCase())||l.native.toLowerCase().includes(f.toLowerCase()))
      .forEach(l=>{
        const d=document.createElement('div');
        d.className='lang-item'+(l.code===code?' selected':'');
        d.innerHTML=`<span class="lang-name">${l.name}</span><span class="lang-native">${l.native}</span>`;
        d.addEventListener('click',()=>{code=l.code;display();onChange(l.code);close();});
        list.appendChild(d);
      });
  };
  const positionDd=()=>{
    const r=btn.getBoundingClientRect();
    const sh=window.innerHeight-r.bottom;
    if(sh>=260||sh>r.top){dd.style.top=(r.bottom+4)+'px';dd.style.bottom='auto';}
    else{dd.style.bottom=(window.innerHeight-r.top+4)+'px';dd.style.top='auto';}
    dd.style.left=r.right-Math.max(210,r.width)+'px';
    dd.style.width=Math.max(210,r.width)+'px';
  };
  const open=()=>{
    document.querySelectorAll('.lang-dropdown.open').forEach(x=>x.classList.remove('open'));
    document.querySelectorAll('.select-btn.open').forEach(x=>x.classList.remove('open'));
    positionDd();dd.classList.add('open');btn.classList.add('open');
    document.getElementById('dropdownOverlay').classList.add('active');
    srch.focus();render();
    setTimeout(()=>{list.querySelector('.selected')?.scrollIntoView({block:'nearest'});},60);
  };
  const close=()=>{dd.classList.remove('open');btn.classList.remove('open');document.getElementById('dropdownOverlay').classList.remove('active');srch.value='';render();};
  btn.addEventListener('click',e=>{e.stopPropagation();dd.classList.contains('open')?close():open();});
  srch.addEventListener('input',e=>render(e.target.value));
  window.addEventListener('scroll',()=>{if(dd.classList.contains('open'))positionDd();},{passive:true});
  window.addEventListener('resize',()=>{if(dd.classList.contains('open'))positionDd();});
  display();
}

// ─── UI → settings ────────────────────────────────────────
function toUI(){
  const cbs={
    autoSwitch:'autoSwitchSecondLanguage',translationCache:'translationCache',
    showCandidates:'showMultipleCandidates',sidebarAutoTranslate:'sidebarAutoTranslate',
    breakLimit:'breakLimit',
    translateOnModifier:'translateOnModifier',writingTranslate:'writingTranslate',
    contextMenu:'contextMenu',copyToTranslate:'copyToTranslate',translateOnPopup:'translateOnPopup',
    openInSidebar:'openInSidebar',onlySidebarOpen:'onlySidebarOpen',
    disabledSitesEnabled:'disabledSitesEnabled'
  };
  Object.entries(cbs).forEach(([id,key])=>{const el=document.getElementById(id);if(el)el.checked=!!settings[key];});

  const sp=document.getElementById('writingSpeed');if(sp)sp.value=settings.writingTranslateSpeed||'medium';
  const kb=document.getElementById('modifierCombo');if(kb)kb.value=settings.modifierCombo||'Alt+W';
  const cl=document.getElementById('charLimit');if(cl)cl.value=settings.charLimit||5000;

  const setR=(name,val)=>{const el=document.querySelector(`input[name="${name}"][value="${val}"]`);if(el)el.checked=true;};
  setR('modifierAction',settings.modifierAction||'sidebar');
  setR('writingMode',settings.writingTranslateMode||'sidebar');
  setR('contextMenuAction',settings.contextMenuAction||'sidebar');
  setR('copyAction',settings.copyToTranslateAction||'sidebar');
  setR('popupAction',settings.popupAction||'sidebar');

  const en=settings.enabledServices||['google'];
  document.getElementById('enableGoogle').checked   =en.includes('google');
  document.getElementById('enableMicrosoft').checked=en.includes('microsoft');
  document.getElementById('enableDeepL').checked    =en.includes('deepl');
  document.getElementById('enableYandex').checked   =en.includes('yandex');
  document.getElementById('microsoftApiKey').value=settings.microsoftApiKey||'';
  document.getElementById('deeplApiKey').value    =settings.deeplApiKey||'';
  document.getElementById('yandexApiKey').value   =settings.yandexApiKey||'';

  updateSubSettings();updateApiKeyRows();
}

function updateSubSettings(){
  const show=(id,v)=>document.getElementById(id)?.classList.toggle('visible',!!v);
  show('modifierSubSettings',settings.translateOnModifier);
  show('writingSubSettings',settings.writingTranslate);
  show('contextMenuSubSettings',settings.contextMenu);
  show('copySubSettings',settings.copyToTranslate);
  show('popupSubSettings',settings.translateOnPopup);
  show('breakLimitSubSettings',settings.breakLimit);
  // Disabled sites sub is always visible (content visible via CSS)
}

function updateApiKeyRows(){
  ['microsoft','deepl','yandex'].forEach(svc=>{
    const en=(settings.enabledServices||[]).includes(svc);
    document.getElementById(`apirow-${svc}`)?.classList.toggle('visible',en);
  });
}
function updateServicesUI(){
  const def=settings.defaultService||'google';
  SERVICES.forEach(svc=>{
    document.getElementById(`svcrow-${svc}`)?.classList.toggle('is-default',svc===def);
    const b=document.getElementById(`badge-${svc}`);if(b)b.style.display=svc===def?'inline-block':'none';
  });
}

// ─── Disabled Sites ───────────────────────────────────────
function renderSiteList(){
  const list=document.getElementById('siteList');
  const empty=document.getElementById('siteListEmpty');
  const sites=settings.disabledSites||[];
  // Remove all site items (not the empty msg)
  list.querySelectorAll('.site-item').forEach(el=>el.remove());
  if(!sites.length){empty.style.display='block';return;}
  empty.style.display='none';
  sites.forEach((site,i)=>{
    const item=document.createElement('div');
    item.className='site-item';
    const faviconUrl=`https://www.google.com/s2/favicons?domain=${encodeURIComponent(site)}&sz=16`;
    item.innerHTML=`
      <img class="site-favicon" src="${faviconUrl}" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
      <div class="site-favicon-fallback" style="display:none">${site.charAt(0).toUpperCase()}</div>
      <span class="site-url">${site}</span>
      <button class="site-remove" data-idx="${i}" title="Remove">×</button>`;
    item.querySelector('.site-remove').addEventListener('click',e=>{
      const idx=parseInt(e.target.dataset.idx);
      settings.disabledSites.splice(idx,1);
      persist();renderSiteList();
    });
    list.appendChild(item);
  });
}

function addSite(url){
  if(!url)return;
  let site=url.trim().replace(/^https?:\/\//,'').replace(/\/.*$/,'');
  if(!site)return;
  if(!settings.disabledSites)settings.disabledSites=[];
  if(settings.disabledSites.includes(site)){showToast('Site already in list');return;}
  settings.disabledSites.push(site);
  persist();renderSiteList();
  document.getElementById('siteInput').value='';
}

// ─── Search ───────────────────────────────────────────────
function setupSearch(){
  const inp=document.getElementById('settingsSearchInput'),clr=document.getElementById('searchClear'),
        results=document.getElementById('searchResults'),empty=document.getElementById('searchEmpty');
  inp.addEventListener('input',()=>{
    const q=inp.value.trim().toLowerCase();
    clr.style.display=q?'block':'none';results.innerHTML='';
    if(!q){empty.classList.remove('visible');return;}
    const matched=SEARCH_INDEX.filter(item=>item.name.toLowerCase().includes(q)||item.keywords.toLowerCase().includes(q));
    if(!matched.length){empty.classList.add('visible');return;}
    empty.classList.remove('visible');
    matched.forEach(item=>{
      const row=document.createElement('div');row.className='search-item';
      const nl=item.name.toLowerCase(),idx=nl.indexOf(q);
      let hi=item.name;
      if(idx!==-1)hi=item.name.substring(0,idx)+`<mark>${item.name.substring(idx,idx+q.length)}</mark>`+item.name.substring(idx+q.length);
      row.innerHTML=`<div class="search-item-icon">${item.icon}</div><div><div class="search-item-name">${hi}</div><div class="search-item-cat">${item.cat}</div></div>`;
      row.addEventListener('click',()=>{
        document.querySelectorAll('.nav-item').forEach(b=>b.classList.remove('active'));
        document.querySelectorAll('.settings-section').forEach(s=>s.classList.remove('active'));
        const nb=document.querySelector(`.nav-item[data-section="${item.sec}"]`);if(nb)nb.classList.add('active');
        const sec=document.getElementById(`section-${item.sec}`);if(sec){sec.classList.add('active');sec.scrollIntoView({behavior:'smooth'});}
        inp.value='';clr.style.display='none';results.innerHTML='';empty.classList.remove('visible');
      });
      results.appendChild(row);
    });
  });
  clr.addEventListener('click',()=>{inp.value='';clr.style.display='none';results.innerHTML='';empty.classList.remove('visible');});
}

// ─── Keybind ──────────────────────────────────────────────
function setupKeybindRecorder(){
  const inp=document.getElementById('modifierCombo'),errEl=document.getElementById('modifierComboError'),clr=document.getElementById('modifierComboClear');
  let rec=false;
  inp.addEventListener('click',()=>{rec=true;inp.classList.add('recording');inp.value='Press keys…';if(errEl)errEl.textContent='';});
  inp.addEventListener('keydown',e=>{
    if(!rec)return;e.preventDefault();e.stopPropagation();
    const parts=[];if(e.ctrlKey)parts.push('Ctrl');if(e.altKey)parts.push('Alt');if(e.shiftKey)parts.push('Shift');if(e.metaKey)parts.push('Meta');
    if(['Control','Alt','Shift','Meta'].includes(e.key))return;
    if(!e.ctrlKey&&!e.altKey&&!e.shiftKey&&!e.metaKey){if(errEl)errEl.textContent='⚠ Need at least one modifier.';return;}
    parts.push(e.key.toUpperCase());const combo=parts.join('+');
    if(FORBIDDEN.includes(combo.toLowerCase().replace(/\s/g,''))){
      if(errEl)errEl.textContent=`⚠ Conflict: "${combo}" is reserved by Chrome.`;
      inp.value=settings.modifierCombo||'Alt+W';inp.classList.remove('recording');rec=false;
      setTimeout(()=>{if(errEl)errEl.textContent='';},3000);return;
    }
    inp.value=combo;inp.classList.remove('recording');rec=false;if(errEl)errEl.textContent='';
    settings.modifierCombo=combo;persist();
  });
  inp.addEventListener('blur',()=>{if(rec){inp.value=settings.modifierCombo||'Alt+W';inp.classList.remove('recording');rec=false;}});
  clr.addEventListener('click',()=>{settings.modifierCombo='Alt+W';inp.value='Alt+W';inp.classList.remove('recording');if(errEl)errEl.textContent='';rec=false;persist();});
}

// ─── Bind Events ──────────────────────────────────────────
function bindEvents(){
  document.getElementById('themeToggle').addEventListener('click',cycleTheme);
  document.getElementById('dropdownOverlay').addEventListener('click',()=>{
    document.querySelectorAll('.lang-dropdown.open').forEach(d=>d.classList.remove('open'));
    document.querySelectorAll('.select-btn.open').forEach(b=>b.classList.remove('open'));
    document.getElementById('dropdownOverlay').classList.remove('active');
  });

  // Simple checkboxes
  ['autoSwitch:autoSwitchSecondLanguage','translationCache:translationCache',
   'showCandidates:showMultipleCandidates','sidebarAutoTranslate:sidebarAutoTranslate',
   'openInSidebar:openInSidebar','onlySidebarOpen:onlySidebarOpen'].forEach(p=>{
    const[id,key]=p.split(':');
    document.getElementById(id)?.addEventListener('change',e=>{settings[key]=e.target.checked;persist();});
  });

  // Break limit
  document.getElementById('breakLimit')?.addEventListener('change',e=>{
    settings.breakLimit=e.target.checked;
    document.getElementById('breakLimitSubSettings')?.classList.toggle('visible',e.target.checked);persist();
  });
  let clTimer=null;
  document.getElementById('charLimit')?.addEventListener('input',e=>{
    settings.charLimit=Math.max(1,parseInt(e.target.value)||5000);
    clearTimeout(clTimer);clTimer=setTimeout(persist,600);
  });

  // Disabled sites
  document.getElementById('disabledSitesEnabled')?.addEventListener('change',e=>{settings.disabledSitesEnabled=e.target.checked;persist();});
  document.getElementById('addSiteBtn')?.addEventListener('click',()=>{addSite(document.getElementById('siteInput').value);});
  document.getElementById('siteInput')?.addEventListener('keydown',e=>{if(e.key==='Enter')addSite(e.target.value);});

  // Context menu — independent
  document.getElementById('contextMenu')?.addEventListener('change',e=>{
    settings.contextMenu=e.target.checked;
    document.getElementById('contextMenuSubSettings')?.classList.toggle('visible',e.target.checked);persist();
  });

  // Trigger toggles — mutually exclusive
  document.querySelectorAll('.trigger-toggle').forEach(el=>{
    el.addEventListener('change',()=>{
      if(el.checked){
        document.querySelectorAll('.trigger-toggle').forEach(o=>{
          if(o!==el){o.checked=false;const m={translateOnModifier:'translateOnModifier',writingTranslate:'writingTranslate',copyToTranslate:'copyToTranslate',translateOnPopup:'translateOnPopup'};if(m[o.id])settings[m[o.id]]=false;}
        });
      }
      settings.translateOnModifier=document.getElementById('translateOnModifier')?.checked||false;
      settings.writingTranslate   =document.getElementById('writingTranslate')?.checked||false;
      settings.copyToTranslate    =document.getElementById('copyToTranslate')?.checked||false;
      settings.translateOnPopup   =document.getElementById('translateOnPopup')?.checked||false;
      updateSubSettings();persist();
    });
  });

  // Radios
  document.querySelectorAll('input[name="modifierAction"]').forEach(r=>r.addEventListener('change',()=>{settings.modifierAction=r.value;persist();}));
  document.querySelectorAll('input[name="writingMode"]').forEach(r=>r.addEventListener('change',()=>{settings.writingTranslateMode=r.value;persist();}));
  document.querySelectorAll('input[name="contextMenuAction"]').forEach(r=>r.addEventListener('change',()=>{settings.contextMenuAction=r.value;persist();}));
  document.querySelectorAll('input[name="copyAction"]').forEach(r=>r.addEventListener('change',()=>{settings.copyToTranslateAction=r.value;persist();}));
  document.querySelectorAll('input[name="popupAction"]').forEach(r=>r.addEventListener('change',()=>{settings.popupAction=r.value;persist();}));
  document.getElementById('writingSpeed')?.addEventListener('change',e=>{settings.writingTranslateSpeed=e.target.value;persist();});
  setupKeybindRecorder();

  // Services
  const svcMap={enableGoogle:'google',enableMicrosoft:'microsoft',enableDeepL:'deepl',enableYandex:'yandex'};
  Object.entries(svcMap).forEach(([elId,svc])=>{
    document.getElementById(elId)?.addEventListener('change',e=>{
      let svcs=settings.enabledServices||[];
      if(e.target.checked){if(!svcs.includes(svc))svcs.push(svc);}else{svcs=svcs.filter(s=>s!==svc);}
      settings.enabledServices=svcs;updateApiKeyRows();persist();
    });
  });
  let apiTimer=null;
  [['microsoftApiKey','microsoftApiKey'],['deeplApiKey','deeplApiKey'],['yandexApiKey','yandexApiKey']].forEach(([id,key])=>{
    document.getElementById(id)?.addEventListener('input',e=>{settings[key]=e.target.value;clearTimeout(apiTimer);apiTimer=setTimeout(persist,800);});
  });
  SERVICES.forEach(svc=>{
    document.getElementById(`setdefault-${svc}`)?.addEventListener('click',()=>{
      if(!settings.enabledServices.includes(svc)){settings.enabledServices.push(svc);const el=document.getElementById(`enable${cap(svc)}`);if(el)el.checked=true;updateApiKeyRows();}
      settings.defaultService=svc;updateServicesUI();persist();showToast(`${cap(svc)} set as default`);
    });
  });

  // Export
  document.getElementById('exportSettings')?.addEventListener('click',()=>{
    const data={...settings,_version:chrome.runtime.getManifest().version,_exportedAt:new Date().toISOString()};
    const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='better-translate-settings.json';a.click();
    showToast('Settings exported!');
  });

  // Import
  const fi=document.getElementById('fileInput');
  document.getElementById('browseFile')?.addEventListener('click',()=>fi.click());
  fi?.addEventListener('change',e=>{if(e.target.files[0])importFile(e.target.files[0]);});
  const dz=document.getElementById('dropZone');
  dz?.addEventListener('dragover',e=>{e.preventDefault();dz.classList.add('drag-over');});
  dz?.addEventListener('dragleave',()=>dz.classList.remove('drag-over'));
  dz?.addEventListener('drop',e=>{e.preventDefault();dz.classList.remove('drag-over');const f=e.dataTransfer.files[0];if(f?.type==='application/json')importFile(f);});
  document.getElementById('importFromUrl')?.addEventListener('click',async()=>{
    const url=document.getElementById('importUrl').value.trim();if(!url)return;
    try{const r=await fetch(url);applyImport(await r.json());}catch(e){showToast('Failed to import from URL');}
  });
  document.getElementById('resetSettings')?.addEventListener('click',()=>{
    const a=prompt('Type "yes" to confirm reset:');
    if(a?.toLowerCase()==='yes'){settings={...DEF};chrome.storage.sync.set({settings});toUI();applyTheme();updateServicesUI();renderSiteList();showToast('Settings reset!');}
  });
}

function importFile(f){const r=new FileReader();r.onload=e=>{try{applyImport(JSON.parse(e.target.result));}catch{showToast('Invalid settings file');}};r.readAsText(f);}
function applyImport(d){const{_version,_exportedAt,...imp}=d;settings={...DEF,...imp};chrome.storage.sync.set({settings});toUI();applyTheme();updateServicesUI();renderSiteList();showToast('Settings imported!');}
function updateVersionDisplay(){const v=chrome.runtime.getManifest().version;document.getElementById('versionDisplay').textContent=`v${v}`;document.getElementById('aboutVersion').textContent=`Version ${v}`;}
function showToast(msg){document.querySelector('.toast')?.remove();const t=document.createElement('div');t.className='toast';t.textContent=msg;document.body.appendChild(t);setTimeout(()=>t.remove(),1800);}

chrome.storage.onChanged.addListener(changes=>{
  if(!changes.settings)return;
  const n=changes.settings.newValue||{};
  if(n.theme&&n.theme!==settings.theme){settings.theme=n.theme;applyTheme();}
  if(n.sidebarAutoTranslate!==undefined&&n.sidebarAutoTranslate!==settings.sidebarAutoTranslate){
    settings.sidebarAutoTranslate=n.sidebarAutoTranslate;
    const el=document.getElementById('sidebarAutoTranslate');if(el)el.checked=n.sidebarAutoTranslate;
  }
});
