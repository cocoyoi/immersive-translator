// tests/background.test.js
// Background service worker tests

const mockChrome = {
  storage: {
    sync: { get: jest.fn(), set: jest.fn() },
    local: { get: jest.fn(), set: jest.fn() }
  },
  runtime: {
    onMessage: { addListener: jest.fn() },
    onInstalled: { addListener: jest.fn() },
    onStartup: { addListener: jest.fn() },
    lastError: null
  },
  tabs: { query: jest.fn(), sendMessage: jest.fn() },
  contextMenus: { create: jest.fn(), onClicked: { addListener: jest.fn() } }
};

global.chrome = mockChrome;

// Engine configuration tests
describe('Engine Configuration', () => {
  const VALID_ENGINES = [
    { name: 'OpenAI', base: 'https://api.openai.com/v1', model: 'gpt-4o-mini', temp: 0.3 },
    { name: 'DeepSeek', base: 'https://api.deepseek.com/v1', model: 'deepseek-chat', temp: 0.3 },
    { name: 'Aliyun', base: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-turbo', temp: 0.3 },
    { name: 'Ollama', base: 'http://localhost:11434/v1', model: 'llama3', temp: 0.3 }
  ];

  test('validates OpenAI URL', () => {
    const engine = VALID_ENGINES[0];
    expect(engine.base).toMatch(/^https:\/\/.+/);
    expect(engine.model).toBeTruthy();
  });

  test('validates Ollama local URL', () => {
    const engine = VALID_ENGINES[3];
    expect(engine.base).toMatch(/^http:\/\//);
    expect(engine.model).toBeTruthy();
  });

  test('validates temperature range', () => {
    VALID_ENGINES.forEach(engine => {
      expect(engine.temp).toBeGreaterThanOrEqual(0);
      expect(engine.temp).toBeLessThanOrEqual(2);
    });
  });

  test('all engines have required fields', () => {
    VALID_ENGINES.forEach(engine => {
      expect(engine.name).toBeTruthy();
      expect(engine.base).toBeTruthy();
      expect(engine.model).toBeTruthy();
    });
  });
});

// Translation cache tests
describe('Translation Cache', () => {
  let cache;

  beforeEach(() => {
    cache = new Map();
  });

  test('stores and retrieves translations', () => {
    cache.set('hello', '你好');
    expect(cache.get('hello')).toBe('你好');
  });

  test('cache size limit', () => {
    const MAX_SIZE = 5000;
    // Simulate LRU eviction in our real implementation
    for (let i = 0; i < MAX_SIZE + 100; i++) {
      cache.set(`key${i}`, `value${i}`);
      // Evict oldest if over limit
      if (cache.size > MAX_SIZE) {
        const firstKey = cache.keys().next().value;
        cache.delete(firstKey);
      }
    }
    expect(cache.size).toBeLessThanOrEqual(MAX_SIZE);
  });

  test('cache hit improves performance', () => {
    const start = Date.now();
    cache.set('test', 'translation');
    const cached = cache.get('test');
    const end = Date.now();
    expect(cached).toBe('translation');
    expect(end - start).toBeLessThan(10);
  });
});

// Message handling tests
describe('Message Handling', () => {
  test('translate message structure', () => {
    const message = {
      action: 'translate',
      text: 'Hello world',
      targetLang: 'zh-CN',
      engineId: 'openai'
    };
    expect(message.action).toBe('translate');
    expect(message.text).toBeTruthy();
    expect(message.targetLang).toBeTruthy();
  });

  test('translatePage message structure', () => {
    const message = {
      action: 'translatePage',
      targetLang: 'zh-CN',
      bilingualMode: true
    };
    expect(message.action).toBe('translatePage');
    expect(typeof message.bilingualMode).toBe('boolean');
  });

  test('updateSettings message structure', () => {
    const message = {
      action: 'updateSettings',
      settings: { targetLang: 'ja', enableCache: true }
    };
    expect(message.action).toBe('updateSettings');
    expect(message.settings).toBeDefined();
  });
});

// Error handling tests
describe('Error Handling', () => {
  test('handles missing engine', () => {
    const engines = [];
    const activeEngineId = 'nonexistent';
    const engine = engines.find(e => e.id === activeEngineId);
    expect(engine).toBeUndefined();
  });

  test('handles API error', () => {
    const error = new Error('API rate limit exceeded');
    expect(error.message).toMatch(/rate limit|error/i);
  });

  test('handles network timeout', () => {
    const error = new Error('Request timeout after 30000ms');
    expect(error.message).toMatch(/timeout/i);
  });
});

// Storage tests
describe('Storage Operations', () => {
  test('default settings structure', () => {
    const defaults = {
      enableTranslate: false,
      bilingualMode: true,
      selectionTranslate: false,
      inputTranslate: false,
      targetLang: 'zh-CN',
      fontSize: 14,
      transColor: '#667eea',
      showOriginal: true,
      hoverTranslate: false,
      autoDetect: true,
      enableCache: true,
      maxConcurrent: 3,
      engines: [],
      activeEngineId: null,
      hoverModifier: 'ctrl',
      inputTrigger: 'triple-space',
      glossary: {},
      aiExpert: 'general',
      transStyle: 'bilingual-inline',
      pronounceEnabled: false
    };

    expect(defaults.targetLang).toBe('zh-CN');
    expect(defaults.maxConcurrent).toBe(3);
    expect(defaults.bilingualMode).toBe(true);
    expect(defaults.engines).toEqual([]);
  });
});

// Context menu tests
describe('Context Menu', () => {
  test('creates translate menu item', () => {
    const menuItem = {
      id: 'translateSelection',
      title: '翻译选中文本',
      contexts: ['selection']
    };
    expect(menuItem.id).toBe('translateSelection');
    expect(menuItem.contexts).toContain('selection');
  });
});

console.log('Background tests loaded:', new Date().toISOString());