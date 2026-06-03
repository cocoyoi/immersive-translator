// content.js - YaYacal Translation Engine
// Core translation logic for webpage immersion

(function() {
  'use strict';
  
  let settings = {};
  let translationCache = new Map();
  let observer = null;
  let isTranslating = false;
  let abortController = null;

  const BLOCK_TAGS = new Set(['SCRIPT', 'STYLE', 'CODE', 'PRE', 'TEXTAREA', 'INPUT', 'BUTTON', 'SVG', 'PATH', 'IFRAME']);
  const MIN_TEXT_LENGTH = 3;
  const MAX_TEXT_LENGTH = 5000;
  
  // Load settings from storage
  async function loadSettings() {
    const data = await chrome.storage.sync.get([
      'enableTranslate', 'bilingualMode', 'selectionTranslate', 'inputTranslate',
      'targetLang', 'fontSize', 'transColor', 'showOriginal', 'hoverTranslate',
      'autoDetect', 'enableCache', 'maxConcurrent', 'engines', 'activeEngineId'
    ]);
    settings = data;
    return data;
  }

  // Language detection (simplified)
  function detectLanguage(text) {
    if (/[\u4e00-\u9fff]/.test(text)) return 'zh';
    if (/[\u3040-\u309f\u30a0-\u30ff]/.test(text)) return 'ja';
    if (/[\uac00-\ud7af]/.test(text)) return 'ko';
    if (/[а-яА-Я]/.test(text)) return 'ru';
    return 'en';
  }

  // Get active translation engine
  async function getActiveEngine() {
    const { engines = [], activeEngineId } = settings;
    return engines.find(e => e.id === activeEngineId);
  }

  // Translate text via API
  async function translateText(text, targetLang) {
    if (!text || text.length < MIN_TEXT_LENGTH) return text;
    if (text.length > MAX_TEXT_LENGTH) text = text.slice(0, MAX_TEXT_LENGTH);

    const cacheKey = `${text}:${targetLang}`;
    if (settings.enableCache && translationCache.has(cacheKey)) {
      return translationCache.get(cacheKey);
    }

    const engine = await getActiveEngine();
    if (!engine) throw new Error('No active translation engine');

    const url = `${engine.base}/chat/completions`;
    const body = {
      model: engine.model,
      messages: [
        { role: 'system', content: engine.system || 'You are a professional translator. Translate the given text accurately while preserving the original tone and style. Output only the translation without explanations.' },
        { role: 'user', content: `Translate the following text to ${targetLang}:\n\n${text}` }
      ],
      temperature: engine.temp || 0.3,
      max_tokens: Math.max(100, text.length * 2)
    };

    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${engine.key}`
      },
      body: JSON.stringify(body)
    });

    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`API error ${resp.status}: ${err}`);
    }

    const data = await resp.json();
    const translated = data.choices?.[0]?.message?.content?.trim() || text;
    
    if (settings.enableCache) {
      translationCache.set(cacheKey, translated);
    }
    return translated;
  }

  // Create translated element
  function createTranslatedElement(original, translated) {
    const wrapper = document.createElement('span');
    wrapper.className = 'yayacal-translated-wrapper';
    wrapper.style.cssText = 'display: inline; cursor: pointer;';

    if (settings.bilingualMode !== false) {
      const orig = document.createElement('span');
      orig.className = 'yayacal-original';
      orig.textContent = original;
      orig.style.cssText = 'display: block; margin-bottom: 2px; opacity: 0.7; font-size: 0.95em;';
      wrapper.appendChild(orig);
    }

    const trans = document.createElement('span');
    trans.className = 'yayacal-translation';
    trans.textContent = translated;
    trans.style.cssText = `
      display: block;
      color: ${settings.transColor || '#667eea'};
      font-size: ${(settings.fontSize || 14)}px;
      border-left: 2px solid ${settings.transColor || '#667eea'};
      padding-left: 6px;
      margin: 2px 0;
    `;
    wrapper.appendChild(trans);

    // Toggle original on click
    wrapper.addEventListener('click', () => {
      const orig = wrapper.querySelector('.yayacal-original');
      if (orig) orig.style.display = orig.style.display === 'none' ? 'block' : 'none';
    });

    return wrapper;
  }

  // Extract text blocks from element
  function getTextBlocks(element) {
    const blocks = [];
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;
          if (BLOCK_TAGS.has(parent.tagName)) return NodeFilter.FILTER_REJECT;
          if (parent.closest('.yayacal-translated-wrapper')) return NodeFilter.FILTER_REJECT;
          const text = node.textContent.trim();
          if (text.length < MIN_TEXT_LENGTH) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    let node;
    while (node = walker.nextNode()) {
      blocks.push(node);
    }
    return blocks;
  }

  // Translate a single text node
  async function translateNode(node) {
    const text = node.textContent.trim();
    if (!text) return;

    const detected = detectLanguage(text);
    if (detected === settings.targetLang?.replace(/-.*/, '')) return;

    try {
      const translated = await translateText(text, settings.targetLang || 'zh-CN');
      if (translated && translated !== text) {
        const wrapper = createTranslatedElement(text, translated);
        node.parentElement.replaceChild(wrapper, node);
      }
    } catch (e) {
      console.error('[YaYacal Translation]', e);
    }
  }

  // Batch translate with concurrency control
  async function translateBatch(nodes) {
    const maxConcurrent = settings.maxConcurrent || 3;
    const batches = [];
    for (let i = 0; i < nodes.length; i += maxConcurrent) {
      batches.push(nodes.slice(i, i + maxConcurrent));
    }

    for (const batch of batches) {
      await Promise.all(batch.map(node => translateNode(node)));
    }
  }

  // Main translate function
  async function translatePage() {
    if (isTranslating) return;
    isTranslating = true;

    await loadSettings();
    if (!settings.enableTranslate) {
      isTranslating = false;
      return;
    }

    const nodes = getTextBlocks(document.body);
    if (nodes.length === 0) {
      isTranslating = false;
      return;
    }

    await translateBatch(nodes);
    isTranslating = false;
  }

  // Observe DOM changes for dynamic content
  function startObserver() {
    if (observer) observer.disconnect();
    observer = new MutationObserver(mutations => {
      if (!settings.enableTranslate || isTranslating) return;
      const newNodes = [];
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, null);
            let n;
            while (n = walker.nextNode()) {
              const parent = n.parentElement;
              if (parent && !BLOCK_TAGS.has(parent.tagName) && n.textContent.trim().length >= MIN_TEXT_LENGTH) {
                newNodes.push(n);
              }
            }
          }
        });
      });
      if (newNodes.length > 0) {
        translateBatch(newNodes);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  // Selection / hover translation popup
  function showPopup(text, x, y) {
    const existing = document.getElementById('yayacal-popup');
    if (existing) existing.remove();

    const popup = document.createElement('div');
    popup.id = 'yayacal-popup';
    popup.style.cssText = `
      position: fixed; z-index: 2147483647; left: ${x}px; top: ${y}px;
      background: #1a1a2e; color: #eee; border: 1px solid #667eea;
      border-radius: 8px; padding: 12px; max-width: 400px; font-size: 14px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.5); pointer-events: auto;
    `;
    popup.textContent = '翻译中...';
    document.body.appendChild(popup);

    translateText(text, settings.targetLang || 'zh-CN')
      .then(translated => {
        popup.innerHTML = `
          <div style="color: #667eea; font-size: 12px; margin-bottom: 4px;">原文</div>
          <div style="margin-bottom: 8px; opacity: 0.8;">${text}</div>
          <div style="color: #667eea; font-size: 12px; margin-bottom: 4px;">翻译</div>
          <div>${translated}</div>
        `;
      })
      .catch(e => {
        popup.textContent = '翻译失败: ' + e.message;
        popup.style.color = '#dc3545';
      });

    // Close on click outside
    setTimeout(() => {
      document.addEventListener('click', function close(e) {
        if (!popup.contains(e.target)) {
          popup.remove();
          document.removeEventListener('click', close);
        }
      });
    }, 100);
  }

  // Selection translate handler
  document.addEventListener('mouseup', async e => {
    if (!settings.selectionTranslate) return;
    const selection = window.getSelection().toString().trim();
    if (selection.length < 2) return;
    const rect = window.getSelection().getRangeAt(0).getBoundingClientRect();
    showPopup(selection, rect.left, rect.bottom + 10);
  });

  // Hover translate handler
  let hoverTimer = null;
  document.addEventListener('mouseover', async e => {
    if (!settings.hoverTranslate) return;
    clearTimeout(hoverTimer);
    const target = e.target;
    if (target.closest('.yayacal-translated-wrapper') || target.closest('#yayacal-popup')) return;
    
    const text = target.textContent?.trim();
    if (!text || text.length < 5 || text.length > 200) return;

    hoverTimer = setTimeout(() => {
      const rect = target.getBoundingClientRect();
      showPopup(text, rect.left, rect.bottom + 5);
    }, 800);
  });

  document.addEventListener('mouseout', () => clearTimeout(hoverTimer));

  // Input box translation
  document.addEventListener('focusin', async e => {
    if (!settings.inputTranslate) return;
    const target = e.target;
    if (target.tagName !== 'TEXTAREA' && target.tagName !== 'INPUT') return;
    if (target.dataset.yayacalTranslated) return;

    const original = target.value || target.placeholder;
    if (!original || original.length < 3) return;

    try {
      const translated = await translateText(original, settings.targetLang || 'zh-CN');
      if (target.tagName === 'TEXTAREA') {
        target.value = translated;
      } else {
        target.placeholder = translated;
      }
      target.dataset.yayacalTranslated = 'true';
    } catch (e) {
      console.error('[YaYacal Translation] Input translate failed:', e);
    }
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', e => {
    if (e.altKey && e.key === 't') {
      e.preventDefault();
      translatePage();
    }
    if (e.altKey && e.key === 's') {
      e.preventDefault();
      const selection = window.getSelection().toString().trim();
      if (selection) {
        const rect = window.getSelection().getRangeAt(0).getBoundingClientRect();
        showPopup(selection, rect.left, rect.bottom + 10);
      }
    }
  });

  // Listen for messages from background/popup
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'translate') {
      translatePage().then(() => sendResponse({ success: true })).catch(e => sendResponse({ success: false, error: e.message }));
      return true;
    }
    if (request.action === 'getStatus') {
      sendResponse({ isTranslating, cacheSize: translationCache.size });
      return true;
    }
  });

  // Initialize
  async function init() {
    await loadSettings();
    if (settings.enableTranslate) {
      translatePage();
      startObserver();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
