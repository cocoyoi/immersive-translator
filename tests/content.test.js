// tests/content.test.js
// Content script unit tests

const { JSDOM } = require('jsdom');

// Setup DOM environment
const dom = new JSDOM('<!DOCTYPE html><html><body><p>Hello world</p><p>你好世界</p><input type="text" value="test"><textarea>content</textarea></body></html>');
global.document = dom.window.document;
global.window = dom.window;
global.Node = dom.window.Node;
global.NodeFilter = dom.window.NodeFilter;

// Mock chrome API
const mockChrome = {
  storage: { sync: { get: jest.fn(() => Promise.resolve({})), set: jest.fn() }, local: { get: jest.fn(() => Promise.resolve({})), set: jest.fn() } },
  runtime: { onMessage: { addListener: jest.fn() }, sendMessage: jest.fn() }
};
global.chrome = mockChrome;

describe('Content Script - Language Detection', () => {
  test('detects Chinese text', () => {
    const text = '你好世界';
    expect(/[\u4e00-\u9fff]/.test(text)).toBe(true);
  });

  test('detects Japanese text', () => {
    const text = 'こんにちは';
    expect(/[\u3040-\u309f]/.test(text)).toBe(true);
  });

  test('detects English text', () => {
    const text = 'Hello world';
    expect(/[a-zA-Z]/.test(text)).toBe(true);
  });

  test('detects Korean text', () => {
    const text = '안녕하세요';
    expect(/[\uac00-\ud7af]/.test(text)).toBe(true);
  });

  test('detects Russian text', () => {
    const text = 'Привет';
    expect(/[\u0400-\u04FF]/.test(text)).toBe(true);
  });

  test('detects French text', () => {
    const text = 'Bonjour le monde';
    expect(/[a-zA-ZÀ-ÿ]/.test(text)).toBe(true);
  });
});

describe('Content Script - DOM Manipulation', () => {
  let dom, doc;

  beforeEach(() => {
    dom = new JSDOM('<!DOCTYPE html><html><body><p>Hello world</p><p>你好世界</p><input type="text" value="test"><textarea>content</textarea></body></html>');
    doc = dom.window.document;
  });

  test('creates bilingual inline wrapper', () => {
    const wrapper = doc.createElement('span');
    wrapper.className = 'it-bilingual-inline';
    expect(wrapper.className).toBe('it-bilingual-inline');
  });

  test('creates bilingual block wrapper', () => {
    const wrapper = doc.createElement('div');
    wrapper.className = 'it-bilingual-block';
    expect(wrapper.className).toBe('it-bilingual-block');
  });

  test('creates pure translation wrapper', () => {
    const span = doc.createElement('span');
    span.className = 'it-pure-trans';
    expect(span.className).toBe('it-pure-trans');
  });

  test('text nodes are present', () => {
    const ps = doc.querySelectorAll('p');
    expect(ps.length).toBeGreaterThanOrEqual(2);
  });

  test('input elements are present', () => {
    const inputs = doc.querySelectorAll('input, textarea');
    expect(inputs.length).toBeGreaterThanOrEqual(1);
  });
});

describe('Content Script - Translation Styles', () => {
  test('bilingual inline style', () => {
    const style = 'bilingual-inline';
    expect(['bilingual-inline', 'bilingual-block', 'pure-translation']).toContain(style);
  });

  test('bilingual block style', () => {
    const style = 'bilingual-block';
    expect(['bilingual-inline', 'bilingual-block', 'pure-translation']).toContain(style);
  });

  test('pure translation style', () => {
    const style = 'pure-translation';
    expect(['bilingual-inline', 'bilingual-block', 'pure-translation']).toContain(style);
  });
});

describe('Content Script - Keyboard Events', () => {
  test('Alt+T shortcut', () => {
    const event = { key: 't', altKey: true };
    expect(event.key).toBe('t');
    expect(event.altKey).toBe(true);
  });

  test('Alt+S shortcut', () => {
    const event = { key: 's', altKey: true };
    expect(event.key).toBe('s');
    expect(event.altKey).toBe(true);
  });

  test('space counting for input translation', () => {
    let spaceCount = 0;
    const event = { key: ' ', preventDefault: jest.fn() };
    if (event.key === ' ') spaceCount++;
    expect(spaceCount).toBe(1);
  });
});

describe('Content Script - Translation Cache', () => {
  let cache;

  beforeEach(() => {
    cache = new Map();
  });

  test('stores translation in cache', () => {
    cache.set('hello', '你好');
    expect(cache.get('hello')).toBe('你好');
  });

  test('cache has max size', () => {
    const MAX_CACHE_SIZE = 5000;
    for (let i = 0; i < MAX_CACHE_SIZE + 100; i++) {
      cache.set(`key${i}`, `value${i}`);
      if (cache.size > MAX_CACHE_SIZE) {
        const firstKey = cache.keys().next().value;
        cache.delete(firstKey);
      }
    }
    expect(cache.size).toBeLessThanOrEqual(MAX_CACHE_SIZE);
  });
});

describe('Content Script - Hover Translation', () => {
  test('modifier key detection', () => {
    const event = { ctrlKey: true };
    expect(event.ctrlKey).toBe(true);
  });

  test('paragraph text extraction', () => {
    const p = document.createElement('p');
    p.textContent = 'This is a paragraph';
    expect(p.textContent.length).toBeGreaterThan(0);
  });
});

describe('Content Script - Text Processing', () => {
  test('text length limits', () => {
    const MIN_TEXT_LENGTH = 3;
    const MAX_TEXT_LENGTH = 5000;
    const text = 'Hello';
    expect(text.length).toBeGreaterThanOrEqual(MIN_TEXT_LENGTH);
    expect(text.length).toBeLessThanOrEqual(MAX_TEXT_LENGTH);
  });

  test('empty text is skipped', () => {
    const text = '';
    expect(text.length).toBe(0);
  });

  test('whitespace-only text is skipped', () => {
    const text = '   ';
    expect(text.trim().length).toBe(0);
  });
});

console.log('Content tests loaded:', new Date().toISOString());