// Content Script for Better Translate

let settings = {};
let writingTranslateTimer = null;
let lastObservedInput = null;

// Load settings
function loadSettings() {
  chrome.storage.sync.get('settings', (data) => {
    settings = data.settings || {};
    initFeatures();
  });
}

function initFeatures() {
  // Remove old listeners
  document.removeEventListener('keydown', handleModifierKey);
  document.removeEventListener('copy', handleCopy);

  if (settings.translateOnModifier) {
    document.addEventListener('keydown', handleModifierKey);
  }

  if (settings.copyToTranslate) {
    document.addEventListener('copy', handleCopy);
  }

  if (settings.writingTranslate) {
    observeInputs();
  }
}

// Modifier key translation
function handleModifierKey(e) {
  const key = settings.modifierKey || 'Alt';
  const keyMap = { 'Alt': e.altKey, 'Ctrl': e.ctrlKey, 'Shift': e.shiftKey };
  
  if (keyMap[key] && e.key !== key) {
    const selection = window.getSelection().toString().trim();
    if (selection) {
      e.preventDefault();
      sendToSidepanel(selection, settings.modifierAction);
    }
  }
}

// Copy to translate
function handleCopy(e) {
  setTimeout(() => {
    const text = navigator.clipboard ? '' : window.getSelection().toString();
    const selection = window.getSelection().toString().trim();
    if (selection) {
      chrome.runtime.sendMessage({
        action: 'copyToTranslate',
        text: selection,
        copyAction: settings.copyToTranslateAction
      });
    }
  }, 100);
}

// Writing translate
function observeInputs() {
  document.addEventListener('input', handleInput);
}

function handleInput(e) {
  if (!settings.writingTranslate) return;
  const target = e.target;
  if (!target || !['INPUT', 'TEXTAREA'].includes(target.tagName) && !target.isContentEditable) return;
  
  lastObservedInput = target;
  clearTimeout(writingTranslateTimer);
  
  const delay = settings.writingTranslateDelay || 500;
  writingTranslateTimer = setTimeout(() => {
    const text = target.value || target.innerText || target.textContent;
    if (text && text.trim().length > 0) {
      chrome.runtime.sendMessage({
        action: 'writingTranslate',
        text: text.trim(),
        inputElement: null // Can't pass DOM elements
      }, (response) => {
        if (response && response.translation && lastObservedInput) {
          // Replace text in input
          if (lastObservedInput.value !== undefined) {
            lastObservedInput.value = response.translation;
          } else {
            lastObservedInput.innerText = response.translation;
          }
        }
      });
    }
  }, delay);
}

// Send text to side panel
function sendToSidepanel(text, action) {
  chrome.runtime.sendMessage({
    action: 'translateFromPage',
    text,
    pageAction: action
  });
}

// Listen for messages from background
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'translateSelection') {
    const selection = window.getSelection().toString().trim();
    if (selection) {
      chrome.runtime.sendMessage({
        action: 'translateFromPage',
        text: selection
      });
    }
  }
  if (message.action === 'settingsUpdated') {
    loadSettings();
  }
  if (message.action === 'replaceSelectedText') {
    replaceSelectedText(message.translation);
  }
});

function replaceSelectedText(translation) {
  const activeElement = document.activeElement;
  if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
    const start = activeElement.selectionStart;
    const end = activeElement.selectionEnd;
    const value = activeElement.value;
    activeElement.value = value.substring(0, start) + translation + value.substring(end);
    activeElement.selectionStart = activeElement.selectionEnd = start + translation.length;
  } else {
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      range.deleteContents();
      range.insertNode(document.createTextNode(translation));
    }
  }
}

// Init
loadSettings();

// Listen for settings changes
chrome.storage.onChanged.addListener((changes) => {
  if (changes.settings) {
    settings = changes.settings.newValue || {};
    initFeatures();
  }
});
