// engines.js - immersive-translator
// Multi-translation engine registry, scheduling, and automatic fallback

const TranslationEngines = {
  // === Free engines (no API key required) ===

  async google(text, targetLang, sourceLang = 'auto') {
    // Use Google Translate public endpoint (unofficial, free tier behavior)
    // Note: This is the public RPC-style endpoint used by translate.google.com
    const url = 'https://translate.googleapis.com/translate_a/single';
    const params = new URLSearchParams({
      client: 'gtx',
      sl: sourceLang,
      tl: targetLang,
      dt: 't',
      q: text
    });
    const resp = await fetch(`${url}?${params.toString()}`);
    if (!resp.ok) throw new Error(`Google Translate HTTP ${resp.status}`);
    const data = await resp.json();
    if (!Array.isArray(data) || !Array.isArray(data[0])) throw new Error('Invalid Google response');
    return data[0].map(s => s[0]).join('');
  },

  async libretranslate(text, targetLang, sourceLang = 'auto') {
    // Default public LibreTranslate instance (free, rate-limited)
    // Users can configure their own self-hosted endpoint
    const endpoint = (typeof chrome !== 'undefined' && chrome.storage)
      ? (await chrome.storage.sync.get('libreEndpoint')).libreEndpoint || 'https://libretranslate.de/translate'
      : 'https://libretranslate.de/translate';
    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: text, source: sourceLang, target: targetLang, format: 'text' })
    });
    if (!resp.ok) throw new Error(`LibreTranslate HTTP ${resp.status}`);
    const data = await resp.json();
    if (data.error) throw new Error(data.error);
    return data.translatedText;
  },

  async bing(text, targetLang, sourceLang = 'auto') {
    // Bing Translator (public endpoint, unofficial)
    const resp = await fetch('https://api.bing.microsoft.com/v7.0/translate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Ocp-Apim-Subscription-Key': (await chrome.storage.sync.get('bingKey')).bingKey || ''
      },
      body: JSON.stringify([{ Text: text }]),
      params: { 'api-version': '3.0', to: targetLang, from: sourceLang }
    });
    if (!resp.ok) throw new Error(`Bing HTTP ${resp.status}`);
    const data = await resp.json();
    return data[0]?.translations?.[0]?.text || text;
  },

  // === AI engines (API key required) ===

  async openai(text, targetLang, sourceLang = 'auto', engineConfig = {}) {
    const { apiBase, apiKey, model } = engineConfig;
    const url = apiBase ? `${apiBase.replace(/\/$/, '')}/chat/completions` : 'https://api.openai.com/v1/chat/completions';
    const system = `You are a professional translator. Translate the following text to ${targetLang}. Output ONLY the translation, no explanations.`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: text }
        ],
        temperature: 0.3
      })
    });
    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`OpenAI HTTP ${resp.status}: ${err.slice(0, 200)}`);
    }
    const data = await resp.json();
    return data.choices?.[0]?.message?.content?.trim() || text;
  },

  async deepseek(text, targetLang, sourceLang = 'auto', engineConfig = {}) {
    const { apiBase, apiKey, model } = engineConfig;
    const url = apiBase ? `${apiBase.replace(/\/$/, '')}/chat/completions` : 'https://api.deepseek.com/v1/chat/completions';
    const system = `Translate to ${targetLang}. Output only the translation.`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model || 'deepseek-chat',
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: text }
        ],
        temperature: 0.3
      })
    });
    if (!resp.ok) throw new Error(`DeepSeek HTTP ${resp.status}`);
    const data = await resp.json();
    return data.choices?.[0]?.message?.content?.trim() || text;
  },

  async deepl(text, targetLang, sourceLang = 'auto', engineConfig = {}) {
    const { apiKey, apiBase } = engineConfig;
    const url = apiBase ? `${apiBase}/v2/translate` : 'https://api-free.deepl.com/v2/translate';
    const form = new URLSearchParams();
    form.append('text', text);
    form.append('target_lang', targetLang.toUpperCase());
    if (sourceLang && sourceLang !== 'auto') form.append('source_lang', sourceLang.toUpperCase());
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `DeepL-Auth-Key ${apiKey}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: form
    });
    if (!resp.ok) throw new Error(`DeepL HTTP ${resp.status}`);
    const data = await resp.json();
    return data.translations?.[0]?.text || text;
  },

  async ollama(text, targetLang, sourceLang = 'auto', engineConfig = {}) {
    const { apiBase, model } = engineConfig;
    const url = apiBase ? `${apiBase.replace(/\/$/, '')}/api/generate` : 'http://localhost:11434/api/generate';
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model || 'llama3',
        prompt: `Translate the following text to ${targetLang}. Output only the translation, nothing else:\n\n${text}`,
        stream: false
      })
    });
    if (!resp.ok) throw new Error(`Ollama HTTP ${resp.status}`);
    const data = await resp.json();
    return data.response?.trim() || text;
  },

  async aliyun(text, targetLang, sourceLang = 'auto', engineConfig = {}) {
    // Aliyun Tongyi Qianwen - OpenAI compatible
    const { apiBase, apiKey, model } = engineConfig;
    const url = apiBase ? `${apiBase.replace(/\/$/, '')}/chat/completions` : 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model || 'qwen-turbo',
        messages: [
          { role: 'system', content: `Translate to ${targetLang}. Output only the translation.` },
          { role: 'user', content: text }
        ]
      })
    });
    if (!resp.ok) throw new Error(`Aliyun HTTP ${resp.status}`);
    const data = await resp.json();
    return data.choices?.[0]?.message?.content?.trim() || text;
  }
};

// Engine metadata for UI and ordering
const EngineMeta = {
  google: { name: 'Google Translate', type: 'free', needsKey: false, priority: 1 },
  libretranslate: { name: 'LibreTranslate', type: 'free', needsKey: false, priority: 2 },
  bing: { name: 'Microsoft Translator', type: 'free', needsKey: true, priority: 3 },
  openai: { name: 'OpenAI', type: 'ai', needsKey: true, priority: 10 },
  deepseek: { name: 'DeepSeek', type: 'ai', needsKey: true, priority: 11 },
  deepl: { name: 'DeepL', type: 'ai', needsKey: true, priority: 12 },
  ollama: { name: 'Ollama (Local)', type: 'ai', needsKey: false, priority: 13 },
  aliyun: { name: '阿里云通义千问', type: 'ai', needsKey: true, priority: 14 }
};

// Build engine prompt with glossary and expert mode
function buildEnginePrompt(text, targetLang, glossary = {}, expertMode = null) {
  let system = 'You are a professional translator. Translate accurately while preserving the original tone and style. Output only the translation without explanations.';
  const expertMap = {
    tech: 'You are a technical translator. Use precise technical terminology.',
    medical: 'You are a medical translator. Use accurate medical terminology.',
    legal: 'You are a legal translator. Use precise legal terminology.',
    literary: 'You are a literary translator. Preserve metaphors and poetic elements.',
    academic: 'You are an academic translator. Maintain formal tone and citations.',
    business: 'You are a business translator. Use professional business terminology.',
    subtitles: 'You are a subtitle translator. Keep translations concise for timing.'
  };
  if (expertMode && expertMap[expertMode]) {
    system += '\n\n' + expertMap[expertMode];
  }
  if (glossary && Object.keys(glossary).length > 0) {
    const terms = Object.entries(glossary).map(([k, v]) => `"${k}" -> "${v}"`).join('\n');
    system += '\n\nUse the following glossary terms:\n' + terms;
  }
  return { system, user: `Translate the following text to ${targetLang}:\n\n${text}` };
}

// Main translation function with fallback
async function translateWithFallback(text, targetLang, settings = {}) {
  const {
    activeEngineId = 'google',
    engines = [],
    fallbackEnabled = true,
    glossary = {},
    aiExpert = null
  } = settings;

  // Find the active engine config
  const activeEngine = engines.find(e => e.id === activeEngineId) || { id: activeEngineId };
  const engineFn = TranslationEngines[activeEngine.id];

  if (!engineFn) {
    throw new Error(`Unknown engine: ${activeEngineId}`);
  }

  // Try primary engine
  try {
    const result = await engineFn(text, targetLang, 'auto', activeEngine);
    return { text: result, engine: activeEngine.id };
  } catch (primaryErr) {
    if (!fallbackEnabled) throw primaryErr;

    // Fallback chain: Google -> LibreTranslate
    const fallbackChain = ['google', 'libretranslate'];
    for (const fid of fallbackChain) {
      if (fid === activeEngine.id) continue;
      const fbFn = TranslationEngines[fid];
      if (!fbFn) continue;
      try {
        const result = await fbFn(text, targetLang, 'auto');
        return { text: result, engine: fid, fallback: true };
      } catch (fbErr) {
        continue;
      }
    }
    throw primaryErr;
  }
}

// Expose for content scripts and background
if (typeof window !== 'undefined') {
  window.TranslationEngines = TranslationEngines;
  window.EngineMeta = EngineMeta;
  window.translateWithFallback = translateWithFallback;
  window.buildEnginePrompt = buildEnginePrompt;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { TranslationEngines, EngineMeta, translateWithFallback, buildEnginePrompt };
}
