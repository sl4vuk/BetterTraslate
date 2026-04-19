// Better Translate — Content Script v8

let settings = {};
let writingTimer = null;
let lastInputEl = null;
let lastSelStart = 0;
let lastSelEnd = 0;
let popupEl = null;
let popupText = '';
let siteDisabled = false;

const SPEED_MS = { 'very-fast':300,'fast':600,'medium':1000,'slow':2000,'very-slow':3500 };

function runtimeOk() { try { return !!chrome?.runtime?.id; } catch(e) { return false; } }
function sendMsg(msg, cb) {
  if (!runtimeOk()) return;
  try { if (cb) chrome.runtime.sendMessage(msg, cb); else chrome.runtime.sendMessage(msg).catch(()=>{}); } catch(e) {}
}

// ─── Boot ─────────────────────────────────────────────────
loadSettings();
try { chrome.storage.onChanged.addListener(ch=>{ if(ch.settings){ settings=ch.settings.newValue||{}; checkDisabled(); initFeatures(); } }); } catch(e) {}

function loadSettings() {
  if (!runtimeOk()) return;
  try { chrome.storage.sync.get('settings', d=>{ settings=d.settings||{}; checkDisabled(); initFeatures(); }); } catch(e) {}
}

function checkDisabled() {
  const disabled = settings.disabledSites || [];
  if (!disabled.length) { siteDisabled=false; return; }
  try {
    const host = location.hostname.replace(/^www\./, '');
    siteDisabled = disabled.some(site=>{
      const s=site.replace(/^www\./,'').replace(/^https?:\/\//,'');
      return host===s||host.endsWith('.'+s);
    });
  } catch(e) { siteDisabled=false; }
}

function initFeatures() {
  document.removeEventListener('keydown', onModKey);
  document.removeEventListener('copy', onCopy);
  document.removeEventListener('input', onInput);
  document.removeEventListener('mouseup', onMouseUp);
  document.removeEventListener('keyup', saveCtx);
  document.removeEventListener('keydown', onEsc);

  if (siteDisabled) return; // Extension disabled on this site

  document.addEventListener('mouseup', onMouseUp);
  document.addEventListener('keyup', saveCtx);
  document.addEventListener('keydown', onEsc);
  if (settings.translateOnModifier) document.addEventListener('keydown', onModKey);
  if (settings.copyToTranslate)     document.addEventListener('copy', onCopy);
  if (settings.writingTranslate)    document.addEventListener('input', onInput);
}

function saveCtx() {
  const ae = document.activeElement;
  if (ae && (ae.tagName==='INPUT'||ae.tagName==='TEXTAREA')) {
    lastInputEl=ae; lastSelStart=ae.selectionStart; lastSelEnd=ae.selectionEnd;
  } else if (ae?.isContentEditable) lastInputEl=ae;
}

function onMouseUp(e) {
  saveCtx();
  if (settings.translateOnPopup) {
    setTimeout(()=>{
      const sel = window.getSelection()?.toString().trim();
      if (sel) showPopup(e.clientX, e.clientY, sel); else hidePopup();
    }, 10);
  } else hidePopup();
}
function onEsc(e) { if(e.key==='Escape') hidePopup(); }

// ─── Popup ────────────────────────────────────────────────
function showPopup(x, y, text) {
  hidePopup(); popupText=text;
  popupEl=document.createElement('div'); popupEl.id='bt-popup';
  popupEl.innerHTML=`<svg width="12" height="12" viewBox="0 0 64 64" fill="none" style="flex-shrink:0"><g stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="6"><line x1="9" y1="14" x2="33" y2="14"/><line x1="21" y1="10" x2="21" y2="20"/><line x1="9" y1="26" x2="18" y2="26"/><line x1="14" y1="22" x2="7" y2="38"/><line x1="14" y1="22" x2="21" y2="38"/><line x1="26" y1="22" x2="19" y2="38"/><line x1="26" y1="22" x2="33" y2="38"/></g><g stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="6"><line x1="36" y1="54" x2="50" y2="24"/><line x1="50" y1="24" x2="63" y2="54"/><line x1="40" y1="44" x2="60" y2="44"/></g></svg><span>Translate</span>`;
  Object.assign(popupEl.style,{position:'fixed',top:`${y-40}px`,left:`${x}px`,transform:'translateX(-50%)',zIndex:'2147483647',display:'flex',alignItems:'center',gap:'6px',padding:'5px 12px',background:'#1a1a1a',color:'#f0f0f0',borderRadius:'20px',fontSize:'12px',fontFamily:'system-ui,sans-serif',fontWeight:'600',cursor:'pointer',boxShadow:'0 2px 12px rgba(0,0,0,0.35)',userSelect:'none',whiteSpace:'nowrap',border:'1px solid rgba(255,255,255,0.12)'});
  popupEl.addEventListener('mousedown',e=>{e.preventDefault();e.stopPropagation();hidePopup();saveCtx();sendMsg({action:'popupTranslate',text:popupText});});
  document.body.appendChild(popupEl);
  setTimeout(hidePopup,4000);
}
function hidePopup() { if(popupEl){popupEl.remove();popupEl=null;} }

// ─── Combo match ──────────────────────────────────────────
function comboMatch(e,str){
  if(!str)return false;
  const parts=str.split('+').map(p=>p.trim().toLowerCase());
  const mods=['ctrl','alt','shift','meta','cmd'];
  return parts.includes('ctrl')===e.ctrlKey&&parts.includes('alt')===e.altKey&&
    parts.includes('shift')===e.shiftKey&&(parts.includes('meta')||parts.includes('cmd'))===e.metaKey&&
    (!parts.find(p=>!mods.includes(p))||e.key.toLowerCase()===parts.find(p=>!mods.includes(p)));
}

// ─── Modifier key ─────────────────────────────────────────
function onModKey(e){
  if(!runtimeOk()||siteDisabled)return;
  if(!comboMatch(e,settings.modifierCombo||'Alt+W'))return;
  const sel=window.getSelection()?.toString().trim();if(!sel)return;
  e.preventDefault();saveCtx();
  const action=settings.modifierAction||'sidebar';
  if(action==='replace'){
    sendMsg({action:'detectLanguage',text:sel.substring(0,80)},res=>{
      const tl=resolveLocal(res?.lang);
      const svc=settings.defaultService||'google';
      sendMsg({action:'translate',text:sel,targetLang:tl,service:svc,useCache:!!settings.translationCache},
        resp=>{if(resp?.result?.translation)replaceText(resp.result.translation);});
    });
  } else if(action==='clipboard'){
    sendMsg({action:'detectLanguage',text:sel.substring(0,80)},res=>{
      const tl=resolveLocal(res?.lang);
      const svc=settings.defaultService||'google';
      sendMsg({action:'translate',text:sel,targetLang:tl,service:svc,useCache:!!settings.translationCache},
        resp=>{if(resp?.result?.translation){writeClipboard(resp.result.translation);if(settings.openInSidebar){sendMsg({action:'openSidebar'});setTimeout(()=>sendMsg({action:'translateFromPage',text:sel,targetLang:tl}),700);}}});
    });
  } else {
    sendMsg({action:'openSidebar'});
    setTimeout(()=>sendMsg({action:'translateFromPage',text:sel}),700);
  }
}

// ─── Copy to translate ────────────────────────────────────
function onCopy(){
  if(!runtimeOk()||siteDisabled)return;
  setTimeout(()=>{
    const sel=window.getSelection()?.toString().trim();if(!sel)return;
    saveCtx();
    const action=settings.copyToTranslateAction||'sidebar';
    if(action==='replace'){
      sendMsg({action:'detectLanguage',text:sel.substring(0,80)},res=>{
        const tl=resolveLocal(res?.lang);
        sendMsg({action:'translate',text:sel,targetLang:tl,service:settings.defaultService||'google',useCache:!!settings.translationCache},
          resp=>{if(resp?.result?.translation)replaceText(resp.result.translation);});
      });
    } else if(action==='clipboard'){
      sendMsg({action:'detectLanguage',text:sel.substring(0,80)},res=>{
        const tl=resolveLocal(res?.lang);
        sendMsg({action:'translate',text:sel,targetLang:tl,service:settings.defaultService||'google',useCache:!!settings.translationCache},
          resp=>{if(resp?.result?.translation){writeClipboard(resp.result.translation);if(settings.openInSidebar){sendMsg({action:'openSidebar'});setTimeout(()=>sendMsg({action:'translateFromPage',text:sel,targetLang:tl}),700);}}});
      });
    } else {
      sendMsg({action:'openSidebar'});
      setTimeout(()=>sendMsg({action:'translateFromPage',text:sel}),700);
    }
  },50);
}

// ─── Writing translate ────────────────────────────────────
function onInput(e){
  if(!runtimeOk()||siteDisabled)return;
  const target=e.target;if(!target)return;
  const ok=target.tagName==='INPUT'||target.tagName==='TEXTAREA'||target.isContentEditable;
  if(!ok||target.id==='sourceText')return;
  lastInputEl=target;clearTimeout(writingTimer);
  const delay=SPEED_MS[settings.writingTranslateSpeed||'medium']||1000;
  writingTimer=setTimeout(()=>{
    if(!runtimeOk()||!lastInputEl)return;
    const txt=lastInputEl.value!==undefined?lastInputEl.value:(lastInputEl.innerText||'');
    if(!txt.trim())return;
    sendMsg({action:'writingTranslateReq',text:txt.trim()},res=>{
      if(!res?.translation||!lastInputEl)return;
      if(res.mode==='replace'){const el=lastInputEl;if(el.value!==undefined){el.value=res.translation;el.dispatchEvent(new Event('input',{bubbles:true}));}else el.innerText=res.translation;}
    });
  },delay);
}

function resolveLocal(detected){
  const target=settings.targetLanguage||'en',second=settings.secondLanguage||'es';
  if(!settings.autoSwitchSecondLanguage)return target;
  if(detected&&detected!=='auto'&&(detected===target||detected.startsWith(target.split('-')[0])))return second;
  return target;
}

function replaceText(tr){
  const ae=document.activeElement;
  if(ae&&(ae.tagName==='INPUT'||ae.tagName==='TEXTAREA')){const s=ae.selectionStart,e=ae.selectionEnd;if(s!==e){ae.value=ae.value.substring(0,s)+tr+ae.value.substring(e);ae.selectionStart=ae.selectionEnd=s+tr.length;ae.dispatchEvent(new Event('input',{bubbles:true}));return;}}
  if(lastInputEl&&(lastInputEl.tagName==='INPUT'||lastInputEl.tagName==='TEXTAREA')&&lastSelStart!==lastSelEnd){lastInputEl.value=lastInputEl.value.substring(0,lastSelStart)+tr+lastInputEl.value.substring(lastSelEnd);lastInputEl.selectionStart=lastInputEl.selectionEnd=lastSelStart+tr.length;lastInputEl.dispatchEvent(new Event('input',{bubbles:true}));return;}
  const sel=window.getSelection();if(sel?.rangeCount>0){const range=sel.getRangeAt(0);if(!range.collapsed){range.deleteContents();const n=document.createTextNode(tr);range.insertNode(n);range.setStartAfter(n);range.collapse(true);sel.removeAllRanges();sel.addRange(range);return;}}
  if(lastInputEl?.isContentEditable){lastInputEl.focus();document.execCommand('insertText',false,tr);}
}

function writeClipboard(text){
  navigator.clipboard.writeText(text).catch(()=>{const ta=document.createElement('textarea');ta.value=text;ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove();});
}

try{chrome.runtime.onMessage.addListener(msg=>{if(msg.action==='settingsUpdated')loadSettings();if(msg.action==='replaceSelectedText')replaceText(msg.translation);if(msg.action==='writeClipboard')writeClipboard(msg.text);});}catch(e){}
