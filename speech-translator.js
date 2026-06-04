// speech-translator.js - immersive-translator
// Real-time speech recognition + translation for videos without subtitles
// Uses Web Speech API (browser-native, free, no API key)

(function() {
  'use strict';

  const SpeechTranslator = {
    recognition: null,
    isListening: false,
    targetLang: 'zh-CN',
    engine: 'google',
    subtitleOverlay: null,
    translationCache: new Map(),
    currentTranscript: '',

    // Check browser support
    isSupported() {
      return 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
    },

    async init(settings = {}) {
      if (!this.isSupported()) {
        console.warn('[speech-translator] Web Speech API not supported in this browser');
        return false;
      }

      this.targetLang = settings.targetLang || 'zh-CN';
      this.engine = settings.activeEngineId || 'google';

      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = 'en-US'; // Source language - can be made configurable

      this.recognition.onresult = (event) => {
        let interim = '';
        let final = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            final += transcript;
          } else {
            interim += transcript;
          }
        }
        if (final) {
          this.currentTranscript = final;
          this.translateAndShow(final, false);
        }
        if (interim) {
          this.showSubtitle(interim, true);
        }
      };

      this.recognition.onerror = (event) => {
        console.warn('[speech-translator] Error:', event.error);
        if (event.error === 'not-allowed') {
          this.showSubtitle('🎤 麦克风权限被拒绝，请在浏览器设置中允许麦克风访问', false);
        }
      };

      this.recognition.onend = () => {
        if (this.isListening) {
          // Auto-restart if still enabled
          setTimeout(() => this.recognition.start(), 500);
        }
      };

      return true;
    },

    start() {
      if (!this.recognition) {
        console.warn('[speech-translator] Not initialized');
        return;
      }
      this.isListening = true;
      try {
        this.recognition.start();
        this.createOverlay();
        this.showSubtitle('🎤 正在监听音频...', false);
      } catch (e) {
        console.warn('[speech-translator] Start failed:', e);
      }
    },

    stop() {
      this.isListening = false;
      if (this.recognition) {
        try { this.recognition.stop(); } catch (e) {}
      }
      this.removeOverlay();
    },

    toggle() {
      if (this.isListening) {
        this.stop();
      } else {
        this.start();
      }
      return this.isListening;
    },

    createOverlay() {
      if (this.subtitleOverlay) return;
      const overlay = document.createElement('div');
      overlay.id = 'it-speech-overlay';
      overlay.style.cssText = `
        position: fixed;
        bottom: 80px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 2147483647;
        max-width: 80%;
        min-width: 300px;
        background: rgba(0,0,0,0.8);
        color: #fff;
        padding: 12px 20px;
        border-radius: 12px;
        font-family: -apple-system, BlinkMacSystemFont, sans-serif;
        font-size: 16px;
        line-height: 1.6;
        text-align: center;
        backdrop-filter: blur(8px);
        box-shadow: 0 4px 20px rgba(0,0,0,0.4);
        pointer-events: none;
        transition: opacity 0.3s;
      `;
      document.body.appendChild(overlay);
      this.subtitleOverlay = overlay;
    },

    removeOverlay() {
      if (this.subtitleOverlay) {
        this.subtitleOverlay.remove();
        this.subtitleOverlay = null;
      }
    },

    showSubtitle(text, isInterim = false) {
      if (!this.subtitleOverlay) this.createOverlay();
      this.subtitleOverlay.innerHTML = `
        <div style="opacity:${isInterim ? 0.7 : 1}; font-style:${isInterim ? 'italic' : 'normal'};">${this.escapeHtml(text)}</div>
        ${isInterim ? '' : '<div style="font-size:12px; opacity:0.5; margin-top:4px;">🎤 语音识别中...</div>'}
      `;
      this.subtitleOverlay.style.opacity = '1';
    },

    async translateAndShow(text, isInterim = false) {
      if (!text.trim()) return;
      try {
        const translated = await this.translate(text);
        if (!isInterim) {
          this.showSubtitle(`${this.escapeHtml(text)}\n↓\n${this.escapeHtml(translated)}`, false);
        }
      } catch (e) {
        this.showSubtitle(text, false);
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
        const url = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=' + this.targetLang + '&dt=t&q=' + encodeURIComponent(text);
        const resp = await fetch(url);
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        const data = await resp.json();
        result = data[0].map(s => s[0]).join('');
      }

      if (this.translationCache.size > 100) this.translationCache.clear();
      this.translationCache.set(cacheKey, result);
      return result;
    },

    escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }
  };

  if (typeof window !== 'undefined') {
    window.SpeechTranslator = SpeechTranslator;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = SpeechTranslator;
  }
})();