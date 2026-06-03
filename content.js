// content.js - immersive-translator
// Core translation engine for webpage immersion

(function() {
  'use strict';
  
  let settings = {};
  let translationCache = new Map();
  let observer = null;
  let isTranslating = false;
  let hoveredParagraph = null;
  let hoveredTransNode = null;

  const BLOCK_TAGS = new Set(['SCRIPT', 'STYLE', 'CODE', 'PRE', 'TEXTAREA', 'INPUT', 'BUTTON', 'SVG', 'PATH', 'IFRAME', 'IMG', 'VIDEO', 'CANVAS', 'SELECT', 'TEXTAREA']);
  const MIN_TEXT_LENGTH = 3;
  const MAX_TEXT_LENGTH = 5000;
  const MAX_CACHE_SIZE = 5000;

  // ==== Settings ====
  async function loadSettings() {
    const data = await chrome.storage.sync.get([
      'enableTranslate', 'bilingualMode', 'selectionTranslate', 'inputTranslate',
      'targetLang', 'fontSize', 'transColor', 'showOriginal', 'hoverTranslate',
      'autoDetect', 'enableCache', 'maxConcurrent', 'engines', 'activeEngineId',
      'hoverModifier', 'inputTrigger', 'glossary', 'aiExperts',
      'transStyle', 'lineSpacing', 'showProgress', 'pronounceEnabled'
    ]);
    settings = { ...{
      enableTranslate: false,
      bilingualMode: true,
      targetLang: 'zh-CN',
      fontSize: 14,
      transColor: '#667eea',
      showOriginal: true,
      hoverModifier: 'ctrl',  // ctrl | alt | shift
      inputTrigger: 'triple-space',  // triple-space | double-space
      transStyle: 'bilingual-inline',  // bilingual-inline | bilingual-block | pure-translation
      lineSpacing: 1.5,
      showProgress: true,
      pronounceEnabled: false,
      maxConcurrent: 3
    }, ...data };
    return settings;
  }

  // ==== Language Detection ====
  function detectLanguage(text) {
    if (/[\u4e00-\u9fff]/.test(text)) return 'zh-CN';
    if (/[\u3040-\u309f\u30a0-\u30ff]/.test(text)) return 'ja';
    if (/[\uac00-\ud7af]/.test(text)) return 'ko';
    if (/[\u0400-\u04FF]/.test(text)) return 'ru';
    if (/[\u00E0-\u00FC]/.test(text)) return 'fr';
    if (/[\u00F1\u00E1\u00E9\u00ED\u00F3\u00FA]/.test(text)) return 'es';
    if (/[\u00E4\u00F6\u00FC\u00DF]/.test(text)) return 'de';
    return 'en';
  }

  // ==== Engine & API ====
  async function getActiveEngine() {
    const { engines = [], activeEngineId } = settings;
    const engine = engines.find(e => e.id === activeEngineId);
    if (engine) return engine;
    return engines[0];
  }

  function buildPrompt(text, targetLang, glossary) {
    let system = settings.systemPrompt || 'You are a professional translator. Translate accurately while preserving the original tone and style. Output only the translation without explanations.';
    
    // Add glossary terms
    if (glossary && Object.keys(glossary).length > 0) {
      const terms = Object.entries(glossary).map(([k, v]) => `"${k}" -> "${v}"`).join('\n');
      system += '\n\nUse the following glossary terms:\n' + terms;
    }
    
    // Add expert context
    const expert = settings.aiExpert;
    if (expert) {
      system += `\n\nYou are a ${expert.name || 'translation expert'}. ${expert.description || ''}`;
    }
    
    return { system, user: `Translate the following text to ${targetLang}:\n\n${text}` };
  }

  async function translateText(text, targetLang) {
    if (!text || text.length < MIN_TEXT_LENGTH) return text;
    if (text.length > MAX_TEXT_LENGTH) text = text.slice(0, MAX_TEXT_LENGTH);

    const cacheKey = `${text}:${targetLang}`;
    if (settings.enableCache && translationCache.has(cacheKey)) {
      return translationCache.get(cacheKey);
    }

    const engine = await getActiveEngine();
    if (!engine) throw new Error('No active translation engine');

    const prompts = buildPrompt(text, targetLang, settings.glossary);
    
    const url = `${engine.base}/chat/completions`;
    const body = {
      model: engine.model,
      messages: [
        { role: 'system', content: prompts.system },
        { role: 'user', content: prompts.user }
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
      if (translationCache.size >= MAX_CACHE_SIZE) {
        const firstKey = translationCache.keys().next().value;
        translationCache.delete(firstKey);
      }
      translationCache.set(cacheKey, translated);
    }
    return translated;
  }

  // ==== Translation Styles ====
  function createTranslatedElement(original, translated) {
    const style = settings.transStyle || 'bilingual-inline';
    const color = settings.transColor || '#667eea';
    const fontSize = (settings.fontSize || 14) + 'px';
    const lineHeight = (settings.lineSpacing || 1.5);
    
    if (style === 'pure-translation') {
      const span = document.createElement('span');
      span.className = 'it-pure-trans';
      span.textContent = translated;
      span.style.cssText = `font-size: ${fontSize}; line-height: ${lineHeight};`;
      return span;
    }
    
    if (style === 'bilingual-block') {
      const wrapper = document.createElement('div');
      wrapper.className = 'it-bilingual-block';
      wrapper.style.cssText = `display: block; margin: 4px 0; padding: 8px; border-radius: 6px; background: rgba(102,126,234,0.08);`;
      
      const orig = document.createElement('div');
      orig.className = 'it-original';
      orig.textContent = original;
      orig.style.cssText = `font-size: ${fontSize}; opacity: 0.7; margin-bottom: 4px;`;
      wrapper.appendChild(orig);
      
      const trans = document.createElement('div');
      trans.className = 'it-translation';
      trans.textContent = translated;
      trans.style.cssText = `font-size: ${fontSize}; color: ${color}; line-height: ${lineHeight};`;
      wrapper.appendChild(trans);
      
      return wrapper;
    }
    
    // Default: bilingual-inline
    const wrapper = document.createElement('span');
    wrapper.className = 'it-bilingual-inline';
    wrapper.style.cssText = 'display: inline; cursor: pointer;';

    if (settings.showOriginal !== false) {
      const orig = document.createElement('span');
      orig.className = 'it-original';
      orig.textContent = original;
      orig.style.cssText = `display: inline; opacity: 0.7; font-size: 0.95em;`;
      wrapper.appendChild(orig);
    }

    const trans = document.createElement('span');
    trans.className = 'it-translation';
    trans.textContent = translated;
    trans.style.cssText = `
      display: inline;
      color: ${color};
      font-size: ${fontSize};
      line-height: ${lineHeight};
      border-left: 2px solid ${color};
      padding-left: 6px;
      margin-left: 4px;
    `;
    wrapper.appendChild(trans);

    // Toggle original on click
    wrapper.addEventListener('click', () => {
      const orig = wrapper.querySelector('.it-original');
      if (orig) {
        const isHidden = orig.style.display === 'none';
        orig.style.display = isHidden ? 'inline' : 'none';
        trans.style.marginLeft = isHidden ? '4px' : '0';
      }
    });

    return wrapper;
  }

  // ==== Text Extraction ====
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
          if (parent.closest('.it-bilingual-inline') || parent.closest('.it-bilingual-block') || parent.closest('.it-pure-trans')) return NodeFilter.FILTER_REJECT;
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

  // ==== Page Translation ====
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
      console.error('[immersive-translator]', e);
    }
  }

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

  // ==== Selection Translation ====
  function showPopup(text, x, y, showPronounce = false) {
    const existing = document.getElementById('it-popup');
    if (existing) existing.remove();

    const popup = document.createElement('div');
    popup.id = 'it-popup';
    popup.style.cssText = `
      position: fixed; z-index: 2147483647; left: ${Math.min(x, window.innerWidth - 420)}px; top: ${y}px;
      background: #1a1a2e; color: #eee; border: 1px solid #667eea;
      border-radius: 8px; padding: 12px; max-width: 400px; min-width: 200px;
      font-size: 14px; line-height: 1.5;
      box-shadow: 0 4px 20px rgba(0,0,0,0.5); pointer-events: auto;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;
    popup.innerHTML = `
      <div style="text-align: center; padding: 10px; color: #667eea;">翻译中...</div>
    `;
    document.body.appendChild(popup);

    translateText(text, settings.targetLang || 'zh-CN')
      .then(translated => {
        const pronounceBtn = showPronounce ? `
          <button id="it-pronounce-btn" style="background: transparent; border: 1px solid #667eea; color: #667eea; border-radius: 4px; padding: 2px 8px; cursor: pointer; font-size: 12px; margin-left: 8px;">🔊 发音</button>
        ` : '';
        
        popup.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <span style="color: #667eea; font-size: 12px; font-weight: 500;">原文</span>
            <button id="it-copy-btn" style="background: transparent; border: 1px solid #444; color: #aaa; border-radius: 4px; padding: 2px 8px; cursor: pointer; font-size: 11px;">复制</button>
          </div>
          <div id="it-popup-original" style="margin-bottom: 10px; opacity: 0.8; font-size: 13px;" data-text="${escapeHtml(text)}">${escapeHtml(text)}</div>
          <div style="border-top: 1px solid #333; margin: 8px 0;"></div>
          <div style="display: flex; align-items: center; margin-bottom: 8px;">
            <span style="color: #667eea; font-size: 12px; font-weight: 500;">翻译</span>
            ${pronounceBtn}
          </div>
          <div id="it-popup-translated" style="font-size: 14px; color: #fff;" data-text="${escapeHtml(translated)}">${escapeHtml(translated)}</div>
        `;
        
        popup.querySelector('#it-copy-btn')?.addEventListener('click', () => {
          navigator.clipboard.writeText(translated).then(() => {
            const btn = popup.querySelector('#it-copy-btn');
            btn.textContent = '已复制';
            setTimeout(() => btn.textContent = '复制', 1500);
          });
        });
        
        popup.querySelector('#it-pronounce-btn')?.addEventListener('click', () => {
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.lang = detectLanguage(text) === 'zh-CN' ? 'zh-CN' : 'en-US';
          speechSynthesis.speak(utterance);
        });
      })
      .catch(e => {
        popup.innerHTML = `<div style="color: #dc3545; text-align: center; padding: 10px;">翻译失败: ${escapeHtml(e.message)}</div>`;
      });

    setTimeout(() => {
      document.addEventListener('click', function close(e) {
        if (!popup.contains(e.target)) {
          popup.remove();
          document.removeEventListener('click', close);
        }
      });
    }, 100);
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  document.addEventListener('mouseup', async e => {
    if (!settings.selectionTranslate) return;
    const selection = window.getSelection().toString().trim();
    if (selection.length < 2) return;
    const rect = window.getSelection().getRangeAt(0).getBoundingClientRect();
    showPopup(selection, rect.left, rect.bottom + 10, settings.pronounceEnabled);
  });

  // ==== Hover Translation (Ctrl/Alt/Shift + hover) ====
  document.addEventListener('keydown', e => {
    const mod = settings.hoverModifier || 'ctrl';
    if (mod === 'ctrl' && e.ctrlKey) hoveredParagraph = true;
    if (mod === 'alt' && e.altKey) hoveredParagraph = true;
    if (mod === 'shift' && e.shiftKey) hoveredParagraph = true;
  });
  
  document.addEventListener('keyup', e => {
    const mod = settings.hoverModifier || 'ctrl';
    if (mod === 'ctrl' && !e.ctrlKey) hoveredParagraph = false;
    if (mod === 'alt' && !e.altKey) hoveredParagraph = false;
    if (mod === 'shift' && !e.shiftKey) hoveredParagraph = false;
    
    // Remove hovered translation when key released
    if (hoveredTransNode && hoveredTransNode.parentElement) {
      hoveredTransNode.remove();
      hoveredTransNode = null;
    }
  });

  document.addEventListener('mouseover', async e => {
    if (!hoveredParagraph) return;
    const target = e.target;
    if (target.closest('.it-bilingual-inline') || target.closest('.it-bilingual-block') || target.closest('#it-popup')) return;
    
    const text = target.textContent?.trim();
    if (!text || text.length < 5 || text.length > 500) return;
    
    // Find the closest paragraph or block
    const block = target.closest('p, div, li, td, h1, h2, h3, h4, h5, h6, span');
    if (!block || block === document.body) return;
    
    const blockText = block.textContent?.trim();
    if (!blockText || blockText.length < 10) return;
    
    try {
      const translated = await translateText(blockText, settings.targetLang || 'zh-CN');
      
      // Remove previous hover translation
      if (hoveredTransNode && hoveredTransNode.parentElement) {
        hoveredTransNode.remove();
      }
      
      const transNode = document.createElement('div');
      transNode.className = 'it-hover-translation';
      transNode.style.cssText = `
        position: relative; display: block; margin: 4px 0; padding: 8px 12px;
        background: rgba(102,126,234,0.1); border-left: 3px solid #667eea;
        border-radius: 0 4px 4px 0; font-size: 14px; color: #eee;
        animation: it-fade-in 0.2s ease;
      `;
      transNode.textContent = translated;
      
      block.appendChild(transNode);
      hoveredTransNode = transNode;
    } catch (e) {
      console.error('[immersive-translator] Hover translation failed:', e);
    }
  });

  document.addEventListener('mouseout', () => {
    if (hoveredTransNode && !hoveredParagraph) {
      hoveredTransNode.remove();
      hoveredTransNode = null;
    }
  });

  // ==== Input Translation (Triple Space / Double Space) ====
  document.addEventListener('keydown', async e => {
    if (!settings.inputTranslate) return;
    const target = e.target;
    if (target.tagName !== 'TEXTAREA' && target.tagName !== 'INPUT') return;
    
    // Track consecutive spaces
    if (e.key === ' ' || e.code === 'Space') {
      let count = parseInt(target.dataset.spaceCount || '0', 10);
      count++;
      target.dataset.spaceCount = count;
      
      const trigger = settings.inputTrigger || 'triple-space';
      const threshold = trigger === 'triple-space' ? 3 : 2;
      
      if (count >= threshold) {
        e.preventDefault();
        target.dataset.spaceCount = '0';
        
        const text = target.value.trim();
        if (!text || text.length < 3) return;
        
        try {
          const translated = await translateText(text, settings.targetLang || 'zh-CN');
          target.value = translated;
          
          // Visual feedback
          target.style.transition = 'background 0.3s';
          target.style.background = 'rgba(102,126,234,0.15)';
          setTimeout(() => {
            target.style.background = '';
          }, 500);
        } catch (err) {
          console.error('[immersive-translator] Input translation failed:', err);
        }
      }
    } else {
      // Reset count on non-space key
      target.dataset.spaceCount = '0';
    }
  });

  // ==== Keyboard Shortcuts ====
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
        showPopup(selection, rect.left, rect.bottom + 10, settings.pronounceEnabled);
      }
    }
  });

  // ==== Message Handling ====
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'translate') {
      translatePage().then(() => sendResponse({ success: true })).catch(e => sendResponse({ success: false, error: e.message }));
      return true;
    }
    if (request.action === 'getStatus') {
      sendResponse({ isTranslating, cacheSize: translationCache.size });
      return true;
    }
    if (request.action === 'clearCache') {
      translationCache.clear();
      sendResponse({ success: true });
      return true;
    }
  });

  // ==== Initialize ====
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
