// meeting-translator.js - immersive-translator
// Real-time translation for web-based meeting platforms: Zoom, Google Meet, Microsoft Teams
// Captures subtitle/caption DOM elements and overlays bilingual translations

(function() {
  'use strict';

  const MeetingTranslator = {
    enabled: false,
    targetLang: 'zh-CN',
    engine: 'google',
    observer: null,
    processedNodes: new WeakSet(),
    translationCache: new Map(),

    platforms: {
      'zoom.us': {
        name: 'Zoom',
        captionSelector: '.caption, .closed-caption, [role="dialog"] .caption-text, .cc-text',
        containerSelector: '.caption-window, .cc-container',
        injectMode: 'sibling'
      },
      'zoom.com': {
        name: 'Zoom',
        captionSelector: '.caption, .closed-caption, [role="dialog"] .caption-text, .cc-text',
        containerSelector: '.caption-window, .cc-container',
        injectMode: 'sibling'
      },
      'meet.google.com': {
        name: 'Google Meet',
        captionSelector: '.VfPpkd-g78Dhe, .bhZgxf, [data-message-text], .cRMTzd .YTbUzc',
        containerSelector: '.VfPpkd-g78Dhe, .bhZgxf',
        injectMode: 'below'
      },
      'teams.microsoft.com': {
        name: 'Microsoft Teams',
        captionSelector: '[data-tid="closed-caption-text"], .fui-Text, .ui-chat__item__message',
        containerSelector: '[data-tid="closed-caption-container"]',
        injectMode: 'below'
      },
      'teams.live.com': {
        name: 'Microsoft Teams (Live)',
        captionSelector: '[data-tid="closed-caption-text"], .fui-Text',
        containerSelector: '[data-tid="closed-caption-container"]',
        injectMode: 'below'
      }
    },

    detectPlatform(hostname = window.location.hostname) {
      for (const [domain, config] of Object.entries(this.platforms)) {
        if (hostname.includes(domain)) return config;
      }
      return null;
    },

    async init(settings = {}) {
      this.enabled = settings.enableMeetingTranslate !== false;
      this.targetLang = settings.targetLang || 'zh-CN';
      this.engine = settings.activeEngineId || 'google';

      const platform = this.detectPlatform();
      if (!platform || !this.enabled) return;

      console.log('[immersive-translator] Meeting translator activated for', platform.name);
      this.startObserving(platform);
    },

    startObserving(platform) {
      if (this.observer) this.observer.disconnect();

      // Process existing captions
      document.querySelectorAll(platform.captionSelector).forEach(el => this.processCaption(el, platform));

      // Watch for new captions
      this.observer = new MutationObserver(mutations => {
        mutations.forEach(mutation => {
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              if (node.matches && node.matches(platform.captionSelector)) {
                this.processCaption(node, platform);
              }
              node.querySelectorAll?.(platform.captionSelector).forEach(el => this.processCaption(el, platform));
            }
          });
        });
      });

      this.observer.observe(document.body, { childList: true, subtree: true });
    },

    async processCaption(element, platform) {
      if (this.processedNodes.has(element)) return;
      const text = element.innerText?.trim();
      if (!text || text.length < 2) return;

      // Skip if already translated
      if (element.nextElementSibling?.classList?.contains('it-meeting-translation')) return;

      this.processedNodes.add(element);

      try {
        const translated = await this.translate(text);
        if (translated && translated !== text) {
          this.injectTranslation(element, translated, platform);
        }
      } catch (e) {
        console.warn('[meeting-translator]', e);
      }
    },

    async translate(text) {
      const cacheKey = `${text}:${this.targetLang}`;
      if (this.translationCache.has(cacheKey)) {
        return this.translationCache.get(cacheKey);
      }

      let result;
      if (typeof translateWithFallback === 'function') {
        const settings = { activeEngineId: this.engine, fallbackEnabled: true };
        const r = await translateWithFallback(text, this.targetLang, settings);
        result = r.text;
      } else if (typeof TranslationEngines !== 'undefined' && TranslationEngines[this.engine]) {
        result = await TranslationEngines[this.engine](text, this.targetLang);
      } else {
        // Direct Google fallback
        const url = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=' + this.targetLang + '&dt=t&q=' + encodeURIComponent(text);
        const resp = await fetch(url);
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        const data = await resp.json();
        result = data[0].map(s => s[0]).join('');
      }

      if (this.translationCache.size > 200) this.translationCache.clear();
      this.translationCache.set(cacheKey, result);
      return result;
    },

    injectTranslation(originalEl, translated, platform) {
      const transEl = document.createElement('div');
      transEl.className = 'it-meeting-translation';
      transEl.setAttribute('data-it-translated', 'true');
      transEl.style.cssText = `
        display: block;
        margin-top: 4px;
        padding: 6px 10px;
        background: rgba(102,126,234,0.12);
        border-left: 3px solid #667eea;
        border-radius: 4px;
        font-size: 0.92em;
        color: #333;
        line-height: 1.5;
        font-family: -apple-system, BlinkMacSystemFont, sans-serif;
        max-width: 100%;
        word-wrap: break-word;
      `;
      transEl.textContent = translated;

      if (platform.injectMode === 'sibling') {
        originalEl.parentNode.insertBefore(transEl, originalEl.nextSibling);
      } else {
        // 'below' - append to same container
        originalEl.appendChild(transEl);
      }
    },

    stop() {
      if (this.observer) {
        this.observer.disconnect();
        this.observer = null;
      }
      document.querySelectorAll('.it-meeting-translation').forEach(el => el.remove());
      this.processedNodes = new WeakSet();
    },

    toggle(enable) {
      this.enabled = enable;
      if (enable) {
        const platform = this.detectPlatform();
        if (platform) this.startObserving(platform);
      } else {
        this.stop();
      }
    }
  };

  if (typeof window !== 'undefined') {
    window.MeetingTranslator = MeetingTranslator;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = MeetingTranslator;
  }
})();