// netflix-translator.js - Netflix Subtitle Translation
// Detects Netflix watch pages, intercepts subtitles, and provides bilingual translation

(function() {
  'use strict';

  const NETFLIX_REGEX = /^https?:\/\/(www\.)?netflix\.com/;
  let settings = {};
  let subtitleObserver = null;
  let subtitleCache = new Map();

  function isNetflix() {
    return NETFLIX_REGEX.test(window.location.href);
  }

  async function loadSettings() {
    const data = await chrome.storage.sync.get([
      'targetLang', 'engines', 'activeEngineId', 'enableCache', 'bilingualMode', 'subtitleTranslate'
    ]);
    settings = { ...{ targetLang: 'zh-CN', subtitleTranslate: false, bilingualMode: true }, ...data };
  }

  async function getActiveEngine() {
    const { engines = [], activeEngineId } = settings;
    return engines.find(e => e.id === activeEngineId) || engines[0];
  }

  async function translateText(text) {
    if (!text || text.length < 2) return text;

    const cacheKey = `nf:${text}:${settings.targetLang}`;
    if (settings.enableCache && subtitleCache.has(cacheKey)) {
      return subtitleCache.get(cacheKey);
    }

    const engine = await getActiveEngine();
    if (!engine) return text;

    try {
      const url = `${engine.base}/chat/completions`;
      const body = {
        model: engine.model,
        messages: [
          { role: 'system', content: 'You are a subtitle translator. Translate concisely and naturally, preserving the tone. Output only the translation.' },
          { role: 'user', content: `Translate this subtitle to ${settings.targetLang}:

${text}` }
        ],
        temperature: 0.3,
        max_tokens: 100
      };

      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${engine.key}`
        },
        body: JSON.stringify(body)
      });

      if (!resp.ok) return text;
      const data = await resp.json();
      const translated = data.choices?.[0]?.message?.content?.trim() || text;

      if (settings.enableCache) subtitleCache.set(cacheKey, translated);
      return translated;
    } catch (e) {
      return text;
    }
  }

  // Netflix subtitle selectors
  function findSubtitleElements() {
    const selectors = [
      '.player-timedtext-text-container',
      '.player-timedtext',
      '[class*="timedtext"]',
      '[class*="subtitle"]',
      '.watch-video--subtitles-container'
    ];

    const elements = [];
    for (const selector of selectors) {
      const found = document.querySelectorAll(selector);
      if (found.length) elements.push(...found);
    }
    return elements;
  }

  async function translateSubtitleElement(el) {
    if (!el || el.dataset.itTranslated) return;
    el.dataset.itTranslated = 'true';

    const originalText = el.textContent.trim();
    if (!originalText) return;

    const translated = await translateText(originalText);

    if (translated !== originalText) {
      if (settings.bilingualMode !== false) {
        // Bilingual mode: show original + translation
        const transDiv = document.createElement('div');
        transDiv.style.cssText = 'color: #667eea; font-size: 0.95em; margin-top: 2px; text-shadow: 0 1px 2px rgba(0,0,0,0.8);';
        transDiv.textContent = translated;
        el.appendChild(transDiv);
      } else {
        // Pure translation: replace text
        el.textContent = translated;
      }
    }
  }

  function startSubtitleObserver() {
    if (subtitleObserver) subtitleObserver.disconnect();

    subtitleObserver = new MutationObserver(mutations => {
      if (!settings.subtitleTranslate) return;

      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            if (node.querySelectorAll) {
              node.querySelectorAll('.player-timedtext-text-container, [class*="timedtext"]').forEach(el => {
                translateSubtitleElement(el);
              });
            }
          }
        });

        if (mutation.type === 'characterData') {
          const parent = mutation.target.parentElement;
          if (parent && (parent.classList?.contains('player-timedtext-text-container') || parent.matches?.('[class*="timedtext"]'))) {
            translateSubtitleElement(parent);
          }
        }
      });
    });

    const container = document.querySelector('.watch-video') || document.body;
    subtitleObserver.observe(container, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }

  async function initNetflix() {
    await loadSettings();
    if (!settings.subtitleTranslate) return;
    startSubtitleObserver();
  }

  if (isNetflix()) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initNetflix);
    } else {
      initNetflix();
    }
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync' && changes.subtitleTranslate) {
      settings.subtitleTranslate = changes.subtitleTranslate.newValue;
      if (settings.subtitleTranslate) {
        startSubtitleObserver();
      } else if (subtitleObserver) {
        subtitleObserver.disconnect();
      }
    }
  });
})();