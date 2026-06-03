// youtube-translator.js - YouTube Subtitle Translation
// Detects YouTube video pages, intercepts subtitles, and provides bilingual translation

(function() {
  'use strict';

  const YOUTUBE_REGEX = /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)/;
  let settings = {};
  let subtitleObserver = null;
  let isTranslatingSubtitles = false;
  let subtitleCache = new Map();
  let currentVideoId = null;

  // Check if on YouTube
  function isYouTube() {
    return YOUTUBE_REGEX.test(window.location.href);
  }

  // Load settings
  async function loadSettings() {
    const data = await chrome.storage.sync.get([
      'targetLang', 'engines', 'activeEngineId', 'enableCache', 'bilingualMode', 'subtitleTranslate', 'subtitleSourceLang'
    ]);
    settings = { ...{ targetLang: 'zh-CN', subtitleTranslate: false, bilingualMode: true, subtitleSourceLang: 'auto' }, ...data };
  }

  async function getActiveEngine() {
    const { engines = [], activeEngineId } = settings;
    return engines.find(e => e.id === activeEngineId) || engines[0];
  }

  async function translateText(text) {
    if (!text || text.length < 2) return text;

    const cacheKey = `yt:${text}:${settings.targetLang}`;
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

  // Find YouTube subtitle container
  function findSubtitleContainer() {
    // YouTube uses multiple possible selectors for subtitle elements
    const selectors = [
      '.ytp-caption-segment',
      '.captions-text',
      '.ytd-transcript-body-renderer',
      '[class*="caption"]',
      '[class*="subtitle"]'
    ];

    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el) return el.closest('.ytp-caption-window-container, .captions-container, #ytp-caption-window-container') || el.parentElement;
    }

    return null;
  }

  // Create bilingual subtitle element
  function createBilingualSubtitle(originalText, translatedText) {
    const container = document.createElement('div');
    container.className = 'it-yt-subtitle';
    container.style.cssText = `
      display: block;
      text-align: center;
      padding: 2px 8px;
      background: rgba(0,0,0,0.75);
      border-radius: 4px;
      margin-bottom: 2px;
      font-size: 18px;
      line-height: 1.4;
      text-shadow: 0 1px 2px rgba(0,0,0,0.8);
      color: #fff;
    `;

    if (settings.bilingualMode !== false) {
      const orig = document.createElement('div');
      orig.textContent = originalText;
      orig.style.cssText = 'font-size: 0.85em; opacity: 0.7; margin-bottom: 2px;';
      container.appendChild(orig);
    }

    const trans = document.createElement('div');
    trans.textContent = translatedText;
    trans.style.cssText = `color: #667eea; font-size: 1em;`;
    container.appendChild(trans);

    return container;
  }

  // Translate subtitle element
  async function translateSubtitleElement(el) {
    if (!el || el.dataset.itTranslated) return;
    el.dataset.itTranslated = 'true';

    const originalText = el.textContent.trim();
    if (!originalText) return;

    const translated = await translateText(originalText);

    if (translated !== originalText) {
      const bilingual = createBilingualSubtitle(originalText, translated);

      // Hide original subtitle
      el.style.display = 'none';

      // Insert bilingual subtitle
      if (el.parentElement) {
        el.parentElement.insertBefore(bilingual, el);
      }
    }
  }

  // Start observing YouTube subtitles
  function startSubtitleObserver() {
    if (subtitleObserver) subtitleObserver.disconnect();

    subtitleObserver = new MutationObserver(mutations => {
      if (!settings.subtitleTranslate) return;

      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // Check if it's a subtitle element
            const isCaption = node.classList?.contains('ytp-caption-segment') ||
                             node.matches?.('[class*="caption"]') ||
                             node.querySelector?.('.ytp-caption-segment');

            if (isCaption) {
              translateSubtitleElement(node);
            }

            // Check children
            if (node.querySelectorAll) {
              node.querySelectorAll('.ytp-caption-segment, [class*="caption"]').forEach(el => {
                translateSubtitleElement(el);
              });
            }
          }
        });

        // Check modified nodes
        if (mutation.type === 'characterData') {
          const parent = mutation.target.parentElement;
          if (parent && (parent.classList?.contains('ytp-caption-segment') || parent.matches?.('[class*="caption"]'))) {
            translateSubtitleElement(parent);
          }
        }
      });
    });

    const container = findSubtitleContainer() || document.body;
    subtitleObserver.observe(container, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }

  // Detect video changes
  function detectVideoChange() {
    const videoId = new URLSearchParams(window.location.search).get('v');
    if (videoId && videoId !== currentVideoId) {
      currentVideoId = videoId;
      subtitleCache.clear();

      // Wait for subtitle container to appear
      setTimeout(() => {
        if (settings.subtitleTranslate) {
          startSubtitleObserver();
        }
      }, 2000);
    }
  }

  // Initialize YouTube translation
  async function initYouTube() {
    await loadSettings();
    if (!settings.subtitleTranslate) return;

    detectVideoChange();

    // Watch for URL changes (SPA navigation)
    let lastUrl = window.location.href;
    setInterval(() => {
      if (window.location.href !== lastUrl) {
        lastUrl = window.location.href;
        detectVideoChange();
      }
    }, 1000);
  }

  // Only run on YouTube
  if (isYouTube()) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initYouTube);
    } else {
      initYouTube();
    }
  }

  // Listen for settings changes
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
