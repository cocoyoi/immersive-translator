// custom-css.js - immersive-translator
// User-defined CSS injection for translation display customization
// Allows users to override default bilingual/inline/block styles per domain

(function() {
  'use strict';

  const CustomCSS = {
    STORAGE_KEY: 'it_custom_css_rules',
    STYLE_ID: 'it-user-css',

    defaultPresets: {
      'bilingual-elegant': `
.it-bilingual-inline { display: block !important; margin: 8px 0 !important; padding: 12px 16px !important; background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%) !important; border-radius: 8px !important; border-left: 4px solid #667eea !important; }
.it-bilingual-inline .it-original { display: block !important; margin-bottom: 6px !important; font-size: 0.92em !important; color: #6c757d !important; line-height: 1.6 !important; }
.it-bilingual-inline .it-translation { display: block !important; color: #212529 !important; font-size: 1em !important; line-height: 1.7 !important; border-left: none !important; padding-left: 0 !important; margin-left: 0 !important; }
.it-bilingual-block { background: #f8f9fa !important; border-radius: 8px !important; border-left: 4px solid #667eea !important; padding: 14px 18px !important; }
`,
      'bilingual-compact': `
.it-bilingual-inline { display: inline !important; }
.it-bilingual-inline .it-original { display: none !important; }
.it-bilingual-inline .it-translation { color: #667eea !important; font-size: 0.95em !important; border-left: 2px solid #667eea !important; padding-left: 4px !important; margin-left: 2px !important; }
.it-bilingual-block { padding: 6px 10px !important; margin: 2px 0 !important; }
`,
      'dark-mode': `
.it-bilingual-inline { background: rgba(30,30,40,0.6) !important; border: 1px solid rgba(102,126,234,0.3) !important; border-radius: 6px !important; padding: 8px 12px !important; }
.it-bilingual-inline .it-original { color: #a0a0b0 !important; }
.it-bilingual-inline .it-translation { color: #e0e0f0 !important; border-left-color: #667eea !important; }
.it-bilingual-block { background: rgba(30,30,40,0.6) !important; border: 1px solid rgba(102,126,234,0.3) !important; }
#it-popup { background: #1a1a2e !important; border-color: #667eea !important; color: #eee !important; }
#it-toast { background: #1a1a2e !important; border-color: #667eea !important; color: #eee !important; }
`,
      'academic-paper': `
.it-bilingual-inline { display: block !important; margin: 12px 0 !important; padding: 14px 20px !important; background: #fafafa !important; border: 1px solid #e0e0e0 !important; border-radius: 4px !important; font-family: "Times New Roman", Georgia, serif !important; }
.it-bilingual-inline .it-original { display: block !important; margin-bottom: 8px !important; font-style: italic !important; color: #555 !important; line-height: 1.8 !important; }
.it-bilingual-inline .it-translation { display: block !important; color: #222 !important; line-height: 1.8 !important; border-left: none !important; padding-left: 0 !important; margin-left: 0 !important; }
`,
      'subtitle-style': `
.it-bilingual-inline { display: block !important; margin: 4px 0 !important; padding: 6px 10px !important; background: rgba(0,0,0,0.75) !important; color: #fff !important; border-radius: 4px !important; text-align: center !important; font-family: -apple-system, sans-serif !important; }
.it-bilingual-inline .it-original { display: none !important; }
.it-bilingual-inline .it-translation { color: #fff !important; border-left: none !important; padding-left: 0 !important; margin-left: 0 !important; text-shadow: 1px 1px 2px rgba(0,0,0,0.8) !important; }
`
    },

    async loadRules() {
      if (typeof chrome === 'undefined' || !chrome.storage) return {};
      const data = await chrome.storage.sync.get([this.STORAGE_KEY]);
      return data[this.STORAGE_KEY] || {};
    },

    async saveRules(rules) {
      if (typeof chrome === 'undefined' || !chrome.storage) return;
      await chrome.storage.sync.set({ [this.STORAGE_KEY]: rules });
    },

    getDomainPattern(hostname) {
      // Exact match first, then wildcard
      const rules = this.loadRulesSync ? this.loadRulesSync() : {};
      if (rules[hostname]) return hostname;
      // Check wildcards
      for (const domain of Object.keys(rules)) {
        if (domain.startsWith('*.')) {
          const suffix = domain.slice(2);
          if (hostname.endsWith(suffix)) return domain;
        }
      }
      return '_global';
    },

    loadRulesSync() {
      // Fallback for synchronous contexts - return empty
      return {};
    },

    injectCSS(cssText) {
      let style = document.getElementById(this.STYLE_ID);
      if (!style) {
        style = document.createElement('style');
        style.id = this.STYLE_ID;
        style.textContent = cssText;
        (document.head || document.documentElement).appendChild(style);
      } else {
        style.textContent = cssText;
      }
    },

    removeCSS() {
      const style = document.getElementById(this.STYLE_ID);
      if (style) style.remove();
    },

    async apply(hostname = window.location.hostname) {
      const rules = await this.loadRules();
      const globalCSS = rules._global || '';
      let domainCSS = rules[hostname] || '';

      // Check wildcard patterns
      for (const [domain, css] of Object.entries(rules)) {
        if (domain.startsWith('*.')) {
          const suffix = domain.slice(2);
          if (hostname.endsWith(suffix) && !domainCSS) {
            domainCSS = css;
          }
        }
      }

      const combined = globalCSS + '\n' + domainCSS;
      if (combined.trim()) {
        this.injectCSS(combined);
      } else {
        this.removeCSS();
      }
    },

    // Preset management
    getPresets() {
      return Object.keys(this.defaultPresets);
    },

    getPresetCSS(name) {
      return this.defaultPresets[name] || '';
    },

    // Rule CRUD
    async setRule(domain, css) {
      const rules = await this.loadRules();
      if (css && css.trim()) {
        rules[domain] = css;
      } else {
        delete rules[domain];
      }
      await this.saveRules(rules);
    },

    async deleteRule(domain) {
      const rules = await this.loadRules();
      delete rules[domain];
      await this.saveRules(rules);
    },

    async getAllRules() {
      return await this.loadRules();
    }
  };

  if (typeof window !== 'undefined') {
    window.CustomCSS = CustomCSS;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = CustomCSS;
  }
})();